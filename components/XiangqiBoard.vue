<template>
  <div class="w-full h-full flex items-center justify-center min-h-64 sm:min-h-96">
    <div class="xiangqi-board" :class="{ disabled: gameStore.currentPlayer !== 1 || gameStore.aiMovePending }">
      <div class="river">楚河&nbsp;&nbsp;&nbsp;&nbsp;漢界</div>

      <div class="grid-lines" aria-hidden="true">
        <span v-for="i in 10" :key="`h-${i}`" class="h-line" :style="{ top: `${(i - 1) * 11.111}%` }"></span>
        <span v-for="i in 9" :key="`v-${i}`" class="v-line" :style="{ left: `${(i - 1) * 12.5}%` }"></span>
        <span class="palace palace-top"></span>
        <span class="palace palace-bottom"></span>
      </div>

      <button
        v-for="point in points"
        :key="`${point.x}-${point.y}`"
        class="point"
        :class="{
          selected: selected?.x === point.x && selected?.y === point.y,
          legal: isLegalTarget(point.x, point.y),
        }"
        :style="{ left: `${point.x * 12.5}%`, top: `${point.y * 11.111}%` }"
        @click="handlePoint(point.x, point.y)"
      >
        <span
          v-if="pieceAt(point.x, point.y)"
          class="piece"
          :class="pieceAt(point.x, point.y)?.startsWith('r') ? 'red' : 'black'"
        >
          {{ gameStore.xiangqiPieceLabel(pieceAt(point.x, point.y)) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore, type XiangqiPiece } from '~/stores/gameStore'

const gameStore = useGameStore()
const selected = ref<{ x: number; y: number } | null>(null)

const points = computed(() => {
  const list: Array<{ x: number; y: number }> = []
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) list.push({ x, y })
  }
  return list
})

function pieceAt(x: number, y: number): XiangqiPiece | null {
  return gameStore.xiangqiBoard[y]?.[x] ?? null
}

function isLegalTarget(x: number, y: number) {
  if (!selected.value) return false
  return gameStore.isLegalXiangqiMove(gameStore.xiangqiBoard, selected.value.x, selected.value.y, x, y, 1)
}

async function handlePoint(x: number, y: number) {
  if (gameStore.gameStatus !== 'playing' || gameStore.currentPlayer !== 1 || gameStore.aiMovePending) return

  const piece = pieceAt(x, y)
  if (!selected.value) {
    if (piece?.startsWith('r')) selected.value = { x, y }
    return
  }

  if (selected.value.x === x && selected.value.y === y) {
    selected.value = null
    return
  }

  if (piece?.startsWith('r')) {
    selected.value = { x, y }
    return
  }

  const moved = await gameStore.moveXiangqiPiece(selected.value.x, selected.value.y, x, y)
  selected.value = null
  if (moved && gameStore.gameStatus === 'playing') gameStore.aiMove()
}
</script>

<style scoped>
.xiangqi-board {
  position: relative;
  width: min(100%, 560px);
  aspect-ratio: 8 / 9;
  margin: 20px;
  color: #24150b;
}

.xiangqi-board::before {
  content: "";
  position: absolute;
  inset: -28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #c99550, #f0c77a 48%, #b97836);
  box-shadow: inset 0 0 0 2px rgba(82, 42, 13, 0.45), 0 18px 48px rgba(0, 0, 0, 0.28);
}

.grid-lines {
  position: absolute;
  inset: 0;
}

.h-line,
.v-line,
.palace {
  position: absolute;
  background: rgba(55, 28, 10, 0.72);
}

.h-line {
  left: 0;
  right: 0;
  height: 2px;
}

.v-line {
  top: 0;
  bottom: 0;
  width: 2px;
}

.palace {
  width: 35.4%;
  height: 2px;
  left: 31.8%;
  transform-origin: center;
}

.palace-top {
  top: 11.2%;
  transform: rotate(33deg);
}

.palace-bottom {
  bottom: 11.2%;
  transform: rotate(-33deg);
}

.river {
  position: absolute;
  z-index: 1;
  left: 6%;
  right: 6%;
  top: 44.5%;
  height: 11%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(74, 37, 12, 0.72);
  font-family: serif;
  font-size: clamp(18px, 4vw, 34px);
  letter-spacing: 0.16em;
  pointer-events: none;
}

.point {
  position: absolute;
  z-index: 2;
  width: clamp(34px, 8vw, 54px);
  height: clamp(34px, 8vw, 54px);
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: transparent;
  border: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.point.legal {
  border-color: rgba(212, 175, 55, 0.68);
  background: rgba(212, 175, 55, 0.16);
}

.point.selected {
  border-color: #27ae60;
  background: rgba(39, 174, 96, 0.18);
}

.piece {
  width: 92%;
  height: 92%;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 35% 30%, #fff3d4, #d79a4c 72%, #8e5525);
  border: 2px solid rgba(88, 45, 13, 0.72);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.28), inset 0 0 0 2px rgba(255, 239, 199, 0.38);
  font-family: serif;
  font-weight: 700;
  font-size: clamp(19px, 4.4vw, 30px);
  line-height: 1;
}

.piece.red { color: #b42318; }
.piece.black { color: #171717; }
.disabled { opacity: 0.78; }
</style>
