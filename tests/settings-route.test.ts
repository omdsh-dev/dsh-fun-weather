import assert from 'node:assert/strict'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { describe, it } from 'node:test'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { weatherProxy } from '../src/proxy.ts'
import { DEFAULT_WEATHER_SETTINGS, type WeatherSettings } from '../src/weather-settings.ts'

function scope(): SettingsScope<WeatherSettings> {
  let value = { ...DEFAULT_WEATHER_SETTINGS }
  return {
    get: () => ({ ...value }),
    watch: () => () => {},
    update: async (patch) => { value = { ...value, ...patch } },
    replace: async (section) => { value = { ...DEFAULT_WEATHER_SETTINGS, ...section } },
  }
}

function request(method: string, url: string, body?: unknown): IncomingMessage {
  const chunks = body === undefined ? [] : [JSON.stringify(body)]
  return Object.assign(Readable.from(chunks), { method, url }) as unknown as IncomingMessage
}

function response(): { raw: ServerResponse; status: () => number; json: () => unknown } {
  let status = 0
  let body = ''
  const raw = {
    writeHead(next: number) { status = next; return this },
    end(chunk?: string) { body = chunk ?? '' },
  } as unknown as ServerResponse
  return { raw, status: () => status, json: () => JSON.parse(body) as unknown }
}

describe('plugin-owned settings route', () => {
  it('reads defaults without core allowlist support', async () => {
    const res = response()
    await weatherProxy(request('GET', '/plugins/dsh-weather/api/settings'), res.raw, scope())
    assert.equal(res.status(), 200)
    assert.deepEqual(res.json(), { ok: true, section: DEFAULT_WEATHER_SETTINGS })
  })

  it('validates and persists a complete section', async () => {
    const settings = scope()
    const res = response()
    const next: WeatherSettings = {
      ...DEFAULT_WEATHER_SETTINGS,
      city: 'Beijing',
      latitude: 39.9042,
      longitude: 116.4074,
      unit: 'fahrenheit',
    }
    await weatherProxy(request('POST', '/plugins/dsh-weather/api/settings', next), res.raw, settings)
    assert.equal(res.status(), 200)
    assert.deepEqual(res.json(), { ok: true, section: next })
    assert.deepEqual(settings.get(), next)
  })

  it('rejects invalid coordinates without calling Open-Meteo', async () => {
    const res = response()
    await weatherProxy(
      request('POST', '/plugins/dsh-weather/api/settings', { ...DEFAULT_WEATHER_SETTINGS, latitude: 120 }),
      res.raw,
      scope(),
    )
    assert.equal(res.status(), 400)
  })

  it('rejects unknown endpoints before any upstream call', async () => {
    const res = response()
    await weatherProxy(request('GET', '/plugins/dsh-weather/api/not-a-route'), res.raw, scope())
    assert.equal(res.status(), 404)
  })
})
