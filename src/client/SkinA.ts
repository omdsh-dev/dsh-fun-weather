/**
 * Weather skin, mode A: registers the five third-party weather themes
 * (`weather.sunny|cloudy|rain|snow|night`) once per module load, then
 * follows the current weather through `ctx.theme.setTheme` while the
 * settings switch is on. The yield rule: a manual theme pick outside the
 * weather.* family while following marks the user as owner — following stops
 * (persisted `skinOn=false`) and their pick stands; turning the switch off
 * restores the last user-owned preference. A page refresh restores the state
 * from the persisted settings and the freshly fetched weather.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the theme service merge (ctx.theme) and the 'theme/change' event.
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { ThemeDefinition, ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { WeatherSettings } from '../weather-settings.ts'
import { weatherFamily, type WeatherRuntime } from './weather.ts'

/** Id family this skin owns; nothing outside it is ever written by the skin. */
const THEME_PREFIX = 'weather.'

export const WEATHER_THEME_IDS = [
  'weather.sunny', 'weather.cloudy', 'weather.rain', 'weather.snow', 'weather.night',
] as const
export type WeatherThemeId = typeof WEATHER_THEME_IDS[number]

function isWeatherThemeId(id: string): boolean {
  return id.startsWith(THEME_PREFIX)
}

/**
 * The five registered theme definitions. Tokens override only existing
 * `--dsw-alias-*` / `--dsw-specific-*` names (design-platform.css); the base
 * palette the theme builds on is selected by `colorScheme`.
 */
const WEATHER_THEME_DEFINITIONS: readonly ThemeDefinition[] = Object.freeze([
  Object.freeze({
    id: 'weather.sunny' as const,
    colorScheme: 'light' as const,
    tokens: Object.freeze({
      '--dsw-alias-bg-base': '#FFF8EB',
      '--dsw-alias-bg-layer-1': '#FFFDF7',
      '--dsw-alias-bg-layer-2': '#FFF6E4',
      '--dsw-alias-bg-layer-3': '#FFEFD2',
      '--dsw-specific-sidebar-fill': '#FFEFD2',
      '--dsw-specific-sidebar-nav-item-hover': '#FFE9C2',
      '--dsw-specific-sidebar-nav-item-active': '#FFDFA6',
      '--dsw-specific-sidebar-nav-item-active-accent': '#F6B03B',
      '--dsw-alias-brand-primary': '#6B4200',
      '--dsw-alias-brand-text': '#6B4200',
      '--dsw-alias-label-primary': '#3F2D12',
      '--dsw-alias-label-secondary': '#8A6A3B',
      '--dsw-alias-label-tertiary': '#A98A5B',
      '--dsw-alias-state-business-primary': '#E8900C',
      '--dsw-alias-state-business-tertiary': '#FFE3B3',
      '--dsw-alias-button-info-fill': '#E8900C',
      '--dsw-alias-button-info-hover': '#F6B03B',
      '--dsw-alias-interactive-bg-hover': 'rgba(232, 144, 12, 0.08)',
      '--dsw-alias-interactive-bg-active': 'rgba(232, 144, 12, 0.14)',
    }),
  }),
  Object.freeze({
    id: 'weather.cloudy' as const,
    colorScheme: 'light' as const,
    tokens: Object.freeze({
      '--dsw-alias-bg-base': '#F3F5F8',
      '--dsw-alias-bg-layer-1': '#FBFCFE',
      '--dsw-alias-bg-layer-2': '#F1F4F7',
      '--dsw-alias-bg-layer-3': '#E9EDF2',
      '--dsw-specific-sidebar-fill': '#EBEFF4',
      '--dsw-specific-sidebar-nav-item-hover': '#E2E8EE',
      '--dsw-specific-sidebar-nav-item-active': '#D8E0E8',
      '--dsw-specific-sidebar-nav-item-active-accent': '#9AA7B5',
      '--dsw-alias-state-business-primary': '#64748B',
      '--dsw-alias-state-business-tertiary': '#DCE4EC',
      '--dsw-alias-button-info-fill': '#64748B',
      '--dsw-alias-button-info-hover': '#7A8B9E',
      '--dsw-alias-interactive-bg-hover': 'rgba(100, 116, 139, 0.08)',
      '--dsw-alias-interactive-bg-active': 'rgba(100, 116, 139, 0.14)',
    }),
  }),
  Object.freeze({
    id: 'weather.rain' as const,
    colorScheme: 'dark' as const,
    tokens: Object.freeze({
      '--dsw-alias-bg-base': '#0E1A2B',
      '--dsw-alias-bg-layer-1': '#132236',
      '--dsw-alias-bg-layer-2': '#182941',
      '--dsw-alias-bg-layer-3': '#1E3252',
      '--dsw-specific-sidebar-fill': '#0B1523',
      '--dsw-specific-sidebar-nav-item-hover': '#152338',
      '--dsw-specific-sidebar-nav-item-active': '#1D2F49',
      '--dsw-specific-sidebar-nav-item-active-accent': '#4A90D9',
      '--dsw-alias-brand-primary': '#BFDBFE',
      '--dsw-alias-brand-text': '#BFDBFE',
      '--dsw-alias-label-primary': '#E8F1FA',
      '--dsw-alias-label-primary-bluish': '#E8F1FA',
      '--dsw-alias-label-secondary': '#A9C1DA',
      '--dsw-alias-label-tertiary': '#7E9AB8',
      '--dsw-alias-state-business-primary': '#5AA3E8',
      '--dsw-alias-state-business-tertiary': '#16314E',
      '--dsw-alias-button-info-fill': '#4A90D9',
      '--dsw-alias-button-info-hover': '#5AA3E8',
      '--dsw-alias-button-primary-fill': '#7FB2F0',
      '--dsw-alias-button-primary-hover': '#9CC6F5',
      '--dsw-alias-button-primary-dimmed': '#1E3252',
      '--dsw-alias-button-contrast-fill': '#E8F1FA',
      '--dsw-alias-interactive-bg-hover': 'rgba(127, 178, 240, 0.12)',
      '--dsw-alias-interactive-bg-active': 'rgba(127, 178, 240, 0.2)',
      '--dsw-alias-interactive-bg-hover-accent': 'rgba(127, 178, 240, 0.24)',
      '--dsw-alias-scrollbar-bg-l1': '#22384F',
      '--dsw-alias-scrollbar-bg-l2': '#22384F',
      '--dsw-alias-scrollbar-hover-l1': '#2E4A68',
      '--dsw-alias-scrollbar-hover-l2': '#2E4A68',
    }),
  }),
  Object.freeze({
    id: 'weather.snow' as const,
    colorScheme: 'light' as const,
    tokens: Object.freeze({
      '--dsw-alias-bg-base': '#F4F8FB',
      '--dsw-alias-bg-layer-1': '#FFFFFF',
      '--dsw-alias-bg-layer-2': '#F0F5F9',
      '--dsw-alias-bg-layer-3': '#E6EDF3',
      '--dsw-specific-sidebar-fill': '#E9F0F5',
      '--dsw-specific-sidebar-nav-item-hover': '#DFE8EF',
      '--dsw-specific-sidebar-nav-item-active': '#D4E0E9',
      '--dsw-specific-sidebar-nav-item-active-accent': '#7B9DB8',
      '--dsw-alias-label-primary': '#101820',
      '--dsw-alias-label-secondary': '#4E6170',
      '--dsw-alias-state-business-primary': '#5B7C99',
      '--dsw-alias-state-business-tertiary': '#D8E3F0',
      '--dsw-alias-button-info-fill': '#5B7C99',
      '--dsw-alias-button-info-hover': '#7297B5',
    }),
  }),
  Object.freeze({
    id: 'weather.night' as const,
    colorScheme: 'dark' as const,
    tokens: Object.freeze({
      '--dsw-alias-bg-base': '#171226',
      '--dsw-alias-bg-layer-1': '#1D1730',
      '--dsw-alias-bg-layer-2': '#241D3B',
      '--dsw-alias-bg-layer-3': '#2B2347',
      '--dsw-specific-sidebar-fill': '#120E1F',
      '--dsw-specific-sidebar-nav-item-hover': '#1C1530',
      '--dsw-specific-sidebar-nav-item-active': '#261D40',
      '--dsw-specific-sidebar-nav-item-active-accent': '#7B6BD6',
      '--dsw-alias-brand-primary': '#D8D1F7',
      '--dsw-alias-brand-text': '#D8D1F7',
      '--dsw-alias-label-primary': '#EDE9FB',
      '--dsw-alias-label-primary-bluish': '#EDE9FB',
      '--dsw-alias-label-secondary': '#B3A8DE',
      '--dsw-alias-label-tertiary': '#8D83C4',
      '--dsw-alias-state-business-primary': '#8F7FE8',
      '--dsw-alias-state-business-tertiary': '#2C2350',
      '--dsw-alias-button-info-fill': '#7B6BD6',
      '--dsw-alias-button-info-hover': '#9385E4',
      '--dsw-alias-button-primary-fill': '#9F8FEF',
      '--dsw-alias-button-primary-hover': '#B7A9F5',
      '--dsw-alias-button-primary-dimmed': '#2B2347',
      '--dsw-alias-button-contrast-fill': '#EDE9FB',
      '--dsw-alias-interactive-bg-hover': 'rgba(159, 143, 239, 0.12)',
      '--dsw-alias-interactive-bg-active': 'rgba(159, 143, 239, 0.2)',
      '--dsw-alias-interactive-bg-hover-accent': 'rgba(159, 143, 239, 0.24)',
    }),
  }),
])

/**
 * Registration is idempotent per module load: `register` throws on a
 * duplicate id, so this guard absorbs a second apply of the same module
 * (plugin reload without page refresh) and keeps the disposers for the one
 * apply that owns them.
 */
let themeDisposers: readonly (() => void)[] | undefined

function ensureThemesRegistered(theme: Context['theme']): void {
  if (themeDisposers !== undefined) return
  try {
    themeDisposers = WEATHER_THEME_DEFINITIONS.map(definition => theme.register(definition))
  } catch {
    themeDisposers = []
  }
}

/**
 * Install the mode-A weather skin: register the themes once, then reconcile
 * following state against the persisted settings and the weather runtime.
 * @param ctx - client root context.
 * @param scope - this plugin's settings scope.
 * @param runtime - the root-scope weather runtime.
 */
export function installWeatherSkin(
  ctx: Context,
  scope: SettingsScope<WeatherSettings>,
  runtime: WeatherRuntime,
): void {
  ensureThemesRegistered(ctx.theme)
  const theme = ctx.theme
  let following = false
  /** Latest preference a user owned (never a weather.* id). */
  let lastUserPreference: string = 'system'

  const currentPreference = (): string => theme.getTheme().preference
  const initial = currentPreference()
  if (!isWeatherThemeId(initial)) lastUserPreference = initial

  const applyWeather = (): void => {
    if (!following) return
    const settings = scope.getSnapshot().value
    const data = runtime.getSnapshot().data
    if (settings === undefined || settings.skinMode !== 'A') return
    if (data === undefined) return
    const target = `${THEME_PREFIX}${weatherFamily(data.current.weatherCode, data.current.isDay)}`
    if (target !== currentPreference()) theme.setTheme(target)
  }

  const syncSettings = (): void => {
    const settings = scope.getSnapshot().value
    const want = settings?.skinOn === true
    if (want && !following) {
      following = true
      applyWeather()
    } else if (!want && following) {
      following = false
      const current = currentPreference()
      if (isWeatherThemeId(current)) theme.setTheme(lastUserPreference)
    } else if (want && following) {
      applyWeather()
    }
  }

  // The yield rule: a manual pick of a non-weather theme while following
  // means the user took over — stop following and persist the switch off.
  ctx.on('theme/change', (snapshot: ThemeSnapshot) => {
    const preference = snapshot.preference
    if (!isWeatherThemeId(preference)) {
      lastUserPreference = preference
      if (following) {
        following = false
        void scope.set('skinOn', false)
      }
    }
  })

  ctx.effect(() => scope.subscribe(syncSettings), 'dsh-weather: skin settings sync')
  ctx.effect(() => runtime.subscribe(applyWeather), 'dsh-weather: skin weather sync')
  ctx.effect(() => () => {
    const disposers = themeDisposers
    themeDisposers = undefined
    for (const dispose of disposers ?? []) dispose()
  }, 'dsh-weather: theme registration lifetime')
  syncSettings()
}
