/**
 * Same-origin proxy for the weather data sources. The client bundle may only
 * request `/plugins/dsh-weather/api/<endpoint>?...`; this handler forwards to
 * a strict two-host allowlist (Open-Meteo forecast + geocoding) and caches
 * JSON responses for five minutes. It never grants access to any other host.
 *
 * The same prefix also owns GET/POST `/settings`, keeping this standalone
 * plugin independent from the core settings RPC allowlist.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { WeatherSettingsSchema, type WeatherSettings } from './weather-settings.ts'

/** Route prefix registered on the host webserver. */
const PREFIX = '/plugins/dsh-weather/api'

/** Allowlisted upstreams, keyed by the path segment after the prefix. */
const UPSTREAMS: Readonly<Record<string, string>> = Object.freeze({
  forecast: 'https://api.open-meteo.com/v1/forecast',
  search: 'https://geocoding-api.open-meteo.com/v1/search',
})

/** Cache lifetime for successful JSON responses. */
const CACHE_TTL_MS = 5 * 60 * 1000

/** Bound on cached entries; the oldest entry is evicted on overflow. */
const CACHE_MAX_ENTRIES = 200
const MAX_BODY_BYTES = 32 * 1024

interface CacheEntry {
  body: string
  expires: number
}

const cache = new Map<string, CacheEntry>()

function serveJson(res: ServerResponse, status: number, body: string, cached: boolean): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cached ? 'public, max-age=300' : 'no-cache',
  })
  res.end(body)
}

function storeCached(url: string, body: string): void {
  cache.set(url, { body, expires: Date.now() + CACHE_TTL_MS })
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (oldest.done) break
    cache.delete(oldest.value)
  }
}

/**
 * Web route handler: forward `/plugins/dsh-weather/api/{forecast|search}` to
 * the allowlisted upstream, passthrough the JSON body, cache for five minutes.
 * @param req - incoming HTTP request.
 * @param res - response owned by this handler.
 */
export async function weatherProxy(
  req: IncomingMessage,
  res: ServerResponse,
  settings: SettingsScope<WeatherSettings>,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x')
  const suffix = url.pathname.slice(PREFIX.length)
  const endpoint = suffix.replace(/^\/+|\/+$/g, '')
  if (endpoint === 'settings' && req.method === 'GET') {
    serveJson(res, 200, JSON.stringify({ ok: true, section: settings.get() }), false)
    return
  }
  if (endpoint === 'settings' && req.method === 'POST') {
    await writeSettings(req, res, settings)
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }
  // Accept "/forecast" and "/search" only; the trailing-slash spellings too.
  const upstream = UPSTREAMS[endpoint]
  if (upstream === undefined) {
    serveJson(res, 404, JSON.stringify({ error: 'unknown_endpoint', endpoint }), false)
    return
  }
  const target = `${upstream}${url.search}`
  const cached = cache.get(target)
  if (cached !== undefined && cached.expires > Date.now()) {
    serveJson(res, 200, cached.body, true)
    return
  }
  if (cached !== undefined) cache.delete(target)

  let response: Response
  try {
    response = await fetch(target, {
      headers: {
        accept: 'application/json',
        'user-agent': 'dsh-fun-weather/0.1 (harness plugin)',
      },
      signal: AbortSignal.timeout(12_000),
    })
  } catch (error) {
    serveJson(
      res,
      502,
      JSON.stringify({
        error: 'upstream_unreachable',
        message: error instanceof Error ? error.message : String(error),
      }),
      false,
    )
    return
  }
  const body = await response.text()
  if (!response.ok) {
    serveJson(res, response.status, body, false)
    return
  }
  storeCached(target, body)
  serveJson(res, 200, body, false)
}

/** Build the route registered by the Host plugin. */
export function createWeatherRoute(settings: SettingsScope<WeatherSettings>): WebRoute {
  return {
    kind: 'prefix',
    path: PREFIX,
    handler: (req, res) => { void weatherProxy(req, res, settings) },
  }
}

async function writeSettings(
  req: IncomingMessage,
  res: ServerResponse,
  settings: SettingsScope<WeatherSettings>,
): Promise<void> {
  try {
    const raw = await readJsonBody(req)
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      serveJson(res, 400, JSON.stringify({ ok: false, error: 'expected a JSON settings section' }), false)
      return
    }
    const section = WeatherSettingsSchema(raw as WeatherSettings)
    await settings.replace(section)
    serveJson(res, 200, JSON.stringify({ ok: true, section: settings.get() }), false)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    serveJson(
      res,
      message === 'request body too large' ? 413 : 400,
      JSON.stringify({ ok: false, error: message }),
      false,
    )
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text.trim() === '' ? undefined : JSON.parse(text) as unknown
}
