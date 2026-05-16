export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },

  modules: ['@pinia/nuxt', '@nuxtjs/i18n', '@nuxtjs/tailwindcss'],

  runtimeConfig: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || '',
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || '',
    minimaxApiKey: process.env.MINIMAX_API_KEY || '',
    minimaxBaseUrl: process.env.MINIMAX_BASE_URL || '',
    public: {},
  },

  vite: {
    optimizeDeps: {
      include: ['pixi.js'],
    },
  },

  tailwindcss: {
    configPath: '~/tailwind.config.ts',
  },

  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'zh', name: '中文', file: 'zh.json' }
    ],
    lazy: false,
    defaultLocale: 'zh',
    strategy: 'no_prefix',
    langDir: 'locales/',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'gomoku_lang',
      redirectOn: 'root',
      fallbackLocale: 'zh'
    }
  },

  app: {
    head: {
      title: 'Gomoku AI Battle - 五子棋AI对决',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Play Gomoku against AI models' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Noto+Sans+JP:wght@300;400;500;700&display=swap'
        }
      ]
    }
  },

  css: ['~/assets/css/main.css']
})
