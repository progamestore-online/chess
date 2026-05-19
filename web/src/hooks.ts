import { useState, useEffect, useSyncExternalStore, useCallback } from 'react'
import { speech, type SpeechState } from './services/speech.ts'
import { loadSettings, saveSettings, type Settings } from './services/settings.ts'

export function useSpeech(): SpeechState {
  return useSyncExternalStore(
    (cb) => speech.subscribe(cb),
    () => speech.state,
  )
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, updateSettings }
}

export function useApplySettings(settings: Settings) {
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const resolvedTheme = settings.theme === 'system'
        ? (media.matches ? 'dark' : 'light')
        : settings.theme
      root.dataset.theme = resolvedTheme
      const meta = document.getElementById('theme-color') as HTMLMetaElement | null
      if (meta) meta.content = resolvedTheme === 'dark' ? '#000000' : '#ffffff'
    }

    applyTheme()
    root.dataset.motion = settings.motion
    root.dataset.surface = settings.surface
    root.dataset.board = settings.boardTheme

    const labelScale = { small: '13px', medium: '16px', large: '19px', xlarge: '22px' } as const
    const contentScale = { small: '1', medium: '1.15', large: '1.35', xlarge: '1.55' } as const

    root.style.fontSize = labelScale[settings.labelSize]
    root.style.setProperty('--content-scale', contentScale[settings.contentSize])

    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [settings])
}
