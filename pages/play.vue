<template>
  <div class="min-h-screen p-3 sm:p-4">
    <div class="max-w-6xl mx-auto flex flex-col" style="height: calc(100vh - 24px)">

      <!-- Header -->
      <header class="flex items-center gap-3 py-3 mb-4">
        <button
          class="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-lg
            bg-card border border-card text-primary transition-all duration-200 hover:bg-section"
          @click="confirmExit"
        >←</button>

        <div class="flex items-center gap-2.5 sm:gap-3">
          <span
            class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl"
            :style="{ background: gameStore.selectedModel?.color }"
          >{{ gameStore.selectedModel?.icon }}</span>
          <span class="text-secondary text-sm">vs</span>
          <span class="text-xl">👤</span>
        </div>

        <div class="ml-auto">
          <span
            v-if="gameStore.gameStatus === 'playing'"
            class="px-3 py-1.5 rounded-lg text-sm font-semibold"
            :class="gameStore.currentPlayer === 1
              ? 'bg-green-900/50 text-green-400'
              : 'bg-gold/20 text-gold animate-pulse'"
          >
            {{ gameStore.currentPlayer === 1 ? $t('play.your_turn') : $t('play.ai_thinking') }}
          </span>
          <span v-else-if="gameStore.gameStatus === 'won'"  class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-900/30 text-green-400">{{ $t('play.victory') }}</span>
          <span v-else-if="gameStore.gameStatus === 'lost'" class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-900/30 text-red-400">{{ $t('play.defeat') }}</span>
          <span v-else-if="gameStore.gameStatus === 'draw'" class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white/10 text-secondary">{{ $t('play.draw') }}</span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <LangSwitcher />
        </div>
      </header>

      <!-- Game area -->
      <div class="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 min-h-0">

        <!-- Board -->
        <div class="bg-card border border-card rounded-2xl p-3 sm:p-4 flex items-center justify-center min-h-64">
          <GameBoard @cell-click="handleCellClick" />
        </div>

        <!-- Side panel -->
        <aside class="flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0">

          <!-- Match info -->
          <div class="bg-card border border-card rounded-xl p-4 shrink-0 lg:shrink min-w-48 lg:min-w-0">
            <h3 class="text-xs text-secondary uppercase tracking-wider mb-3 font-display">{{ $t('play.match_info') }}</h3>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-0.5">
                <span class="text-xs text-muted">{{ $t('play.opponent') }}</span>
                <span class="text-sm font-semibold text-primary">{{ gameStore.selectedModel?.name }}</span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-xs text-muted">{{ $t('play.difficulty') }}</span>
                <span class="flex gap-0.5">
                  <span v-for="i in 5" :key="i" class="text-xs" :class="i <= (gameStore.selectedModel?.difficulty || 0) ? 'text-gold' : 'text-muted'">★</span>
                </span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-xs text-muted">{{ $t('play.moves') }}</span>
                <span class="text-base font-semibold text-primary">{{ gameStore.moveCount }}</span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-xs text-muted">{{ $t('play.your_color') }}</span>
                <span class="text-2xl text-stone-black">●</span>
              </div>
            </div>
          </div>

          <!-- AI Thinking panel -->
          <div class="bg-card border border-card rounded-xl p-4 shrink-0 lg:shrink min-w-64 lg:min-w-0 lg:flex-1 flex flex-col min-h-0">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs text-secondary uppercase tracking-wider font-display">
                {{ gameStore.selectedModel?.name }} · {{ $t('play.ai_thinking_log') }}
              </h3>
              <span v-if="gameStore.aiThinking" class="text-xs px-1.5 py-0.5 rounded font-mono"
                :class="{
                  'bg-green-900/40 text-green-400': gameStore.aiThinking.confidence === 'high',
                  'bg-gold/10 text-gold': gameStore.aiThinking.confidence === 'medium',
                  'bg-white/5 text-muted': gameStore.aiThinking.confidence === 'low',
                }"
              >{{ gameStore.aiThinking.confidence }}</span>
            </div>

            <!-- Thinking in progress -->
            <div v-if="gameStore.aiMovePending" class="flex items-center gap-2 py-3 shrink-0">
              <span class="flex gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style="animation-delay:0ms"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style="animation-delay:150ms"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style="animation-delay:300ms"></span>
              </span>
              <span class="text-xs text-gold animate-pulse">{{ $t('play.ai_thinking') }}...</span>
            </div>

            <!-- History list (newest first) -->
            <div v-if="gameStore.aiThinkingHistory.length" class="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
              <div
                v-for="(entry, idx) in gameStore.aiThinkingHistory"
                :key="entry.moveNumber"
                class="rounded-lg border p-3 flex flex-col gap-2 transition-all"
                :class="idx === 0 ? 'border-gold/40 bg-gold/5' : 'border-card bg-deep'"
              >
                <!-- Move header -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-stone-white border border-white/20 flex items-center justify-center text-[10px] font-bold text-[#111]">○</span>
                    <span class="text-sm font-semibold font-mono" :class="idx === 0 ? 'text-gold' : 'text-secondary'">{{ entry.moveLabel }}</span>
                    <span class="text-xs text-muted">{{ $t('play.move_n', { n: entry.moveNumber }) }}</span>
                  </div>
                  <span class="text-xs px-1.5 py-0.5 rounded font-mono"
                    :class="{
                      'bg-green-900/40 text-green-400': entry.confidence === 'high',
                      'bg-gold/10 text-gold': entry.confidence === 'medium',
                      'bg-white/5 text-muted': entry.confidence === 'low',
                    }"
                  >{{ entry.confidence }}</span>
                </div>

                <!-- Taunt — displayed prominently -->
                <div v-if="entry.taunt" class="flex items-start gap-1.5 bg-red-900/10 border border-red-700/30 rounded px-2.5 py-1.5">
                  <span class="text-red-400 text-xs shrink-0 mt-0.5">💬</span>
                  <p class="text-xs text-red-300 italic leading-relaxed">{{ entry.taunt }}</p>
                </div>

                <!-- Reasoning (collapsed for older entries) -->
                <p class="text-xs text-secondary leading-relaxed" :class="idx > 0 ? 'line-clamp-2' : ''">{{ entry.reasoning }}</p>

                <!-- Step logs (only for latest) -->
                <div v-if="idx === 0 && entry.thinkingSteps.length" class="flex flex-col gap-1">
                  <div
                    v-for="(step, i) in entry.thinkingSteps"
                    :key="i"
                    class="text-xs font-mono px-2 py-0.5 rounded bg-black/20"
                    :class="step.startsWith('[Force]') ? 'text-red-400' : step.startsWith('[Model') ? 'text-green-400' : step.startsWith('[Fallback]') ? 'text-yellow-500' : 'text-muted'"
                  >{{ step }}</div>
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <p v-else-if="!gameStore.aiMovePending" class="text-muted text-xs text-center py-6">{{ $t('play.thinking_empty') }}</p>
          </div>

          <!-- Actions -->
          <div class="flex flex-row lg:flex-col gap-2 mt-auto shrink-0">
            <button
              v-if="gameStore.gameStatus === 'playing'"
              class="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                bg-red-900/20 border border-red-700 text-red-400 hover:bg-red-900/30"
              @click="handleSurrender"
            >{{ $t('play.surrender') }}</button>
            <button
              v-if="gameStore.gameStatus !== 'idle'"
              class="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                bg-card border border-card text-primary hover:bg-section hover:border-gold/40"
              @click="handlePlayAgain"
            >{{ $t('play.play_again') }}</button>
          </div>
        </aside>
      </div>
    </div>

    <!-- Game Over Modal -->
    <Transition name="modal">
      <div
        v-if="gameStore.gameStatus !== 'playing' && gameStore.gameStatus !== 'idle'"
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in"
      >
        <div
          class="modal-box bg-card border-2 rounded-2xl p-8 sm:p-10 text-center w-[90%] max-w-sm animate-scale-in"
          :class="gameStore.gameStatus === 'won' ? 'border-green-500' : gameStore.gameStatus === 'lost' ? 'border-red-600' : 'border-card'"
        >
          <div class="text-5xl sm:text-6xl mb-4">
            <span v-if="gameStore.gameStatus === 'won'">🏆</span>
            <span v-else-if="gameStore.gameStatus === 'lost'">💀</span>
            <span v-else>🤝</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-display font-semibold text-primary mb-2">
            {{ gameStore.gameStatus === 'won' ? $t('play.victory') : gameStore.gameStatus === 'lost' ? $t('play.defeat') : $t('play.draw') }}
          </h2>
          <p class="text-secondary text-sm mb-6">
            {{ gameStore.gameStatus === 'won' ? $t('play.result_win') : gameStore.gameStatus === 'lost' ? $t('play.result_lose') : $t('play.result_draw') }}
          </p>
          <div class="flex justify-center gap-8 py-4 px-6 bg-deep rounded-xl mb-6">
            <div class="flex flex-col gap-1">
              <span class="text-2xl sm:text-3xl font-bold text-gold">{{ gameStore.moveCount }}</span>
              <span class="text-xs text-muted uppercase tracking-wide">{{ $t('play.total_moves') }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-2xl sm:text-3xl font-bold text-gold">{{ gameStore.moves.filter(m => m.player === 1).length }}</span>
              <span class="text-xs text-muted uppercase tracking-wide">{{ $t('play.your_moves') }}</span>
            </div>
          </div>
          <div class="flex gap-3">
            <button class="flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200 btn-gold" @click="handlePlayAgain">
              {{ $t('play.play_again') }}
            </button>
            <button
              class="flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200 bg-card border border-card text-primary hover:bg-section hover:border-gold/40"
              @click="changeAI"
            >{{ $t('play.change_ai') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '~/stores/gameStore'

const { t } = useI18n()
const gameStore = useGameStore()
const router = useRouter()

onMounted(() => {
  gameStore.loadUsers()
  gameStore.loadAIStats()
  if (!gameStore.currentUser || !gameStore.selectedModel) {
    router.push('/')
    return
  }
  if (gameStore.gameStatus === 'idle') gameStore.startGame()
})

async function handleCellClick(x: number, y: number) {
  if (gameStore.aiMovePending) return
  const placed = await gameStore.placeStone(x, y)
  if (placed && gameStore.gameStatus === 'playing') {
    gameStore.aiMove()
  }
}

function handleSurrender() {
  if (confirm(t('play.confirm_surrender'))) gameStore.surrender()
}

function handlePlayAgain() { gameStore.startGame() }

function changeAI() {
  gameStore.resetGame()
  router.push('/')
}

function confirmExit() {
  if (gameStore.gameStatus === 'playing') {
    if (!confirm(t('play.confirm_exit'))) return
  }
  gameStore.resetGame()
  router.push('/')
}
</script>
