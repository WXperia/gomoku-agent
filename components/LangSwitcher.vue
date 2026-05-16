<template>
  <button
    @click="toggle"
    :title="$t('lang.switch')"
    class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-200 whitespace-nowrap
      bg-card border-card text-secondary hover:border-gold/50 hover:text-gold"
  >
    <span class="text-sm">🌐</span>
    <span>{{ $t('lang.current') }}</span>
  </button>
</template>

<script setup lang="ts">
const { locale, setLocale } = useI18n()
function toggle() {
  setLocale(locale.value === 'zh' ? 'en' : 'zh')
}
</script>
