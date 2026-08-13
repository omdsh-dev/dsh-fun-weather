/**
 * Weather plugin, browser half: registers the conversation weather tab and
 * the settings section, and installs the two weather skins over one shared
 * root-scope runtime (the settings scope + the Open-Meteo data owner).
 * Cross-plugin collaboration goes through cordis services only — `theme` for
 * skin A and `slots` for the tab/section. Durable settings use this plugin's
 * own same-origin route.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the settings shell's SlotMap merge ('settings.section').
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the conversation package's SlotMap merge ('conversation.view').
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the theme service merge (ctx.theme, 'theme/change').
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { NS, zh, en } from './locales.ts'
import { SettingsSection, type SettingsSectionInjected } from './SettingsSection.tsx'
import { installWeatherSkin } from './SkinA.ts'
import { installWallpaper } from './SkinB.tsx'
import { bindWeatherSettings } from './store.ts'
import { WeatherRuntime } from './weather.ts'
import { WeatherView, type WeatherViewInjected } from './WeatherView.tsx'

export { NS } from './locales.ts'
export { WeatherRuntime, iconKey, weatherFamily, particleKind } from './weather.ts'
export { WEATHER_FIELDS, searchCities, locateCity, pickCity, bindWeatherSettings } from './store.ts'
export type { CityChoice } from './store.ts'

/**
 * Required services. `theme` is provided by ui-theme's client half, whose
 * module activation order is declared in the package.json `dsh.client.inject`
 * edge list.
 */
export const inject = ['slots', 'locale', 'theme']

/**
 * Client plugin body: dictionaries, the shared runtime, both skins, and the
 * two slot registrations (weather tab + settings section).
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-weather: copy dictionaries')

  const scope = bindWeatherSettings()
  ctx.effect(() => {
    void scope.load()
    return () => { scope.dispose() }
  }, 'dsh-weather: settings scope')
  const runtime = new WeatherRuntime(ctx, scope)
  installWeatherSkin(ctx, scope, runtime)
  installWallpaper(ctx, scope, runtime)

  const t = ctx.locale.bind(NS)

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'dsh-weather',
    order: 20,
    locale: NS,
    label: () => t('view.tab'),
    inject: (): WeatherViewInjected => ({
      hooks: { weather: runtime, settings: scope },
      scope,
      refresh: () => { runtime.refresh() },
      locale: () => ctx.locale.getSnapshot().active,
    }),
  }, WeatherView))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'weather',
    order: 30,
    label: () => t('settings.nav'),
    inject: (): SettingsSectionInjected => ({
      hooks: { settings: scope },
      scope,
      t,
    }),
  }, SettingsSection))
}
