/**
 * Animated SVG weather icon set (64px viewBox, 2px rounded strokes). Every
 * moving part sits in an `anim-*` CSS class from WeatherIcons.module.css, so
 * motion is pure CSS and honors prefers-reduced-motion. Palette: sun
 * #F6B03B / cloud #9AA7B5 / rain #4A90D9 / snow #C9D8E8 (the spec's #D8E3F0
 * darkened for contrast on light surfaces) / night #7B6BD6.
 */
import type { ReactNode } from 'react'
import css from './WeatherIcons.module.css'

const SUN = '#F6B03B'
const CLOUD = '#9AA7B5'
const RAIN = '#4A90D9'
const SNOW = '#C9D8E8'
const NIGHT = '#7B6BD6'
const CLOUD_FILL = '#EEF2F6'
const CLOUD_FILL_DARK = '#DEE6EE'

export type WeatherIconKey =
  | 'sunny'
  | 'partly_cloudy_day'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'rain_heavy'
  | 'thunderstorm'
  | 'snow'
  | 'snow_showers'
  | 'sleet'
  | 'wind'
  | 'night_clear'
  | 'night_partly'
  | 'night_rain'

/** The shared cloud silhouette (stroke + light fill). */
function Cloud({ fill = CLOUD_FILL }: { fill?: string }): ReactNode {
  return (
    <path
      d="M25 48c-5 0-9-4-9-9 0-4 2-7 6-8 2-6 8-10 14-8 5 2 8 7 7 12 3 1 5 4 5 7 0 3-2 6-5 6H25z"
      fill={fill}
      stroke={CLOUD}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  )
}

/** A six-spoke snowflake centered at (x, y) with radius r. */
function Flake({ x, y, r }: { x: number; y: number; r: number }): ReactNode {
  return (
    <g stroke={SNOW} strokeWidth={2} strokeLinecap="round">
      <line x1={x - r} y1={y} x2={x + r} y2={y} />
      <line x1={x - r * 0.5} y1={y - r * 0.86} x2={x + r * 0.5} y2={y + r * 0.86} />
      <line x1={x - r * 0.5} y1={y + r * 0.86} x2={x + r * 0.5} y2={y - r * 0.86} />
    </g>
  )
}

/** A four-point sparkle centered at (x, y). */
function Star({ x, y, r, delay }: { x: number; y: number; r: number; delay: string }): ReactNode {
  return (
    <g className={css.twinkle} style={{ animationDelay: delay }} stroke={NIGHT} strokeWidth={2} strokeLinecap="round">
      <line x1={x - r} y1={y} x2={x + r} y2={y} />
      <line x1={x} y1={y - r} x2={x} y2={y + r} />
    </g>
  )
}

/** Sun disc + ray group (rays spin as one unit). */
function SunRays({ cx, cy, inner, outer }: { cx: number; cy: number; inner: number; outer: number }): ReactNode {
  const rays: ReactNode[] = []
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    rays.push(
      <line
        key={index}
        x1={round1(cx + inner * cos)}
        y1={round1(cy + inner * sin)}
        x2={round1(cx + outer * cos)}
        y2={round1(cy + outer * sin)}
        stroke={SUN}
        strokeWidth={2}
        strokeLinecap="round"
      />,
    )
  }
  return <g className={css.spin}>{rays}</g>
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** One slanted raindrop (the drop animation applies to the group). */
function Drop({ x1, y1, x2, y2, delay }: { x1: number; y1: number; x2: number; y2: number; delay: string }): ReactNode {
  return (
    <g className={css.drop} style={{ animationDelay: delay }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={RAIN} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  )
}

export interface WeatherIconProps {
  name: WeatherIconKey
  size?: number
  className?: string | undefined
}

/** Render one weather icon with its CSS animation groups. */
export function WeatherIcon({ name, size = 64, className }: WeatherIconProps): ReactNode {
  let body: ReactNode
  switch (name) {
    case 'sunny':
      body = (
        <g>
          <circle cx={32} cy={32} r={11} fill={SUN} className={css.pulse} />
          <SunRays cx={32} cy={32} inner={15.5} outer={22.5} />
        </g>
      )
      break
    case 'partly_cloudy_day':
      body = (
        <g>
          <circle cx={21} cy={21} r={7} fill={SUN} />
          <SunRays cx={21} cy={21} inner={10} outer={13} />
          <g transform="translate(15 10) scale(0.82)">
            <Cloud />
          </g>
        </g>
      )
      break
    case 'cloudy':
      body = (
        <g>
          <g transform="translate(0 -6)"><Cloud /></g>
          <g transform="translate(10 10) scale(0.8)"><Cloud /></g>
        </g>
      )
      break
    case 'overcast':
      body = (
        <g>
          <g transform="translate(0 -6)"><Cloud /></g>
          <g transform="translate(14 8) scale(0.8)"><Cloud fill={CLOUD_FILL_DARK} /></g>
        </g>
      )
      break
    case 'fog':
      body = (
        <g>
          <g transform="translate(4 -16) scale(0.9)"><Cloud /></g>
          {[40, 47, 54].map((y, index) => (
            <line key={y} x1={14} y1={y} x2={50} y2={y} stroke={CLOUD} strokeWidth={2} strokeLinecap="round"
              className={css.fog} style={{ animationDelay: `${index * 0.7}s` }} />
          ))}
        </g>
      )
      break
    case 'drizzle':
      body = (
        <g>
          <g transform="translate(4 -14) scale(0.9)"><Cloud /></g>
          <Drop x1={21} y1={43} x2={21} y2={49} delay="0s" />
          <Drop x1={37} y1={43} x2={37} y2={49} delay="0.5s" />
        </g>
      )
      break
    case 'rain':
      body = (
        <g>
          <g transform="translate(4 -16) scale(0.9)"><Cloud /></g>
          <Drop x1={23} y1={41} x2={18} y2={52} delay="0s" />
          <Drop x1={33} y1={41} x2={28} y2={52} delay="0.35s" />
          <Drop x1={43} y1={41} x2={38} y2={52} delay="0.7s" />
        </g>
      )
      break
    case 'rain_heavy':
      body = (
        <g>
          <g transform="translate(4 -16) scale(0.9)"><Cloud /></g>
          <Drop x1={17} y1={40} x2={12} y2={52} delay="0s" />
          <Drop x1={27} y1={40} x2={22} y2={52} delay="0.3s" />
          <Drop x1={37} y1={40} x2={32} y2={52} delay="0.6s" />
          <Drop x1={47} y1={40} x2={42} y2={52} delay="0.9s" />
        </g>
      )
      break
    case 'thunderstorm':
      body = (
        <g>
          <g transform="translate(4 -16) scale(0.9)"><Cloud /></g>
          <polygon points="36,36 25,49 32,49 29,60 41,45 34,45 39,36" fill={SUN} className={css.flash} />
        </g>
      )
      break
    case 'snow':
      body = (
        <g>
          <g transform="translate(4 -16) scale(0.9)"><Cloud /></g>
          <g className={css.flake}><Flake x={20} y={51} r={4.5} /></g>
          <g className={css.flake} style={{ animationDelay: '0.8s' }}><Flake x={32} y={53} r={4.5} /></g>
          <g className={css.flake} style={{ animationDelay: '1.6s' }}><Flake x={44} y={51} r={4.5} /></g>
        </g>
      )
      break
    case 'snow_showers':
      body = (
        <g>
          <g transform="translate(4 -14) scale(0.9)"><Cloud /></g>
          <g className={css.flake}><Flake x={30} y={51} r={4.5} /></g>
          <line x1={20} y1={43} x2={20} y2={49} stroke={RAIN} strokeWidth={2.2} strokeLinecap="round" />
          <line x1={44} y1={43} x2={44} y2={49} stroke={RAIN} strokeWidth={2.2} strokeLinecap="round" />
        </g>
      )
      break
    case 'sleet':
      body = (
        <g>
          <g transform="translate(4 -14) scale(0.9)"><Cloud /></g>
          <Drop x1={25} y1={42} x2={20} y2={52} delay="0s" />
          <g className={css.flake}><Flake x={40} y={51} r={4.5} /></g>
        </g>
      )
      break
    case 'wind':
      body = (
        <g stroke={CLOUD} strokeWidth={2} strokeLinecap="round" fill="none">
          <path d="M14 24 q6 -5 12 0 q6 5 12 0 q6 5 12 0" className={css.wind} />
          <path d="M18 34 q6 -5 12 0 q6 5 12 0 q6 5 12 0" className={css.wind} style={{ animationDelay: '0.6s' }} />
          <path d="M22 44 q6 -5 12 0 q6 5 12 0" className={css.wind} style={{ animationDelay: '1.2s' }} />
        </g>
      )
      break
    case 'night_clear':
      body = (
        <g>
          <path d="M41 10 A19 19 0 1 0 53 41 A15 15 0 0 1 41 10 Z" fill={NIGHT} />
          <Star x={13} y={14} r={3.5} delay="0s" />
          <Star x={19} y={37} r={2.6} delay="0.7s" />
          <Star x={34} y={48} r={2.2} delay="1.4s" />
        </g>
      )
      break
    case 'night_partly':
      body = (
        <g>
          <g transform="translate(-2 -4) scale(0.8)">
            <path d="M41 10 A19 19 0 1 0 53 41 A15 15 0 0 1 41 10 Z" fill={NIGHT} />
          </g>
          <g transform="translate(18 16) scale(0.66)"><Cloud /></g>
        </g>
      )
      break
    case 'night_rain':
      body = (
        <g>
          <g transform="translate(-4 -8) scale(0.82)">
            <path d="M41 10 A19 19 0 1 0 53 41 A15 15 0 0 1 41 10 Z" fill={NIGHT} />
          </g>
          <Drop x1={32} y1={44} x2={27} y2={54} delay="0s" />
          <Drop x1={44} y1={44} x2={39} y2={54} delay="0.5s" />
        </g>
      )
      break
  }
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      strokeLinecap="round"
    >
      <title>{name}</title>
      {body}
    </svg>
  )
}
