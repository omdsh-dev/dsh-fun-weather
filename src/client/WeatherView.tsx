/**
 * The weather conversation tab: current conditions with an animated icon,
 * a 7-day strip, and a scrollable 24-hour strip. Empty state renders an
 * inline city guide (search + geolocation) plus a best-effort jump to the
 * settings panel; failures render a retry card while skins keep their last
 * good data (the runtime retains it).
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { hasLocation, type WeatherSettings } from '../weather-settings.ts'
import { CityPicker } from './CityPicker.tsx'
import { NS } from './locales.ts'
import { WeatherIcon } from './WeatherIcons.tsx'
import {
  convertTemperature, convertWindSpeed, hourLabel, iconKey, weekdayLabel, windDirectionLabel,
  type WeatherRuntime,
} from './weather.ts'
import css from './WeatherView.module.css'

/** Business face injected into the view entry (settings + weather observables). */
export interface WeatherViewInjected {
  hooks: {
    weather: WeatherRuntime
    settings: SettingsScope<WeatherSettings>
  }
  /** The bound scope, handed to the inline city pickers for writes. */
  scope: SettingsScope<WeatherSettings>
  /** Manual refetch (retry button). */
  refresh: () => void
  /** Current locale id for weekday/wind localization. */
  locale: () => string
}

/** Full composed props: the view slot's standard kit + inject face + locale seat. */
export type WeatherViewProps =
  & PropsRuntime<'conversation.view'>
  & InjectFace<WeatherViewInjected>
  & PropsLocale<typeof NS>

/** Zero-padded clock label for the "updated at" line. */
function clockLabel(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Render the weather tab.
 * @param props - composed slot props.
 * @returns the tab body.
 */
export function WeatherView(props: WeatherViewProps) {
  const { t, useWeather, useSettings, scope, refresh, locale } = props
  const weather = useWeather(snapshot => snapshot)
  const settingsSnapshot = useSettings(snapshot => snapshot)
  const [pickerOpen, setPickerOpen] = useState(false)
  const settings = settingsSnapshot.value

  const openSettingsPanel = (): void => {
    // Best-effort jump to the settings panel: the settings shell owns its
    // open state internally and exposes no service, so reach its trigger.
    document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click()
  }

  let body: ReactNode
  if (settingsSnapshot.status === 'unavailable') {
    body = (
      <section className={css.card}>
        <div className={css.notice}>{t('settings.unavailable')}</div>
      </section>
    )
  } else if (settings === undefined) {
    body = (
      <section className={css.card}>
        <div className={css.loading}>{t('view.loading')}</div>
      </section>
    )
  } else if (!hasLocation(settings)) {
    body = (
      <section className={css.card}>
        <h2 className={css.emptyTitle}>{t('view.emptyTitle')}</h2>
        <p className={css.emptyHint}>{t('view.emptyHint')}</p>
        <CityPicker scope={scope} t={t} autoFocus />
        <div className={css.emptyActions}>
          <Button variant="primary" size="sm" onClick={openSettingsPanel}>{t('view.openSettings')}</Button>
        </div>
      </section>
    )
  } else if (weather.data === undefined) {
    body = (
      <section className={css.card}>
        {weather.status === 'error'
          ? (
            <div className={css.error}>
              <div className={css.errorTitle}>{t('view.errorTitle')}</div>
              {weather.error !== undefined && <div className={css.errorDetail}>{weather.error}</div>}
              <Button variant="outline" size="sm" onClick={refresh}>{t('view.retry')}</Button>
            </div>
          )
          : <div className={css.loading}>{t('view.loading')}</div>}
      </section>
    )
  } else {
    const data = weather.data
    const unit = settings.unit
    const currentLocale = locale()
    const windValue = `${convertWindSpeed(data.current.windSpeed, unit)} ${unit === 'fahrenheit' ? 'mph' : 'km/h'}`
    body = (
      <div className={css.content}>
        <section className={css.hero}>
          <div className={css.heroTop}>
            <h2 className={css.city}>
              {settings.city}
              <span className={css.coords}>
                ({settings.latitude.toFixed(1)}, {settings.longitude.toFixed(1)})
              </span>
            </h2>
            <div className={css.heroActions}>
              <Button size="sm" variant="ghost" onClick={() => { setPickerOpen(open => !open) }}>
                {t('city.change')}
              </Button>
            </div>
          </div>
          {pickerOpen && (
            <div className={css.pickerPanel}>
              <CityPicker scope={scope} t={t} autoFocus onPicked={() => { setPickerOpen(false) }} />
            </div>
          )}
          <div className={css.heroBody}>
            <WeatherIcon
              name={iconKey(data.current.weatherCode, data.current.isDay)}
              size={84}
              className={css.heroIcon}
            />
            <div className={css.heroTemp}>{convertTemperature(data.current.temperature, unit)}°</div>
            <div className={css.heroStats}>
              <span>{t('view.feelsLike', { value: `${convertTemperature(data.current.apparentTemperature, unit)}°` })}</span>
              <span>{t('view.wind', { dir: windDirectionLabel(data.current.windDirection, currentLocale), value: windValue })}</span>
              <span>{t('view.humidity', { value: Math.round(data.current.humidity) })}</span>
            </div>
          </div>
          <div className={css.heroFoot}>
            {weather.updatedAt !== undefined && t('view.updatedAt', { time: clockLabel(weather.updatedAt) })}
            {weather.error !== undefined && (
              <button type="button" className={css.retryLink} onClick={refresh}>
                {t('view.errorTitle')} · {t('view.retry')}
              </button>
            )}
          </div>
        </section>

        <section className={css.card}>
          <h3 className={css.sectionTitle}>{t('view.daily')}</h3>
          <div className={css.daily}>
            {data.daily.map((row, index) => (
              <div key={row.date} className={index === 0 ? css.dayCardActive : css.dayCard}>
                <span className={css.dayLabel}>{index === 0 ? t('view.today') : weekdayLabel(row.date, currentLocale)}</span>
                <WeatherIcon name={iconKey(row.weatherCode, true)} size={26} />
                <span className={css.dayTemp}>{convertTemperature(row.tempMax, unit)}°</span>
                <span className={css.dayTempLow}>{convertTemperature(row.tempMin, unit)}°</span>
                <div className={css.barTrack}>
                  <div className={css.barFill} style={{ height: `${Math.min(100, Math.max(6, row.precipProb))}%` }} />
                </div>
                <span className={css.precipLabel}>{t('view.precip', { value: row.precipProb })}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={css.card}>
          <h3 className={css.sectionTitle}>{t('view.hourly')}</h3>
          <div className={css.hourly}>
            {data.hourly.slice(0, 24).map((hour) => (
              <div key={hour.time} className={css.hourCard}>
                <span className={css.hourLabel}>{hourLabel(hour.time)}</span>
                <WeatherIcon name={iconKey(hour.weatherCode, data.current.isDay)} size={24} />
                <span className={css.hourTemp}>{convertTemperature(hour.temperature, unit)}°</span>
                <span className={css.hourPrecip}>{hour.precipProb}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  return <div className={css.view}>{body}</div>
}
