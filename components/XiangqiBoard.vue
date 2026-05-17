<template>
  <div class="w-full h-full flex items-center justify-center min-h-64 sm:min-h-96 px-2 py-3">
    <div class="xiangqi-board" :class="{ disabled: gameStore.currentPlayer !== 1 || gameStore.aiMovePending }">
      <div class="river">
        <span>楚 河</span>
        <span>汉 界</span>
      </div>

      <div class="grid-lines" aria-hidden="true">
        <span v-for="i in 10" :key="`h-${i}`" class="h-line" :style="{ top: `${(i - 1) * 11.111}%` }"></span>
        <template v-for="i in 9" :key="`v-${i}`">
          <span class="v-line v-line-top" :class="{ edge: i === 1 || i === 9 }" :style="{ left: `${(i - 1) * 12.5}%` }"></span>
          <span v-if="i !== 1 && i !== 9" class="v-line v-line-bottom" :style="{ left: `${(i - 1) * 12.5}%` }"></span>
        </template>
        <span class="palace palace-top palace-a"></span>
        <span class="palace palace-top palace-b"></span>
        <span class="palace palace-bottom palace-a"></span>
        <span class="palace palace-bottom palace-b"></span>
        <span
          v-for="mark in marks"
          :key="`${mark.x}-${mark.y}-${mark.corner}`"
          class="rank-mark"
          :class="mark.corner"
          :style="{ left: `${mark.x * 12.5}%`, top: `${mark.y * 11.111}%` }"
        ></span>
      </div>

      <button
        v-for="point in points"
        :key="`${point.x}-${point.y}`"
        class="point"
        :class="{
          selected: selected?.x === point.x && selected?.y === point.y,
          legal: isLegalTarget(point.x, point.y),
          capture: isLegalTarget(point.x, point.y) && !!pieceAt(point.x, point.y),
          last: isLastMove(point.x, point.y),
        }"
        :style="{ left: `${point.x * 12.5}%`, top: `${point.y * 11.111}%` }"
        :aria-label="pieceAt(point.x, point.y) ? gameStore.xiangqiPieceLabel(pieceAt(point.x, point.y)) : `point ${point.x},${point.y}`"
        @click="handlePoint(point.x, point.y)"
      >
        <span
          v-if="pieceAt(point.x, point.y)"
          class="piece"
          :class="pieceAt(point.x, point.y)?.startsWith('r') ? 'red' : 'black'"
        >
          <span class="piece-inner">{{ gameStore.xiangqiPieceLabel(pieceAt(point.x, point.y)) }}</span>
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

const marks = [
  { x: 1, y: 2, corner: 'tl' }, { x: 1, y: 2, corner: 'bl' }, { x: 7, y: 2, corner: 'tr' }, { x: 7, y: 2, corner: 'br' },
  { x: 0, y: 3, corner: 'tr' }, { x: 0, y: 3, corner: 'br' }, { x: 2, y: 3, corner: 'tl' }, { x: 2, y: 3, corner: 'tr' }, { x: 2, y: 3, corner: 'bl' }, { x: 2, y: 3, corner: 'br' },
  { x: 4, y: 3, corner: 'tl' }, { x: 4, y: 3, corner: 'tr' }, { x: 4, y: 3, corner: 'bl' }, { x: 4, y: 3, corner: 'br' },
  { x: 6, y: 3, corner: 'tl' }, { x: 6, y: 3, corner: 'tr' }, { x: 6, y: 3, corner: 'bl' }, { x: 6, y: 3, corner: 'br' },
  { x: 8, y: 3, corner: 'tl' }, { x: 8, y: 3, corner: 'bl' },
  { x: 0, y: 6, corner: 'tr' }, { x: 0, y: 6, corner: 'br' }, { x: 2, y: 6, corner: 'tl' }, { x: 2, y: 6, corner: 'tr' }, { x: 2, y: 6, corner: 'bl' }, { x: 2, y: 6, corner: 'br' },
  { x: 4, y: 6, corner: 'tl' }, { x: 4, y: 6, corner: 'tr' }, { x: 4, y: 6, corner: 'bl' }, { x: 4, y: 6, corner: 'br' },
  { x: 6, y: 6, corner: 'tl' }, { x: 6, y: 6, corner: 'tr' }, { x: 6, y: 6, corner: 'bl' }, { x: 6, y: 6, corner: 'br' },
  { x: 8, y: 6, corner: 'tl' }, { x: 8, y: 6, corner: 'bl' },
  { x: 1, y: 7, corner: 'tl' }, { x: 1, y: 7, corner: 'bl' }, { x: 7, y: 7, corner: 'tr' }, { x: 7, y: 7, corner: 'br' },
]

function pieceAt(x: number, y: number): XiangqiPiece | null {
  return gameStore.xiangqiBoard[y]?.[x] ?? null
}

function isLegalTarget(x: number, y: number) {
  if (!selected.value) return false
  return gameStore.isLegalXiangqiMove(gameStore.xiangqiBoard, selected.value.x, selected.value.y, x, y, 1)
}

function isLastMove(x: number, y: number) {
  const last = gameStore.moves.at(-1)
  if (!last) return false
  return (last.x === x && last.y === y) || (last.fromX === x && last.fromY === y)
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
  width: min(calc(100% - 68px), 580px);
  aspect-ratio: 8 / 9;
  margin: clamp(18px, 4vw, 34px);
  color: #2b1608;
  filter: drop-shadow(0 24px 44px rgba(0, 0, 0, 0.34));
}

.xiangqi-board::before {
  content: "";
  position: absolute;
  inset: -34px;
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(95, 48, 14, 0.14), transparent 12%, rgba(255, 242, 199, 0.22) 28%, transparent 46%, rgba(95, 48, 14, 0.12)),
    linear-gradient(135deg, #b87133 0%, #e6b869 45%, #c58543 100%);
  box-shadow:
    inset 0 0 0 2px rgba(80, 39, 12, 0.7),
    inset 0 0 0 10px rgba(94, 47, 14, 0.2),
    0 16px 36px rgba(0, 0, 0, 0.3);
}

.xiangqi-board::after {
  content: "";
  position: absolute;
  inset: -18px;
  border: 3px solid rgba(62, 30, 8, 0.78);
  border-radius: 4px;
  pointer-events: none;
}

.grid-lines {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.h-line,
.v-line,
.palace {
  position: absolute;
  background: rgba(58, 29, 8, 0.88);
  box-shadow: 0 0 0 0.5px rgba(255, 232, 174, 0.24);
}

.h-line {
  left: 0;
  right: 0;
  height: 2px;
}

.v-line {
  width: 2px;
}

.v-line-top {
  top: 0;
  height: 44.444%;
}

.v-line-top.edge {
  bottom: 0;
  height: auto;
}

.v-line-bottom {
  top: 55.556%;
  bottom: 0;
}

.palace {
  width: 35.36%;
  height: 2px;
  left: 32.32%;
  transform-origin: center;
}

.palace-a { transform: rotate(41.6deg); }
.palace-b { transform: rotate(-41.6deg); }
.palace-top { top: 11.1%; }
.palace-bottom { bottom: 11.1%; }

.river {
  position: absolute;
  z-index: 2;
  left: 7%;
  right: 7%;
  top: 44.444%;
  height: 11.111%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(72, 34, 9, 0.7);
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: clamp(22px, 4.8vw, 40px);
  font-weight: 700;
  letter-spacing: 0.18em;
  pointer-events: none;
  text-shadow: 0 1px 0 rgba(255, 236, 188, 0.5);
}

.rank-mark {
  position: absolute;
  z-index: 2;
  width: clamp(8px, 1.6vw, 14px);
  height: clamp(8px, 1.6vw, 14px);
  pointer-events: none;
}

.rank-mark::before,
.rank-mark::after {
  content: "";
  position: absolute;
  background: rgba(58, 29, 8, 0.72);
}

.rank-mark::before {
  width: 2px;
  height: 100%;
}

.rank-mark::after {
  width: 100%;
  height: 2px;
}

.rank-mark.tl { transform: translate(-18px, -18px); }
.rank-mark.tr { transform: translate(8px, -18px); }
.rank-mark.bl { transform: translate(-18px, 8px); }
.rank-mark.br { transform: translate(8px, 8px); }
.rank-mark.tl::before,
.rank-mark.bl::before { right: 0; }
.rank-mark.tr::before,
.rank-mark.br::before { left: 0; }
.rank-mark.tl::after,
.rank-mark.tr::after { bottom: 0; }
.rank-mark.bl::after,
.rank-mark.br::after { top: 0; }

.point {
  position: absolute;
  z-index: 4;
  width: clamp(36px, 8.6vw, 58px);
  height: clamp(36px, 8.6vw, 58px);
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: transparent;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.point::before {
  content: "";
  position: absolute;
  width: 28%;
  height: 28%;
  border-radius: 999px;
  background: transparent;
  transition: background 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.point.legal::before {
  background: rgba(32, 132, 91, 0.72);
  box-shadow: 0 0 0 5px rgba(32, 132, 91, 0.16);
}

.point.capture::before {
  background: rgba(190, 44, 36, 0.82);
  box-shadow: 0 0 0 5px rgba(190, 44, 36, 0.18);
}

.point.selected::before,
.point.last::before {
  width: 86%;
  height: 86%;
  border: 3px solid rgba(33, 132, 90, 0.92);
  background: rgba(33, 132, 90, 0.08);
  box-shadow: 0 0 0 4px rgba(33, 132, 90, 0.13);
}

.point.last:not(.selected)::before {
  border-color: rgba(212, 175, 55, 0.9);
  background: rgba(212, 175, 55, 0.09);
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.12);
}

.piece {
  position: relative;
  z-index: 2;
  width: 94%;
  height: 94%;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 35% 28%, rgba(255, 247, 221, 0.95), rgba(228, 179, 102, 0.96) 54%, rgba(133, 76, 32, 0.95));
  border: 2px solid rgba(73, 36, 10, 0.88);
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.26),
    inset 0 0 0 3px rgba(255, 239, 196, 0.32),
    inset 0 -8px 14px rgba(88, 43, 12, 0.22);
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-weight: 800;
  font-size: clamp(21px, 5vw, 34px);
  line-height: 1;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.piece::before {
  content: "";
  position: absolute;
  inset: 7px;
  border-radius: 999px;
  border: 2px solid currentColor;
  opacity: 0.42;
}

.piece-inner {
  position: relative;
  z-index: 1;
  transform: translateY(-1px);
  text-shadow: 0 1px 0 rgba(255, 241, 210, 0.5);
}

.piece.red {
  color: #a21d16;
}

.piece.black {
  color: #1c1712;
}

.point:hover .piece {
  transform: translateY(-2px);
  box-shadow:
    0 12px 20px rgba(0, 0, 0, 0.28),
    inset 0 0 0 3px rgba(255, 239, 196, 0.36),
    inset 0 -8px 14px rgba(88, 43, 12, 0.22);
}

.disabled {
  opacity: 0.82;
  cursor: default;
}

.disabled .point {
  cursor: default;
}

@media (max-width: 520px) {
  .xiangqi-board {
    width: min(calc(100% - 56px), 580px);
    margin: 24px 16px;
  }

  .xiangqi-board::before {
    inset: -22px;
  }

  .xiangqi-board::after {
    inset: -12px;
  }

  .rank-mark {
    display: none;
  }

  .river {
    left: 10%;
    right: 10%;
    letter-spacing: 0.1em;
  }
}
</style>
