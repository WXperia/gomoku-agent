<template>
  <div class="min-h-screen px-4 py-6 sm:px-6">
    <div class="max-w-4xl mx-auto">

      <!-- Header -->
      <header class="flex items-center gap-3 mb-8">
        <button
          class="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center rounded-xl text-lg sm:text-xl
            bg-card border border-card text-primary transition-all duration-200 hover:bg-section hover:-translate-x-1"
          @click="goBack"
        >←</button>
        <h1 class="flex-1 text-center text-xl sm:text-3xl font-display font-semibold text-primary">
          🏆 {{ $t('ranking.title') }}
        </h1>
        <div class="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <LangSwitcher />
        </div>
      </header>

      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button
          v-for="tab in tabs" :key="tab.value"
          class="flex-1 flex items-center justify-center gap-2 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-semibold border-2 transition-all duration-200"
          :class="activeTab === tab.value
            ? 'border-gold text-gold bg-gold/10'
            : 'bg-card border-card text-secondary hover:border-gold/40'"
          @click="activeTab = tab.value"
        >
          <span>{{ tab.icon }}</span>
          <span>{{ $t(tab.label) }}</span>
        </button>
      </div>

      <!-- Table -->
      <div class="bg-card border border-card rounded-2xl overflow-hidden mb-6">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-deep">
                <th class="px-3 sm:px-4 py-3 text-left text-xs text-muted uppercase tracking-wider w-16 text-center border-b border-card">{{ $t('ranking.rank') }}</th>

                <!-- Human cols -->
                <template v-if="activeTab === 'human'">
                  <th class="px-3 sm:px-4 py-3 text-left text-xs text-muted uppercase tracking-wider w-14 border-b border-card">{{ $t('ranking.country') }}</th>
                  <th class="px-3 sm:px-4 py-3 text-left text-xs text-muted uppercase tracking-wider border-b border-card">{{ $t('ranking.player') }}</th>
                  <th class="px-3 sm:px-4 py-3 text-right text-xs text-muted uppercase tracking-wider hidden sm:table-cell border-b border-card">{{ $t('ranking.total_moves') }}</th>
                  <th class="px-3 sm:px-4 py-3 text-right text-xs text-muted uppercase tracking-wider border-b border-card">{{ $t('ranking.games') }}</th>
                  <th class="px-3 sm:px-4 py-3 text-right text-xs text-muted uppercase tracking-wider border-b border-card">{{ $t('ranking.win_rate') }}</th>
                </template>

                <!-- AI cols -->
                <template v-else>
                  <th class="px-3 sm:px-4 py-3 text-left text-xs text-muted uppercase tracking-wider border-b border-card">{{ $t('ranking.ai_model') }}</th>
                  <th class="px-3 sm:px-4 py-3 text-left text-xs text-muted uppercase tracking-wider hidden md:table-cell border-b border-card">{{ $t('ranking.provider') }}</th>
                  <th class="px-3 sm:px-4 py-3 text-right text-xs text-muted uppercase tracking-wider border-b border-card">{{ $t('ranking.wins') }}</th>
                  <th class="px-3 sm:px-4 py-3 text-right text-xs text-muted uppercase tracking-wider border-b border-card">{{ $t('ranking.games') }}</th>
                  <th class="px-3 sm:px-4 py-3 text-right text-xs text-muted uppercase tracking-wider border-b border-card">{{ $t('ranking.win_rate') }}</th>
                </template>
              </tr>
            </thead>
            <tbody>

              <!-- Human rows -->
              <template v-if="activeTab === 'human'">
                <tr
                  v-for="(user, index) in humanRanking" :key="user.id"
                  class="border-b border-white/5 transition-colors duration-200 hover:bg-white/[0.02]"
                  :class="user.id === gameStore.currentUser?.id ? 'bg-gold/10' : ''"
                >
                  <td class="px-3 sm:px-4 py-3 text-center">
                    <span
                      class="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-sm font-bold"
                      :class="rankBg(index + 1)"
                    >{{ index + 1 }}</span>
                  </td>
                  <td class="px-3 sm:px-4 py-3">
                    <span class="text-xl sm:text-2xl">{{ user.flag }}</span>
                  </td>
                  <td class="px-3 sm:px-4 py-3">
                    <span class="font-semibold text-primary text-sm sm:text-base">{{ user.nickname }}</span>
                    <span v-if="user.id === gameStore.currentUser?.id"
                      class="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold bg-gold text-[var(--bg-primary)]">
                      {{ $t('ranking.you') }}
                    </span>
                  </td>
                  <td class="px-3 sm:px-4 py-3 text-right font-semibold text-base sm:text-lg text-primary hidden sm:table-cell">
                    {{ user.totalMoves.toLocaleString() }}
                  </td>
                  <td class="px-3 sm:px-4 py-3 text-right font-semibold text-base sm:text-lg text-primary">{{ user.gamesPlayed }}</td>
                  <td class="px-3 sm:px-4 py-3 text-right font-semibold text-gold">
                    {{ user.gamesPlayed > 0 ? Math.round(user.wins / user.gamesPlayed * 100) : 0 }}%
                  </td>
                </tr>
                <tr v-if="humanRanking.length === 0">
                  <td colspan="6" class="px-4 py-12 text-center text-muted">{{ $t('ranking.no_players') }}</td>
                </tr>
              </template>

              <!-- AI rows -->
              <template v-else>
                <tr
                  v-for="(model, index) in aiRanking" :key="model.id"
                  class="border-b border-white/5 transition-colors duration-200 hover:bg-white/[0.02]"
                  :class="model.id === gameStore.selectedModel?.id ? 'bg-blue-500/10' : ''"
                >
                  <td class="px-3 sm:px-4 py-3 text-center">
                    <span
                      class="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-sm font-bold"
                      :class="rankBg(index + 1)"
                    >{{ index + 1 }}</span>
                  </td>
                  <td class="px-3 sm:px-4 py-3">
                    <div class="flex items-center gap-2 sm:gap-3">
                      <span class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-sm sm:text-base shrink-0"
                        :style="{ background: model.color }">{{ model.icon }}</span>
                      <span class="font-semibold text-primary text-sm sm:text-base">{{ model.name }}</span>
                      <span v-if="model.id === gameStore.selectedModel?.id"
                        class="px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-500/30 text-blue-400">
                        {{ $t('ranking.selected') }}
                      </span>
                    </div>
                  </td>
                  <td class="px-3 sm:px-4 py-3 text-secondary text-sm hidden md:table-cell">{{ model.provider }}</td>
                  <td class="px-3 sm:px-4 py-3 text-right font-semibold text-base sm:text-lg text-primary">{{ model.wins }}</td>
                  <td class="px-3 sm:px-4 py-3 text-right font-semibold text-base sm:text-lg text-primary">{{ model.games }}</td>
                  <td class="px-3 sm:px-4 py-3 text-right font-semibold text-gold">
                    {{ model.games > 0 ? Math.round(model.wins / model.games * 100) : 0 }}%
                  </td>
                </tr>
                <tr v-if="aiRanking.length === 0">
                  <td colspan="6" class="px-4 py-12 text-center text-muted">{{ $t('ranking.no_ai') }}</td>
                </tr>
              </template>

            </tbody>
          </table>
        </div>
      </div>

      <!-- Action -->
      <div class="flex justify-center">
        <button
          class="flex items-center gap-3 px-8 py-4 rounded-xl text-base font-semibold transition-all duration-200 btn-gold"
          @click="playGame"
        >
          <span>🎮</span>
          <span>{{ $t('ranking.play_now') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '~/stores/gameStore'

const gameStore = useGameStore()
const router = useRouter()

const activeTab = ref<'human' | 'ai'>('human')

const tabs = [
  { value: 'human' as const, icon: '👤', label: 'ranking.human_tab' },
  { value: 'ai' as const, icon: '🤖', label: 'ranking.ai_tab' },
]

onMounted(() => {
  gameStore.loadUsers()
  gameStore.loadAIStats()
  if (!gameStore.currentUser) router.push('/')
})

const humanRanking = computed(() => gameStore.humanRanking)
const aiRanking = computed(() => gameStore.aiRanking)

function rankBg(rank: number): string {
  if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-gray-900'
  if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900'
  if (rank === 3) return 'bg-gradient-to-br from-amber-700 to-amber-900 text-white'
  return 'bg-deep text-secondary'
}

function goBack() { router.push('/') }
function playGame() { router.push('/') }
</script>
