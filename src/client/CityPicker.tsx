/**
 * Shared city configuration control: debounced geocoding search plus browser
 * geolocation. Used by the settings section, the view-tab empty guide, and
 * the change-city popover; every pick writes the durable settings fields
 * through the bound scope.
 */
import { useEffect, useRef, useState } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WeatherSettings } from '../weather-settings.ts'
import { NS } from './locales.ts'
import { locateCity, pickCity, searchCities, type CityChoice } from './store.ts'
import css from './CityPicker.module.css'

export interface CityPickerProps {
  scope: SettingsScope<WeatherSettings>
  t: TranslateNS<typeof NS>
  /** Called after a pick (search result or geolocation) lands. */
  onPicked?: (choice: CityChoice) => void
  /** Start with the search input auto-focused. */
  autoFocus?: boolean
}

/**
 * Render the search input, locate button, and the result dropdown.
 * @param props - scope + translate seats.
 * @returns the picker element tree.
 */
export function CityPicker({ scope, t, onPicked, autoFocus }: CityPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CityChoice[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const generation = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      generation.current += 1
      setResults([])
      setSearching(false)
      return
    }
    const mine = ++generation.current
    setSearching(true)
    const handle = window.setTimeout(() => {
      void searchCities(trimmed).then(
        (cities) => {
          if (generation.current !== mine) return
          setResults(cities)
          setSearching(false)
        },
        () => {
          if (generation.current !== mine) return
          setResults([])
          setSearching(false)
        },
      )
    }, 300)
    return () => { window.clearTimeout(handle) }
  }, [query])

  const choose = (choice: CityChoice): void => {
    generation.current += 1
    setResults([])
    setQuery('')
    setNotice(undefined)
    void pickCity(scope, choice).then(() => { onPicked?.(choice) })
  }

  const locate = (): void => {
    if (locating) return
    setLocating(true)
    setNotice(undefined)
    void locateCity(t('city.located')).then(
      (choice) => { choose(choice) },
      (error: unknown) => {
        setNotice(error instanceof Error && error.message === 'denied'
          ? t('city.locateDenied')
          : t('city.locateFailed'))
      },
    ).finally(() => { setLocating(false) })
  }

  return (
    <div className={css.picker}>
      <div className={css.row}>
        <Input
          value={query}
          onChange={(event) => { setQuery(event.target.value) }}
          placeholder={t('city.placeholder')}
          aria-label={t('city.placeholder')}
          autoFocus={autoFocus}
        />
        <Button variant="outline" size="sm" onClick={locate} disabled={locating}>
          {locating ? t('city.locating') : t('city.locate')}
        </Button>
      </div>
      {searching && <div className={css.status}>{t('city.searching')}</div>}
      {!searching && results.length === 0 && query.trim().length >= 2 && (
        <div className={css.status}>{t('city.noResults')}</div>
      )}
      {results.length > 0 && (
        <ul className={css.results}>
          {results.map((choice) => (
            <li key={`${choice.name}-${choice.latitude}-${choice.longitude}`}>
              <button type="button" className={css.result} onClick={() => { choose(choice) }}>
                <span className={css.resultName}>{choice.name}</span>
                <span className={css.resultMeta}>
                  {choice.country ? `${choice.country} · ` : ''}
                  {choice.latitude.toFixed(1)}, {choice.longitude.toFixed(1)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {notice !== undefined && <div className={css.notice}>{notice}</div>}
    </div>
  )
}
