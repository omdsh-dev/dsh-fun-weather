/**
 * Weather skin, mode B: a full-screen wallpaper layer (fixed, z-index 0,
 * pointer-events none) rendered behind the app. The layer paints a gradient
 * keyed by weather code × day/night plus a canvas particle field (flares,
 * drifting clouds, rain streaks, snow, stars) whose density follows the
 * settings intensity slider. While active, the layer also overrides the
 * `--dsw-alias-bg-base` token on <body> to transparent — the sanctioned
 * token channel — so the app frame, conversation, and details surfaces show
 * the wallpaper instead of their opaque base background; the token is
 * removed on disable, and the layer never intercepts pointer events.
 *
 * The file is imperative TSX-free by design: the layer lives outside React,
 * so its lifecycle rides the plugin fiber directly.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { WeatherSettings } from '../weather-settings.ts'
import { particleKind, type WeatherParticleKind, type WeatherRuntime } from './weather.ts'

/** Background gradient per weather code family × day/night. */
function gradientFor(code: number, isDay: boolean): string {
  if (!isDay) {
    if (code >= 51 && code <= 99) {
      return 'linear-gradient(180deg, #0B1220 0%, #16233B 55%, #1E3252 100%)'
    }
    return 'linear-gradient(180deg, #171226 0%, #2B2350 55%, #43377A 100%)'
  }
  if (code === 0) return 'linear-gradient(180deg, #63B3ED 0%, #BEE3F8 45%, #FDE68A 100%)'
  const rain = code >= 51 && code <= 99
  if (rain) return 'linear-gradient(180deg, #1E3A5F 0%, #35577D 50%, #54799B 100%)'
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) {
    return 'linear-gradient(180deg, #B7C9D9 0%, #E4ECF3 50%, #F7FAFC 100%)'
  }
  return 'linear-gradient(180deg, #94A3B8 0%, #CBD5E1 50%, #E2E8F0 100%)'
}

/** Base particle count per kind (final count scales with the intensity slider). */
const BASE_COUNT: Readonly<Record<WeatherParticleKind, number>> = Object.freeze({
  flares: 26,
  drift: 22,
  rain: 60,
  snow: 46,
  stars: 56,
})

interface Particle {
  x: number
  y: number
  size: number
  phase: number
}

/** Particle colors per kind (readable over the matching gradient). */
function particleColor(kind: WeatherParticleKind): string {
  switch (kind) {
    case 'flares': return '255, 214, 120'
    case 'drift': return '255, 255, 255'
    case 'rain': return '165, 205, 245'
    case 'snow': return '240, 248, 255'
    case 'stars': return '226, 220, 255'
  }
}

function spawnParticles(count: number, width: number, height: number): Particle[] {
  const particles: Particle[] = []
  for (let index = 0; index < count; index += 1) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 0,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return particles
}

/**
 * Install the mode-B wallpaper layer. Returns nothing; the whole layer —
 * element, canvas loop, body token override — is released by the fiber on
 * unload.
 * @param ctx - client root context.
 * @param scope - this plugin's settings scope.
 * @param runtime - the root-scope weather runtime.
 */
export function installWallpaper(
  ctx: Context,
  scope: SettingsScope<WeatherSettings>,
  runtime: WeatherRuntime,
): void {
  const layer = document.createElement('div')
  layer.style.position = 'fixed'
  layer.style.inset = '0'
  layer.style.zIndex = '0'
  layer.style.pointerEvents = 'none'
  layer.style.display = 'none'
  const canvas = document.createElement('canvas')
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  layer.append(canvas)
  document.body.append(layer)

  const painter = canvas.getContext('2d')
  let particles: Particle[] = []
  let kind: WeatherParticleKind = 'drift'
  let raf = 0
  let running = false
  let lastTick = 0

  const resize = (): void => {
    canvas.width = Math.max(1, window.innerWidth)
    canvas.height = Math.max(1, window.innerHeight)
  }

  const tick = (now: number): void => {
    if (!running || painter === null) return
    const delta = Math.min(0.05, (now - lastTick) / 1000)
    lastTick = now
    const width = canvas.width
    const height = canvas.height
    painter.clearRect(0, 0, width, height)
    const color = particleColor(kind)
    painter.lineCap = 'round'
    for (const particle of particles) {
      particle.phase += delta
      switch (kind) {
        case 'flares': {
          particle.y -= (0.4 + particle.size) * delta * 8
          if (particle.y < -8) { particle.y = height + 8; particle.x = Math.random() * width }
          const pulse = 0.55 + 0.45 * Math.sin(particle.phase * 2)
          painter.fillStyle = `rgba(${color}, ${0.28 * pulse})`
          painter.beginPath()
          painter.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          painter.fill()
          break
        }
        case 'drift': {
          particle.x += Math.sin(particle.phase) * 6 * delta
          if (particle.x < -12) particle.x = width + 12
          painter.fillStyle = `rgba(${color}, ${0.10 + 0.05 * Math.sin(particle.phase)})`
          painter.beginPath()
          painter.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          painter.fill()
          break
        }
        case 'rain': {
          particle.y += 420 * delta
          particle.x += 40 * delta
          if (particle.y > height + 16) {
            particle.y = -16
            particle.x = Math.random() * (width + 60) - 30
          }
          painter.strokeStyle = `rgba(${color}, 0.5)`
          painter.lineWidth = 1.4
          painter.beginPath()
          painter.moveTo(particle.x, particle.y)
          painter.lineTo(particle.x - 7, particle.y - 22)
          painter.stroke()
          break
        }
        case 'snow': {
          particle.y += (14 + particle.size * 3) * delta
          particle.x += Math.sin(particle.phase * 1.6) * 16 * delta
          if (particle.y > height + 6) { particle.y = -6; particle.x = Math.random() * width }
          painter.fillStyle = `rgba(${color}, 0.85)`
          painter.beginPath()
          painter.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          painter.fill()
          break
        }
        case 'stars': {
          const twinkle = 0.25 + 0.65 * Math.abs(Math.sin(particle.phase))
          painter.fillStyle = `rgba(${color}, ${twinkle})`
          painter.beginPath()
          painter.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          painter.fill()
          break
        }
      }
    }
    raf = requestAnimationFrame(tick)
  }

  const start = (): void => {
    resize()
    running = true
    lastTick = performance.now()
    raf = requestAnimationFrame(tick)
  }

  const stop = (): void => {
    running = false
    cancelAnimationFrame(raf)
  }

  const seed = (nextKind: WeatherParticleKind, intensity: number): void => {
    kind = nextKind
    const count = Math.max(6, Math.round(BASE_COUNT[nextKind] * (0.3 + 0.9 * intensity)))
    particles = spawnParticles(count, canvas.width, canvas.height).map((particle) => {
      switch (nextKind) {
        case 'flares': return { ...particle, size: 4 + Math.random() * 12 }
        case 'drift': return { ...particle, size: 16 + Math.random() * 26, y: canvas.height * (0.25 + Math.random() * 0.7) }
        case 'rain': return { ...particle, y: Math.random() * canvas.height }
        case 'snow': return { ...particle, size: 1.6 + Math.random() * 2.6 }
        case 'stars': return { ...particle, size: 0.7 + Math.random() * 1.5 }
      }
    })
  }

  const sync = (): void => {
    const settings = scope.getSnapshot().value
    const snapshot = runtime.getSnapshot()
    const want = settings?.skinOn === true && settings.skinMode === 'B'
    if (!want) {
      stop()
      layer.style.display = 'none'
      document.body.style.removeProperty('--dsw-alias-bg-base')
      return
    }
    layer.style.display = ''
    document.body.style.setProperty('--dsw-alias-bg-base', 'transparent')
    const code = snapshot.data?.current.weatherCode ?? 0
    const isDay = snapshot.data?.current.isDay ?? true
    layer.style.background = gradientFor(code, isDay)
    seed(particleKind(code, isDay), settings?.intensity ?? 0.6)
    if (!running) start()
  }

  window.addEventListener('resize', resize)
  ctx.effect(() => scope.subscribe(sync), 'dsh-weather: wallpaper settings sync')
  ctx.effect(() => runtime.subscribe(sync), 'dsh-weather: wallpaper weather sync')
  ctx.effect(() => () => {
    stop()
    window.removeEventListener('resize', resize)
    document.body.style.removeProperty('--dsw-alias-bg-base')
    layer.remove()
  }, 'dsh-weather: wallpaper lifetime')
  sync()
}
