/**
 * Client-side settings model: the field-name constants, the bound scope
 * factory, and the city-selection write helpers (search pick + geolocation)
 * shared by the settings section, the view-tab guide, and the change-city
 * popover. Durable state lives in the Host `dsh-weather` settings namespace;
 * this module owns how the browser reaches it.
 */
import {
  createSnapshotStore, type SettingsScope, type SettingsScopeSnapshot, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import { DEFAULT_WEATHER_SETTINGS, type WeatherSettings } from '../weather-settings.ts'

export type { WeatherSettings, WeatherUnit, SkinMode } from '../weather-settings.ts'

/** Scalar field names of the durable section (the scope write surface). */
export const WEATHER_FIELDS = {
  city: 'city',
  latitude: 'latitude',
  longitude: 'longitude',
  unit: 'unit',
  skinOn: 'skinOn',
  skinMode: 'skinMode',
  intensity: 'intensity',
  refreshMinutes: 'refreshMinutes',
} as const

/** One geocoding hit (Open-Meteo geocoding API, via the proxy). */
export interface CityChoice {
  name: string
  latitude: number
  longitude: number
  country: string
}

interface SettingsResponse {
  ok: boolean
  section: WeatherSettings
}

/** Browser settings scope backed by this plugin's same-origin route. */
export class WeatherSettingsScope implements SettingsScope<WeatherSettings> {
  private readonly store: SnapshotStore<SettingsScopeSnapshot<WeatherSettings>>
  private tail: Promise<void> = Promise.resolve()
  private disposed = false
  private revision = 0

  constructor() {
    this.store = createSnapshotStore<SettingsScopeSnapshot<WeatherSettings>>({
      status: 'loading',
      value: undefined,
      base: DEFAULT_WEATHER_SETTINGS,
      user: undefined,
      revision: undefined,
      writable: false,
      mode: 'host',
    })
  }

  getSnapshot(): SettingsScopeSnapshot<WeatherSettings> {
    return this.store.getSnapshot()
  }

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener)
  }

  load(): Promise<void> {
    return this.enqueue(async () => {
      try {
        this.accept((await requestSettings()).section)
      } catch {
        if (!this.disposed) {
          this.store.update((draft) => { draft.status = 'unavailable'; draft.writable = false })
        }
      }
    })
  }

  set(field: string, value: unknown): Promise<void> {
    return this.write(field, value)
  }

  unset(field: string): Promise<void> {
    return this.write(field, DEFAULT_WEATHER_SETTINGS[field as keyof WeatherSettings])
  }

  dispose(): void {
    this.disposed = true
  }

  private write(field: string, value: unknown): Promise<void> {
    return this.enqueue(async () => {
      const current = this.getSnapshot().value ?? DEFAULT_WEATHER_SETTINGS
      const next = { ...current, [field]: value }
      try {
        this.accept((await requestSettings(next)).section)
      } catch {
        try {
          this.accept((await requestSettings()).section)
        } catch {
          // Preserve the last accepted section when recovery also fails.
        }
      }
    })
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const task = this.tail.then(async () => {
      if (!this.disposed) await operation()
    })
    this.tail = task.catch(() => {})
    return task
  }

  private accept(section: WeatherSettings): void {
    if (this.disposed) return
    this.revision += 1
    this.store.update((draft) => {
      draft.status = 'ready'
      draft.value = section
      draft.user = section
      draft.revision = this.revision
      draft.writable = true
    })
  }
}

/** Create this plugin's self-contained durable settings transport. */
export function bindWeatherSettings(): WeatherSettingsScope {
  return new WeatherSettingsScope()
}

async function requestSettings(section?: WeatherSettings): Promise<SettingsResponse> {
  const response = await fetch('/plugins/dsh-weather/api/settings', section === undefined ? undefined : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(section),
  })
  if (!response.ok) throw new Error(`weather settings ${String(response.status)}`)
  const payload = await response.json() as SettingsResponse
  if (!payload.ok || typeof payload.section !== 'object' || payload.section === null) {
    throw new Error('weather settings rejected')
  }
  return payload
}

/** Write one manual city pick into the durable section. */
export function pickCity(scope: SettingsScope<WeatherSettings>, choice: CityChoice): Promise<void> {
  return Promise.all([
    scope.set(WEATHER_FIELDS.city, choice.name),
    scope.set(WEATHER_FIELDS.latitude, choice.latitude),
    scope.set(WEATHER_FIELDS.longitude, choice.longitude),
  ]).then(() => {})
}

/** Search cities through the proxy-backed geocoding endpoint. */
export async function searchCities(query: string): Promise<CityChoice[]> {
  const params = new URLSearchParams({ name: query, count: '6', language: 'zh' })
  const response = await fetch(`/plugins/dsh-weather/api/search?${params.toString()}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload: unknown = await response.json()
  if (typeof payload !== 'object' || payload === null) return []
  const results = (payload as { results?: unknown }).results
  if (!Array.isArray(results)) return []
  const cities: CityChoice[] = []
  for (const item of results) {
    if (typeof item !== 'object' || item === null) continue
    const row = item as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name : ''
    const latitude = typeof row.latitude === 'number' ? row.latitude : 0
    const longitude = typeof row.longitude === 'number' ? row.longitude : 0
    const country = typeof row.country === 'string' ? row.country : ''
    if (name === '') continue
    cities.push({ name, latitude, longitude, country })
  }
  return cities
}

/** Browser geolocation, normalized to a {@link CityChoice} with a stable name. */
export function locateCity(localeName: string): Promise<CityChoice> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
      reject(new Error('geolocation unavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          name: localeName,
          latitude: Number(position.coords.latitude.toFixed(4)),
          longitude: Number(position.coords.longitude.toFixed(4)),
          country: '',
        })
      },
      (error) => {
        reject(error.code === 1 ? new Error('denied') : new Error('failed'))
      },
      { timeout: 10_000, maximumAge: 300_000 },
    )
  })
}
