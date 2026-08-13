/**
 * Host registration for the weather plugin: the durable `dsh-weather`
 * settings namespace plus the same-origin proxy route the browser bundle
 * requests for Open-Meteo data. Both registrations ride lazy `ctx.inject`,
 * so this row composes against any host carrying `settings` and `webServer`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { createWeatherRoute } from './proxy.ts'
import { WEATHER_SETTINGS_NAMESPACE, WeatherSettingsSchema } from './weather-settings.ts'

export { WEATHER_SETTINGS_NAMESPACE, DEFAULT_WEATHER_SETTINGS, WEATHER_UNITS, SKIN_MODES } from './weather-settings.ts'
export type { WeatherSettings, WeatherUnit, SkinMode } from './weather-settings.ts'

/** Host-side services are resolved lazily inside `apply` (see ui-theme). */
export const inject: string[] = []

/**
 * Register the durable settings section and the weather data proxy route.
 * @param ctx - host context that may acquire settings and HTTP services.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings', 'webServer'], (host) => {
    const scope = host.settings.register(
      settingsNamespace(WEATHER_SETTINGS_NAMESPACE),
      WeatherSettingsSchema,
    )
    host.effect(
      () => host.webServer.register(createWeatherRoute(scope)),
      'dsh-weather: HTTP routes',
    )
  })
}
