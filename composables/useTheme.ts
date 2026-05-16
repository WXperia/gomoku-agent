export type Theme = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'gomoku_theme'

export const useTheme = () => {
  const theme = useState<Theme>('theme', () => 'system')

  function applyTheme(t: Theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = t === 'dark' || (t === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.classList.toggle('light', !isDark)
  }

  function setTheme(t: Theme) {
    theme.value = t
    localStorage.setItem(STORAGE_KEY, t)
    applyTheme(t)
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    const initial = saved ?? 'system'
    theme.value = initial
    applyTheme(initial)

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme.value === 'system') applyTheme('system')
    })
  }

  const isDark = computed(() => {
    if (process.server) return true
    if (theme.value === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches
    return theme.value === 'dark'
  })

  return { theme, isDark, setTheme, initTheme }
}
