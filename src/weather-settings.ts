/**
 * Durable settings model shared by the Host schema registration and the
 * browser settings scope: the `dsh-weather` namespace carries the selected
 * city (display name + coordinates), display unit, and the weather-skin
 * preference (mode A = theme, mode B = wallpaper, plus intensity).
 */
import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by this plugin (exposed via the api-proxy allowlist). */
export const WEATHER_SETTINGS_NAMESPACE = 'dsh-weather'

/** Display temperature units. */
export const WEATHER_UNITS = ['celsius', 'fahrenheit'] as const
export type WeatherUnit = typeof WEATHER_UNITS[number]

/** Weather-skin presentation modes: A = third-party theme, B = wallpaper layer. */
export const SKIN_MODES = ['A', 'B'] as const
export type SkinMode = typeof SKIN_MODES[number]

/** Durable section shared by the Host schema and the browser scope. */
export interface WeatherSettings {
  /** Display name of the selected city (set for both manual picks and geolocation). */
  city: string
  /** Latitude in degrees; a city is configured only when `city` is non-empty. */
  latitude: number
  /** Longitude in degrees; a city is configured only when `city` is non-empty. */
  longitude: number
  /** Temperature display unit. */
  unit: WeatherUnit
  /** Follow-the-weather skin master switch. */
  skinOn: boolean
  /** Which skin presentation to use while `skinOn`. */
  skinMode: SkinMode
  /** Wallpaper particle intensity (0-1). */
  intensity: number
  /** Forecast refresh interval in minutes. */
  refreshMinutes: number
}

/** Default section used when the user-settings document has no override. */
export const DEFAULT_WEATHER_SETTINGS: WeatherSettings = {
  city: '',
  latitude: 0,
  longitude: 0,
  unit: 'celsius',
  skinOn: false,
  skinMode: 'A',
  intensity: 0.6,
  refreshMinutes: 30,
}

/** Durable section schema; also the wire envelope the browser scope validates against. */
export const WeatherSettingsSchema: z<WeatherSettings> = z.object({
  city: z.string().default(DEFAULT_WEATHER_SETTINGS.city),
  latitude: z.number().min(-90).max(90).default(DEFAULT_WEATHER_SETTINGS.latitude),
  longitude: z.number().min(-180).max(180).default(DEFAULT_WEATHER_SETTINGS.longitude),
  unit: z.union([z.const('celsius'), z.const('fahrenheit')]).default(DEFAULT_WEATHER_SETTINGS.unit),
  skinOn: z.boolean().default(DEFAULT_WEATHER_SETTINGS.skinOn),
  skinMode: z.union([z.const('A'), z.const('B')]).default(DEFAULT_WEATHER_SETTINGS.skinMode),
  intensity: z.percent().default(DEFAULT_WEATHER_SETTINGS.intensity),
  refreshMinutes: z.natural().min(5).max(1440).default(DEFAULT_WEATHER_SETTINGS.refreshMinutes),
})

/** Whether the stored section names a usable location. */
export function hasLocation(settings: WeatherSettings): boolean {
  return settings.city.length > 0
}
