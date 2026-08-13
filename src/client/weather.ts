/**
 * Root-scope weather runtime: fetches Open-Meteo forecast data through the
 * plugin's same-origin proxy, refreshes on the configured interval, and
 * publishes snapshots the view tab and both skins subscribe to. Fetching
 * lives at root scope (not inside the session view) so the skins keep
 * working while the weather tab is closed; the last good dataset is retained
 * on failure so skins never blank out on a transient network error.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {
  SettingsScope,
} from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { WeatherIconKey } from './WeatherIcons.tsx'
import { hasLocation, type WeatherSettings } from '../weather-settings.ts'

/** One current-conditions record (unit-normalized later at render time). */
export interface CurrentWeather {
  time: string
  temperature: number
  apparentTemperature: number
  humidity: number
  windSpeed: number
  windDirection: number
  weatherCode: number
  isDay: boolean
}

/** One daily forecast row. */
export interface DailyRow {
  date: string
  weatherCode: number
  tempMax: number
  tempMin: number
  precipProb: number
}

/** One hourly forecast row. */
export interface HourlyRow {
  time: string
  temperature: number
  precipProb: number
  weatherCode: number
}

/** The forecast payload the UI renders. */
export interface ForecastData {
  latitude: number
  longitude: number
  timezone: string
  current: CurrentWeather
  daily: DailyRow[]
  hourly: HourlyRow[]
}

/** Immutable weather runtime state published to every subscriber. */
export interface WeatherSnapshot {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Last good dataset; retained across errors so skins keep their state. */
  data: ForecastData | undefined
  error: string | undefined
  updatedAt: number | undefined
}

/** Weather codes families used by icon/skin mapping (WMO weather_code). */
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86])

/** Icon key for a WMO code and day/night flag. */
export function iconKey(code: number, isDay: boolean): WeatherIconKey {
  if (!isDay) {
    if (RAIN_CODES.has(code)) return 'night_rain'
    if (SNOW_CODES.has(code)) return 'snow'
    return code <= 1 ? 'night_clear' : 'night_partly'
  }
  if (code === 0) return 'sunny'
  if (code === 1 || code === 2) return 'partly_cloudy_day'
  if (code === 3) return 'overcast'
  if (code === 45 || code === 48) return 'fog'
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return 'drizzle'
  if (code === 61 || code === 63) return 'rain'
  if (code === 65 || code === 66 || code === 67) return 'rain_heavy'
  if (code === 71 || code === 73 || code === 75 || code === 77) return 'snow'
  if (code === 85) return 'snow_showers'
  if (code === 86) return 'snow'
  if (code === 80 || code === 81) return 'rain'
  if (code === 82) return 'rain_heavy'
  if (code >= 95) return 'thunderstorm'
  return 'cloudy'
}

/** Weather kind for the wallpaper particle system. */
export type WeatherParticleKind = 'flares' | 'drift' | 'rain' | 'snow' | 'stars'

/** Particle kind for a WMO code and day/night flag (used by SkinB). */
export function particleKind(code: number, isDay: boolean): WeatherParticleKind {
  if (!isDay) return 'stars'
  if (code === 0) return 'flares'
  if (RAIN_CODES.has(code)) return 'rain'
  if (SNOW_CODES.has(code)) return 'snow'
  return 'drift'
}

/** Weather family for the SkinA theme mapping. */
export type WeatherFamily = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'night'

/** SkinA theme family for a WMO code and day/night flag. */
export function weatherFamily(code: number, isDay: boolean): WeatherFamily {
  if (!isDay) return 'night'
  if (code === 0) return 'sunny'
  if (RAIN_CODES.has(code)) return 'rain'
  if (SNOW_CODES.has(code)) return 'snow'
  return 'cloudy'
}

const API_PREFIX = '/plugins/dsh-weather/api'

/** Build the forecast query string (all parameters are allowlisted upstream). */
function forecastUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_direction_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    timezone: 'auto',
    forecast_days: '7',
  })
  return `${API_PREFIX}/forecast?${params.toString()}`
}

/** Read a numeric array field defensively (the proxy relays raw upstream JSON). */
function readNumbers(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : []
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** Parse the Open-Meteo JSON envelope into the typed forecast. */
function parseForecast(payload: unknown): ForecastData | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const root = payload as Record<string, unknown>
  const current = (root.current ?? {}) as Record<string, unknown>
  const daily = (root.daily ?? {}) as Record<string, unknown>
  const hourly = (root.hourly ?? {}) as Record<string, unknown>
  const dailyTime = readStrings(daily.time)
  const dailyCode = readNumbers(daily.weather_code)
  const dailyMax = readNumbers(daily.temperature_2m_max)
  const dailyMin = readNumbers(daily.temperature_2m_min)
  const dailyPrecip = readNumbers(daily.precipitation_probability_max)
  const hourlyTime = readStrings(hourly.time)
  const hourlyTemp = readNumbers(hourly.temperature_2m)
  const hourlyPrecip = readNumbers(hourly.precipitation_probability)
  const hourlyCode = readNumbers(hourly.weather_code)
  if (dailyTime.length === 0 || hourlyTime.length === 0) return undefined
  const rows: DailyRow[] = []
  const rowCount = Math.min(dailyTime.length, dailyCode.length, dailyMax.length, dailyMin.length, dailyPrecip.length)
  for (let index = 0; index < rowCount; index += 1) {
    rows.push({
      date: dailyTime[index]!,
      weatherCode: dailyCode[index] ?? 0,
      tempMax: dailyMax[index] ?? 0,
      tempMin: dailyMin[index] ?? 0,
      precipProb: dailyPrecip[index] ?? 0,
    })
  }
  const hours: HourlyRow[] = []
  const hourCount = Math.min(hourlyTime.length, hourlyTemp.length, hourlyPrecip.length, hourlyCode.length)
  for (let index = 0; index < hourCount; index += 1) {
    hours.push({
      time: hourlyTime[index]!,
      temperature: hourlyTemp[index] ?? 0,
      precipProb: hourlyPrecip[index] ?? 0,
      weatherCode: hourlyCode[index] ?? 0,
    })
  }
  return {
    latitude: typeof root.latitude === 'number' ? root.latitude : 0,
    longitude: typeof root.longitude === 'number' ? root.longitude : 0,
    timezone: typeof root.timezone === 'string' ? root.timezone : '',
    current: {
      time: typeof current.time === 'string' ? current.time : '',
      temperature: typeof current.temperature_2m === 'number' ? current.temperature_2m : 0,
      apparentTemperature: typeof current.apparent_temperature === 'number' ? current.apparent_temperature : 0,
      humidity: typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : 0,
      windSpeed: typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 0,
      windDirection: typeof current.wind_direction_10m === 'number' ? current.wind_direction_10m : 0,
      weatherCode: typeof current.weather_code === 'number' ? current.weather_code : 0,
      isDay: current.is_day === 1 || current.is_day === true,
    },
    daily: rows,
    hourly: hours,
  }
}

const IDLE_SNAPSHOT: WeatherSnapshot = Object.freeze({
  status: 'idle', data: undefined, error: undefined, updatedAt: undefined,
})

/**
 * Root-scope weather data owner. One instance per plugin apply, shared by
 * the view tab and both skins through slot inject `hooks` compartments
 * (getSnapshot/subscribe — the framework synthesizes selector hooks).
 */
export class WeatherRuntime {
  #store: SnapshotStore<WeatherSnapshot>
  #timer: number | undefined
  #scheduleKey: string | undefined
  #fetching = false
  #disposed = false

  constructor(
    ctx: Context,
    readonly scope: SettingsScope<WeatherSettings>,
  ) {
    this.#store = createSnapshotStore<WeatherSnapshot>({ ...IDLE_SNAPSHOT })
    ctx.effect(() => scope.subscribe(() => { this.sync() }), 'dsh-weather: settings sync')
    ctx.effect(() => () => { this.dispose() }, 'dsh-weather: runtime lifetime')
    this.sync()
  }

  getSnapshot(): WeatherSnapshot {
    return this.#store.getSnapshot()
  }

  subscribe(listener: () => void): () => void {
    return this.#store.subscribe(listener)
  }

  /** Re-fetch now (retry button, manual refresh). */
  refresh(): void {
    void this.fetch()
  }

  sync(): void {
    const snapshot = this.scope.getSnapshot()
    const settings = snapshot.value
    if (settings === undefined || !hasLocation(settings)) {
      this.stopTimer()
      this.#store.update((draft) => {
        draft.status = 'idle'
        draft.data = undefined
        draft.error = undefined
        draft.updatedAt = undefined
      })
      return
    }
    const minutes = Math.min(1440, Math.max(5, settings.refreshMinutes))
    const key = `${settings.latitude.toFixed(3)},${settings.longitude.toFixed(3)}@${minutes}m`
    if (key === this.#scheduleKey) return
    this.#scheduleKey = key
    this.stopTimer()
    this.#timer = window.setInterval(() => { void this.fetch() }, minutes * 60_000)
    void this.fetch()
  }

  async fetch(): Promise<void> {
    if (this.#disposed || this.#fetching) return
    const settings = this.scope.getSnapshot().value
    if (settings === undefined || !hasLocation(settings)) return
    this.#fetching = true
    this.#store.update((draft) => {
      if (draft.status !== 'ready') draft.status = 'loading'
    })
    try {
      const response = await fetch(forecastUrl(settings.latitude, settings.longitude), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload: unknown = await response.json()
      const data = parseForecast(payload)
      if (data === undefined) throw new Error('unexpected forecast payload')
      this.#store.update((draft) => {
        draft.status = 'ready'
        draft.data = data
        draft.error = undefined
        draft.updatedAt = Date.now()
      })
    } catch (error) {
      this.#store.update((draft) => {
        // Keep the last good dataset: skins must survive a failed refresh.
        draft.status = draft.data === undefined ? 'error' : 'ready'
        draft.error = error instanceof Error ? error.message : String(error)
      })
    } finally {
      this.#fetching = false
    }
  }

  stopTimer(): void {
    if (this.#timer !== undefined) {
      window.clearInterval(this.#timer)
      this.#timer = undefined
    }
  }

  dispose(): void {
    this.#disposed = true
    this.stopTimer()
  }
}

/** 16-point compass name for a wind direction in degrees. */
export function windDirectionLabel(degrees: number, locale: string): string {
  const index = Math.round(((degrees % 360) / 22.5)) % 16
  const zhNames = ['北', '北东北', '东北', '东东北', '东', '东东南', '东南', '南东南', '南', '南西南', '西南', '西西南', '西', '西西北', '西北', '北西北']
  const enNames = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return locale === 'zh' ? zhNames[index]! : enNames[index]!
}

/** Celsius → display value in the active unit (fahrenheit support). */
export function convertTemperature(celsius: number, unit: WeatherSettings['unit']): number {
  return unit === 'fahrenheit' ? Math.round(celsius * 9 / 5 + 32) : Math.round(celsius)
}

/** km/h → display value in the active unit (mph support). */
export function convertWindSpeed(kmh: number, unit: WeatherSettings['unit']): number {
  return unit === 'fahrenheit' ? Math.round(kmh * 0.621371) : Math.round(kmh)
}

/** Hour label from an ISO-like local hour string ("2025-08-13T14:00"). */
export function hourLabel(time: string): string {
  const hour = Number(time.slice(11, 13))
  return `${String(hour).padStart(2, '0')}:00`
}

/** Weekday label from a "YYYY-MM-DD" date string. */
export function weekdayLabel(date: string, locale: string): string {
  const parts = date.split('-').map(Number)
  const day = new Date(parts[0] ?? 2000, (parts[1] ?? 1) - 1, parts[2] ?? 1)
  const names = locale === 'zh'
    ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return names[day.getDay()] ?? ''
}
