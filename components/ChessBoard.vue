<template>
  <div class="w-full h-full flex items-center justify-center min-h-64 sm:min-h-96 px-2 py-3">
    <div class="chess-board" :class="{ disabled: gameStore.currentPlayer !== 1 || gameStore.aiMovePending }">
      <button
        v-for="square in squares"
        :key="square.square"
        class="chess-square"
        :class="{
          light: square.light,
          dark: !square.light,
          selected: selected === square.square,
          legal: legalTargets.includes(square.square),
          last: isLastSquare(square.square),
        }"
        @click="handleSquare(square.square)"
      >
        <span class="coord file" v-if="square.rank === 1">{{ square.file }}</span>
        <span class="coord rank" v-if="square.file === 'a'">{{ square.rank }}</span>
        <span v-if="square.piece" class="piece" :class="square.piece.color === 'w' ? 'white' : 'black'">
          {{ pieceSymbol(square.piece.color, square.piece.type) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Chess, type Square } from 'chess.js'
import { useGameStore } from '~/stores/gameStore'

const gameStore = useGameStore()
const selected = ref<Square | null>(null)

const chess = computed(() => new Chess(gameStore.chessFen))
const squares = computed(() => {
  const board = chess.value.board()
  const list: Array<{ square: Square; piece: { color: 'w' | 'b'; type: string } | null; light: boolean; file: string; rank: number }> = []
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const file = String.fromCharCode(97 + x)
      const rank = 8 - y
      list.push({
        square: `${file}${rank}` as Square,
        piece: board[y]?.[x] ?? null,
        light: (x + y) % 2 === 0,
        file,
        rank,
      })
    }
  }
  return list
})

const legalTargets = computed(() => {
  if (!selected.value) return []
  return chess.value.moves({ square: selected.value, verbose: true }).map(move => move.to)
})

function pieceSymbol(color: 'w' | 'b', type: string) {
  const symbols: Record<string, string> = {
    wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
    bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
  }
  return symbols[`${color}${type}`] ?? ''
}

function isLastSquare(square: Square) {
  const last = gameStore.moves.at(-1)
  if (!last?.uci) return false
  return last.uci.slice(0, 2) === square || last.uci.slice(2, 4) === square
}

async function handleSquare(square: Square) {
  if (gameStore.gameStatus !== 'playing' || gameStore.currentPlayer !== 1 || gameStore.aiMovePending) return
  const piece = chess.value.get(square)

  if (!selected.value) {
    if (piece?.color === 'w') selected.value = square
    return
  }

  if (selected.value === square) {
    selected.value = null
    return
  }

  if (piece?.color === 'w') {
    selected.value = square
    return
  }

  const moved = await gameStore.moveChessPiece(selected.value, square)
  selected.value = null
  if (moved && gameStore.gameStatus === 'playing') gameStore.aiMove()
}
</script>

<style scoped>
.chess-board {
  width: min(calc(100% - 28px), 560px);
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  border: 10px solid #3b2415;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 24px 44px rgba(0, 0, 0, 0.34), inset 0 0 0 2px rgba(255, 242, 210, 0.22);
}

.chess-square {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  aspect-ratio: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.chess-square.light { background: #e6c891; }
.chess-square.dark { background: #8d5f35; }

.chess-square.legal::after {
  content: "";
  position: absolute;
  width: 28%;
  height: 28%;
  border-radius: 999px;
  background: rgba(30, 132, 87, 0.72);
  box-shadow: 0 0 0 5px rgba(30, 132, 87, 0.16);
}

.chess-square.selected,
.chess-square.last {
  box-shadow: inset 0 0 0 4px rgba(212, 175, 55, 0.86);
}

.piece {
  position: relative;
  z-index: 2;
  font-family: "Times New Roman", "Noto Serif", serif;
  font-size: clamp(32px, 8vw, 58px);
  line-height: 1;
  filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.28));
}

.piece.white {
  color: #fbf2df;
  text-shadow: 0 1px 0 #7b5733, 0 0 1px #3b2415;
}

.piece.black {
  color: #17120e;
  text-shadow: 0 1px 0 rgba(255, 241, 215, 0.28);
}

.coord {
  position: absolute;
  z-index: 1;
  font-size: clamp(9px, 1.8vw, 12px);
  font-weight: 700;
  color: rgba(45, 28, 16, 0.62);
  pointer-events: none;
}

.file { right: 5px; bottom: 3px; }
.rank { left: 5px; top: 3px; }
.dark .coord { color: rgba(255, 239, 206, 0.68); }
.disabled { opacity: 0.82; }
.disabled .chess-square { cursor: default; }
</style>
