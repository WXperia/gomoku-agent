<template>
  <button
    @click="cycle"
    class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-200
      bg-white/5 dark:bg-white/5 border-white/10 dark:border-white/10
      text-gray-600 dark:text-gray-400
      hover:border-gold/50 hover:text-gold"
    :title="label"
  >
    <span class="text-sm">{{ icon }}</span>
    <span class="hidden sm:inline">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
const { theme, setTheme } = useTheme()

const options: { value: 'system' | 'light' | 'dark'; icon: string; label: string }[] = [
  { value: 'system', icon: '💻', label: 'Auto' },
  { value: 'light', icon: '☀️', label: 'Light' },
  { value: 'dark', icon: '🌙', label: 'Dark' },
]

const current = computed(() => options.find(o => o.value === theme.value) ?? options[0])
const icon = computed(() => current.value.icon)
const label = computed(() => current.value.label)

function cycle() {
  const idx = options.findIndex(o => o.value === theme.value)
  setTheme(options[(idx + 1) % options.length].value)
}
</script>
