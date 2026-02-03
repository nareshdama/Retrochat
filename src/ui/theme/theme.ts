export type AccentTone = 'neutral' | 'electric'

export type ThemeState = {
  accent: AccentTone
}

export const defaultTheme: ThemeState = {
  accent: 'neutral',
}

export function applyTheme(theme: ThemeState): void {
  const root = document.documentElement
  const isElectric = theme.accent === 'electric'

  root.style.setProperty('--color-accent', isElectric ? '#f97316' : '#e5e7eb')
  root.style.setProperty('--color-accent-soft', isElectric ? '#111827' : '#020617')
  root.style.setProperty('--color-accent-fg', isElectric ? '#020617' : '#020617')
}

