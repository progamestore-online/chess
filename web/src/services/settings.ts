const STORAGE_KEY = 'prochess-settings'

export type ThemePreference = 'system' | 'light' | 'dark'
export type MotionPreference = 'full' | 'reduced'
export type SurfacePreference = 'soft' | 'bold'
export type BoardTheme = 'classic' | 'green' | 'icy' | 'dark' | 'midnight'

export interface Settings {
  theme: ThemePreference
  motion: MotionPreference
  surface: SurfacePreference
  boardTheme: BoardTheme
  audio: boolean
}

const defaults: Settings = {
  theme: 'dark',
  motion: 'full',
  surface: 'soft',
  boardTheme: 'classic',
  audio: true,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {}
  return defaults
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
