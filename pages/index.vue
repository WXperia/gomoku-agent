<template>
  <div class="min-h-screen px-4 py-6 sm:px-6">
    <div class="max-w-6xl mx-auto w-full">
      <header class="flex items-center gap-3 mb-6 sm:mb-8">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-xl font-bold shrink-0 text-[var(--bg-primary)] bg-gradient-to-br from-gold to-gold-dim">
            棋
          </div>
          <h1 class="text-base sm:text-xl font-display font-semibold truncate text-primary">
            {{ $t('site.title') }}
          </h1>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            v-if="gameStore.currentUser"
            class="flex items-center gap-2 bg-card border border-card rounded-lg px-3 py-2 text-sm transition-all duration-200 hover:border-gold/50"
            @click="showUserModal = true"
          >
            <span class="text-lg">{{ gameStore.currentUser.flag }}</span>
            <span class="text-primary font-medium hidden sm:inline">{{ gameStore.currentUser.nickname }}</span>
            <span class="text-xs opacity-60">✎</span>
          </button>
          <button
            v-else
            class="flex items-center gap-1.5 bg-card border border-card text-primary px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:border-gold/50"
            @click="showUserModal = true"
          >
            <span>用户</span>
          </button>
          <ThemeToggle />
          <LangSwitcher />
        </div>
      </header>

      <main class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 lg:gap-5">
        <aside class="bg-card border border-card rounded-xl p-3 lg:p-4">
          <h2 class="text-xs text-secondary uppercase tracking-wider mb-3 font-display">选择游戏</h2>
          <div class="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            <button
              v-for="mode in gameModes"
              :key="mode.id"
              class="min-w-40 lg:min-w-0 w-full border rounded-lg px-3 py-3 text-left transition-all duration-200"
              :class="gameStore.selectedGameKind === mode.id ? 'border-gold bg-gold/10' : 'border-card bg-deep hover:border-gold/40'"
              @click="selectGameMode(mode.id)"
            >
              <span class="flex items-center gap-3">
                <span class="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-card border border-card">{{ mode.icon }}</span>
                <span class="min-w-0">
                  <span class="block text-sm font-semibold text-primary">{{ mode.name }}</span>
                  <span class="block text-xs text-muted truncate">{{ mode.description }}</span>
                </span>
              </span>
            </button>
          </div>

          <button
            class="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 bg-card border border-card text-primary hover:bg-section hover:border-gold/40"
            @click="router.push('/ranking')"
          >
            <span>🏆</span>
            <span>{{ $t('select.view_rankings') }}</span>
          </button>
        </aside>

        <section class="bg-card border border-card rounded-xl p-4 sm:p-5 min-w-0">
          <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div class="flex-1 min-w-0">
              <h2 class="text-xl sm:text-2xl font-display font-semibold text-primary">{{ selectedMode.name }}</h2>
              <p class="text-sm text-secondary mt-1">{{ selectedMode.description }}</p>
            </div>
            <button
              class="flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-all duration-200 btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!selectedId"
              @click="startGame"
            >
              <span>{{ $t('select.start_battle') }}</span>
              <span>→</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <button
              v-for="(model, idx) in displayedModels"
              :key="model.id"
              class="relative bg-deep border-2 rounded-lg p-4 text-left cursor-pointer transition-all duration-200 opacity-0 animate-fade-in-up hover:-translate-y-0.5"
              :class="selectedId === model.id ? 'border-gold shadow-gold-lg' : 'border-card hover:border-gold/40 hover:shadow-card-hover'"
              :style="{ animationDelay: `${idx * 60}ms`, animationFillMode: 'forwards' }"
              @click="selectModel(model)"
            >
              <div class="flex items-start gap-3">
                <div class="w-11 h-11 rounded-lg flex items-center justify-center text-2xl shrink-0" :style="{ background: model.color }">
                  {{ model.icon }}
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="text-base font-display font-semibold text-primary truncate">{{ model.name }}</h3>
                  <p class="text-secondary text-xs mb-2">{{ model.provider }}</p>
                  <div class="flex gap-1">
                    <span v-for="i in 5" :key="i" class="text-xs" :class="i <= model.difficulty ? 'text-gold' : 'text-muted'">★</span>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/10">
                <div class="flex flex-col">
                  <span class="text-lg font-bold text-primary">{{ model.wins }}</span>
                  <span class="text-xs text-muted uppercase tracking-wide">{{ $t('select.wins') }}</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-lg font-bold text-primary">{{ model.games }}</span>
                  <span class="text-xs text-muted uppercase tracking-wide">{{ $t('select.games') }}</span>
                </div>
              </div>

              <div v-if="selectedId === model.id" class="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center bg-gold text-[var(--bg-primary)] font-bold text-xs">
                ✓
              </div>
            </button>
          </div>
        </section>
      </main>
    </div>

    <Transition name="modal">
      <div
        v-if="showUserModal"
        class="modal-overlay fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6"
        @click.self="onOverlayClick"
      >
        <div class="modal-box bg-card border border-card rounded-2xl p-7 sm:p-10 w-full max-w-sm shadow-2xl">
          <div class="text-center mb-7">
            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold mx-auto mb-3 text-[var(--bg-primary)] bg-gradient-to-br from-gold to-gold-dim">
              棋
            </div>
            <h2 class="text-xl sm:text-2xl font-display font-semibold text-primary mb-1">{{ $t('site.title') }}</h2>
            <p class="text-secondary text-xs sm:text-sm">{{ $t('site.subtitle') }}</p>
          </div>

          <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-secondary">{{ $t('entry.nickname') }}</label>
              <div class="flex items-center gap-2.5 bg-deep border rounded-lg px-3 py-2.5 transition-colors duration-200 focus-within:border-gold" :class="errors.nickname ? 'border-red-600' : 'border-white/10'">
                <span class="text-sm opacity-70">用户</span>
                <input
                  v-model="nickname"
                  type="text"
                  :placeholder="$t('entry.nickname_placeholder')"
                  maxlength="16"
                  autofocus
                  class="flex-1 bg-transparent text-primary text-sm placeholder:text-muted"
                />
              </div>
              <span v-if="errors.nickname" class="text-red-500 text-xs">{{ errors.nickname }}</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-secondary">
                {{ $t('entry.email') }}
                <span class="text-muted text-xs">{{ $t('entry.email_optional') }}</span>
              </label>
              <div class="flex items-center gap-2.5 bg-deep border rounded-lg px-3 py-2.5 transition-colors duration-200 focus-within:border-gold" :class="errors.email ? 'border-red-600' : 'border-white/10'">
                <span class="text-sm opacity-70">@</span>
                <input
                  v-model="email"
                  type="email"
                  :placeholder="$t('entry.email_placeholder')"
                  class="flex-1 bg-transparent text-primary text-sm placeholder:text-muted"
                />
              </div>
              <span v-if="errors.email" class="text-red-500 text-xs">{{ errors.email }}</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-secondary">{{ $t('entry.location') }}</label>
              <div class="flex items-center gap-2.5 bg-deep border border-white/10 rounded-lg px-3 py-2.5">
                <span class="text-xl">{{ location.flag }}</span>
                <span class="text-primary text-sm">{{ location.country || '...' }}</span>
                <span v-if="loadingLocation" class="ml-auto w-3.5 h-3.5 rounded-full border-2 border-muted border-t-gold animate-spin"></span>
              </div>
            </div>

            <div class="flex gap-2 mt-1">
              <button
                v-if="gameStore.currentUser"
                type="button"
                class="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 bg-red-900/20 border border-red-700 text-red-400 hover:bg-red-900/30"
                @click="handleLogout"
              >退出</button>
              <button
                v-if="gameStore.currentUser"
                type="button"
                class="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 bg-card border border-card text-primary hover:bg-section hover:border-gold/40"
                @click="showUserModal = false"
              >{{ $t('select.cancel') }}</button>
              <button
                type="submit"
                class="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all duration-200 btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="loadingLocation"
              >
                <span>{{ $t('entry.start_game') }}</span>
                <span>→</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useGameStore, type AIModel, type GameKind } from '~/stores/gameStore'

const { t } = useI18n()
const gameStore = useGameStore()
const router = useRouter()

const selectedId = ref<string | null>(null)
const gameModes = [
  { id: 'gomoku' as const, name: '五子棋', icon: '●', description: '连成五子，快速攻防' },
  { id: 'xiangqi' as const, name: '中国象棋', icon: '帥', description: '楚河汉界，模型执黑' },
  { id: 'chess' as const, name: '国际象棋', icon: '♔', description: '经典 8x8，模型执黑' },
]
const showUserModal = ref(false)
const nickname = ref('')
const email = ref('')
const errors = ref<{ nickname?: string; email?: string }>({})
const loadingLocation = ref(true)
const location = ref({ country: '', countryCode: '', flag: '🌐' })

const selectedMode = computed(() => gameModes.find(mode => mode.id === gameStore.selectedGameKind) ?? gameModes[0])
const displayedModels = computed(() => {
  if (gameStore.selectedGameKind === 'xiangqi' || gameStore.selectedGameKind === 'chess') {
    return gameStore.aiModels.filter(model => model.provider !== 'local')
  }
  return gameStore.aiModels
})

onMounted(async () => {
  await gameStore.loadUsers()
  await gameStore.loadAIStats()

  if (gameStore.selectedModel && displayedModels.value.some(model => model.id === gameStore.selectedModel?.id)) {
    selectedId.value = gameStore.selectedModel.id
  }

  if (!gameStore.currentUser) {
    showUserModal.value = true
  } else {
    nickname.value = gameStore.currentUser.nickname
    email.value = gameStore.currentUser.email || ''
    location.value = {
      country: gameStore.currentUser.country,
      countryCode: gameStore.currentUser.countryCode,
      flag: gameStore.currentUser.flag,
    }
  }

  try {
    const response = await fetch('https://ipapi.co/json/')
    if (response.ok) {
      const data = await response.json()
      location.value = {
        country: data.country_name || 'Unknown',
        countryCode: data.country_code || '',
        flag: getFlag(data.country_code),
      }
    }
  } catch {
    if (!gameStore.currentUser) location.value = { country: 'Unknown', countryCode: '', flag: '🌐' }
  } finally {
    loadingLocation.value = false
  }
})

function getFlag(countryCode: string): string {
  if (!countryCode) return '🌐'
  const codePoints = countryCode.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

function validate(): boolean {
  errors.value = {}
  if (!nickname.value.trim()) { errors.value.nickname = t('entry.err_required'); return false }
  if (nickname.value.trim().length < 3) { errors.value.nickname = t('entry.err_min'); return false }
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(nickname.value)) { errors.value.nickname = t('entry.err_chars'); return false }
  if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { errors.value.email = t('entry.err_email'); return false }
  return true
}

async function handleSubmit() {
  if (!validate()) return
  await gameStore.setUser({
    nickname: nickname.value.trim(),
    email: email.value.trim() || undefined,
    country: location.value.country,
    countryCode: location.value.countryCode,
    flag: location.value.flag,
  })
  showUserModal.value = false
}

function onOverlayClick() {
  if (gameStore.currentUser) showUserModal.value = false
}

function selectGameMode(kind: GameKind) {
  gameStore.selectGameKind(kind)
  if (selectedId.value && !displayedModels.value.some(model => model.id === selectedId.value)) {
    selectedId.value = null
    gameStore.selectedModel = null
  }
}

function selectModel(model: AIModel) {
  selectedId.value = model.id
  gameStore.selectModel(model)
}

function startGame() {
  if (!selectedId.value) return
  if (!gameStore.currentUser) { showUserModal.value = true; return }
  router.push('/play')
}

function handleLogout() {
  gameStore.logoutUser()
  selectedId.value = null
  nickname.value = ''
  email.value = ''
  errors.value = {}
  showUserModal.value = true
}
</script>
