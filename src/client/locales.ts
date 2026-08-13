/**
 * `weather` namespace dictionaries: the conversation view tab label, the
 * weather cards, and the settings section copy.
 */

/** Dictionary namespace owned by this plugin. */
export const NS = 'weather'

/** The weather dictionary key set (the source of truth for both locales). */
export type WeatherKey =
  | 'view.tab'
  | 'view.emptyTitle'
  | 'view.emptyHint'
  | 'view.openSettings'
  | 'view.loading'
  | 'view.errorTitle'
  | 'view.retry'
  | 'view.updatedAt'
  | 'view.feelsLike'
  | 'view.wind'
  | 'view.humidity'
  | 'view.daily'
  | 'view.hourly'
  | 'view.today'
  | 'view.precip'
  | 'city.change'
  | 'city.placeholder'
  | 'city.searching'
  | 'city.noResults'
  | 'city.locate'
  | 'city.locating'
  | 'city.locateDenied'
  | 'city.locateFailed'
  | 'city.located'
  | 'settings.nav'
  | 'settings.locationTitle'
  | 'settings.locationHint'
  | 'settings.current'
  | 'settings.unitTitle'
  | 'settings.skinTitle'
  | 'settings.skinHint'
  | 'settings.skinModeA'
  | 'settings.skinModeB'
  | 'settings.intensity'
  | 'settings.refreshTitle'
  | 'settings.refreshMinutes'
  | 'settings.unavailable'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The weather tab and settings section copy. */
    'weather': WeatherKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<WeatherKey, string> = {
  'view.tab': '🌦 天气',
  'view.emptyTitle': '还没有配置城市',
  'view.emptyHint': '选择一座城市或使用定位，即可查看当前天气、7 日预报与逐小时趋势，还能让界面跟随天气换肤。',
  'view.openSettings': '在设置页配置',
  'view.loading': '加载天气中…',
  'view.errorTitle': '天气数据加载失败',
  'view.retry': '重试',
  'view.updatedAt': '更新于 {time}',
  'view.feelsLike': '体感 {value}',
  'view.wind': '{dir} {value}',
  'view.humidity': '湿度 {value}%',
  'view.daily': '7 日预报',
  'view.hourly': '逐小时',
  'view.today': '今天',
  'view.precip': '降水 {value}%',
  'city.change': '📍 换城市',
  'city.placeholder': '搜索城市…',
  'city.searching': '搜索中…',
  'city.noResults': '没有匹配的城市，换个关键词试试',
  'city.locate': '自动定位',
  'city.locating': '定位中…',
  'city.locateDenied': '定位被拒绝，请手动选择城市',
  'city.locateFailed': '定位失败，请手动选择城市',
  'city.located': '我的位置',
  'settings.nav': '天气',
  'settings.locationTitle': '城市',
  'settings.locationHint': '支持中文、拼音或英文搜索',
  'settings.current': '当前位置',
  'settings.unitTitle': '温度单位',
  'settings.skinTitle': '跟随天气换肤',
  'settings.skinHint': '形态 A：整个界面的配色随天气变化；形态 B：全屏天气壁纸（渐变 + 粒子）。',
  'settings.skinModeA': '形态 A · 主题配色',
  'settings.skinModeB': '形态 B · 壁纸粒子',
  'settings.intensity': '粒子强度',
  'settings.refreshTitle': '刷新间隔',
  'settings.refreshMinutes': '{minutes} 分钟',
  'settings.unavailable': '天气设置当前不可用（命名空间未开放，重启 dsh web 后生效）。',
}

/** English dictionary. */
export const en: Record<WeatherKey, string> = {
  'view.tab': '🌦 Weather',
  'view.emptyTitle': 'No city configured yet',
  'view.emptyHint': 'Pick a city or use your location to see current weather, a 7-day forecast, hourly trends — and let the UI skin itself after the weather.',
  'view.openSettings': 'Configure in settings',
  'view.loading': 'Loading weather…',
  'view.errorTitle': 'Failed to load weather data',
  'view.retry': 'Retry',
  'view.updatedAt': 'Updated {time}',
  'view.feelsLike': 'Feels like {value}',
  'view.wind': '{dir} {value}',
  'view.humidity': 'Humidity {value}%',
  'view.daily': '7-day forecast',
  'view.hourly': 'Hourly',
  'view.today': 'Today',
  'view.precip': 'Precip {value}%',
  'city.change': '📍 Change city',
  'city.placeholder': 'Search city…',
  'city.searching': 'Searching…',
  'city.noResults': 'No matching city, try another keyword',
  'city.locate': 'Use my location',
  'city.locating': 'Locating…',
  'city.locateDenied': 'Location denied — pick a city manually',
  'city.locateFailed': 'Location failed — pick a city manually',
  'city.located': 'My location',
  'settings.nav': 'Weather',
  'settings.locationTitle': 'City',
  'settings.locationHint': 'Search in Chinese, pinyin, or English',
  'settings.current': 'Current location',
  'settings.unitTitle': 'Temperature unit',
  'settings.skinTitle': 'Follow weather with skins',
  'settings.skinHint': 'Mode A: the whole UI palette follows the weather. Mode B: a full-screen weather wallpaper (gradient + particles).',
  'settings.skinModeA': 'Mode A · Theme palette',
  'settings.skinModeB': 'Mode B · Wallpaper',
  'settings.intensity': 'Particle intensity',
  'settings.refreshTitle': 'Refresh interval',
  'settings.refreshMinutes': '{minutes} min',
  'settings.unavailable': 'Weather settings are unavailable right now (namespace not exposed — restart dsh web to apply).',
}
