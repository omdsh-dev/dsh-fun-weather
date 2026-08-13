/**
 * The settings panel section: city configuration (search + geolocation),
 * temperature unit, and the weather-skin preference (switch, mode A/B, and
 * wallpaper particle intensity) plus the refresh interval. Every control
 * writes the durable `dsh-weather` namespace through the bound scope; when
 * the namespace is not exposed (e.g. before a host restart picks up the
 * api-proxy allowlist change), the section shows an explanation instead.
 */
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { hasLocation, type WeatherSettings, type SkinMode } from '../weather-settings.ts'
import { CityPicker } from './CityPicker.tsx'
import { NS } from './locales.ts'
import { WEATHER_FIELDS } from './store.ts'
import css from './SettingsSection.module.css'

/** Business face injected into the section entry. */
export interface SettingsSectionInjected {
  hooks: {
    settings: SettingsScope<WeatherSettings>
  }
  /** The bound scope, handed to the city picker for writes. */
  scope: SettingsScope<WeatherSettings>
  t: TranslateNS<typeof NS>
}

/** Full composed props: the section slot's standard kit + the inject face. */
export type SettingsSectionProps = PropsRuntime<'settings.section'> & InjectFace<SettingsSectionInjected>

const REFRESH_CHOICES = [15, 30, 60, 120] as const

/**
 * Render the weather settings section.
 * @param props - composed slot props.
 * @returns the section body.
 */
export function SettingsSection(props: SettingsSectionProps) {
  const { t, useSettings } = props
  const snapshot = useSettings(state => state)
  const settings = snapshot.value

  if (snapshot.status === 'unavailable') {
    return (
      <div className={css.section}>
        <div className={css.notice}>{t('settings.unavailable')}</div>
      </div>
    )
  }
  if (settings === undefined) {
    return <div className={css.section} />
  }
  const scope = props.scope
  const set = (field: string, value: unknown): void => { void scope.set(field, value) }

  return (
    <div className={css.section}>
      <h3 className={css.groupTitle}>{t('settings.locationTitle')}</h3>
      <p className={css.groupHint}>{t('settings.locationHint')}</p>
      {hasLocation(settings) && (
        <div className={css.current}>
          <span>{t('settings.current')}</span>
          <span className={css.currentValue}>
            {settings.city} ({settings.latitude.toFixed(1)}, {settings.longitude.toFixed(1)})
          </span>
        </div>
      )}
      <CityPicker scope={scope} t={t} />

      <h3 className={css.groupTitle}>{t('settings.unitTitle')}</h3>
      <div className={css.segment}>
        <button
          type="button"
          className={settings.unit === 'celsius' ? css.segmentActive : css.segmentCell}
          onClick={() => { set(WEATHER_FIELDS.unit, 'celsius') }}
        >
          °C
        </button>
        <button
          type="button"
          className={settings.unit === 'fahrenheit' ? css.segmentActive : css.segmentCell}
          onClick={() => { set(WEATHER_FIELDS.unit, 'fahrenheit') }}
        >
          °F
        </button>
      </div>

      <label className={css.switchRow}>
        <input
          type="checkbox"
          checked={settings.skinOn}
          onChange={(event) => { set(WEATHER_FIELDS.skinOn, event.target.checked) }}
        />
        <span className={css.switchLabel}>{t('settings.skinTitle')}</span>
      </label>
      <p className={css.groupHint}>{t('settings.skinHint')}</p>
      {settings.skinOn && (
        <div className={css.skinOptions}>
          <div className={css.segment}>
            <button
              type="button"
              className={settings.skinMode === 'A' ? css.segmentActive : css.segmentCell}
              onClick={() => { set(WEATHER_FIELDS.skinMode, 'A' satisfies SkinMode) }}
            >
              {t('settings.skinModeA')}
            </button>
            <button
              type="button"
              className={settings.skinMode === 'B' ? css.segmentActive : css.segmentCell}
              onClick={() => { set(WEATHER_FIELDS.skinMode, 'B' satisfies SkinMode) }}
            >
              {t('settings.skinModeB')}
            </button>
          </div>
          {settings.skinMode === 'B' && (
            <label className={css.sliderRow}>
              <span>{t('settings.intensity')}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.intensity}
                onChange={(event) => { set(WEATHER_FIELDS.intensity, Number(event.target.value)) }}
              />
              <span className={css.sliderValue}>{Math.round(settings.intensity * 100)}%</span>
            </label>
          )}
        </div>
      )}

      <h3 className={css.groupTitle}>{t('settings.refreshTitle')}</h3>
      <div className={css.segment}>
        {REFRESH_CHOICES.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={settings.refreshMinutes === minutes ? css.segmentActive : css.segmentCell}
            onClick={() => { set(WEATHER_FIELDS.refreshMinutes, minutes) }}
          >
            {t('settings.refreshMinutes', { minutes })}
          </button>
        ))}
      </div>
    </div>
  )
}
