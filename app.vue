<template>
  <NuxtPage />
</template>

<script setup lang="ts">
const { initTheme } = useTheme()

onMounted(() => {
  initTheme()
})

useHead({
  htmlAttrs: { lang: 'en' }
})
</script>
