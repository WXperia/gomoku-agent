<template>
  <div ref="containerRef" class="w-full h-full flex items-center justify-center min-h-64 sm:min-h-96">
    <canvas ref="canvasRef" class="block"></canvas>
  </div>
</template>

<script setup lang="ts">
import * as PIXI from 'pixi.js'
import { useGameStore } from '~/stores/gameStore'

const gameStore = useGameStore()
const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()

let app: PIXI.Application | null = null
let boardContainer: PIXI.Container | null = null
let hoveredCell: { x: number; y: number } | null = null
let resizeHandler: (() => void) | null = null

const CELL_SIZE = 36
const BOARD_SIZE = 15
const BOARD_PIXELS = CELL_SIZE * (BOARD_SIZE - 1)
const BOARD_OFFSET = CELL_SIZE * 1.5

const emit = defineEmits<{
  (e: 'cellClick', x: number, y: number): void
}>()

onMounted(async () => {
  await nextTick()
  await initPixi()

  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  resizeHandler = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => resizePixi(), 100)
  }
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
  if (app) {
    try { app.destroy(false) } catch {}
    app = null
  }
  boardContainer = null
})

function resizePixi() {
  if (!app || !containerRef.value || !boardContainer) return

  const containerWidth = containerRef.value.clientWidth || 600
  const containerHeight = containerRef.value.clientHeight || 600

  app.renderer.resize(containerWidth, containerHeight)
  app.stage.hitArea = new PIXI.Rectangle(0, 0, containerWidth, containerHeight)

  const maxBoardSize = Math.min(containerWidth, containerHeight) - 48
  const totalBoardPixels = BOARD_PIXELS + BOARD_OFFSET * 2
  const scale = Math.min(1, maxBoardSize / totalBoardPixels)

  boardContainer.scale.set(scale)
  boardContainer.position.set(
    (containerWidth - totalBoardPixels * scale) / 2,
    (containerHeight - totalBoardPixels * scale) / 2,
  )
}

async function initPixi() {
  if (!canvasRef.value || !containerRef.value) return

  const containerWidth = containerRef.value.clientWidth || 600
  const containerHeight = containerRef.value.clientHeight || 600

  const maxBoardSize = Math.min(containerWidth, containerHeight) - 48
  const totalBoardPixels = BOARD_PIXELS + BOARD_OFFSET * 2
  const scale = Math.min(1, maxBoardSize / totalBoardPixels)

  app = new PIXI.Application()
  await app.init({
    canvas: canvasRef.value,
    width: containerWidth,
    height: containerHeight,
    background: 0x1a1a2e,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  const offsetX = (containerWidth - totalBoardPixels * scale) / 2
  const offsetY = (containerHeight - totalBoardPixels * scale) / 2

  boardContainer = new PIXI.Container()
  boardContainer.position.set(offsetX, offsetY)
  boardContainer.scale.set(scale)
  app.stage.addChild(boardContainer)

  drawBoard()

  app.stage.eventMode = 'static'
  app.stage.hitArea = new PIXI.Rectangle(0, 0, containerWidth, containerHeight)
  app.stage.on('pointermove', onPointerMove)
  app.stage.on('pointerdown', onPointerDown)
}

function drawBoard() {
  if (!boardContainer) return
  boardContainer.removeChildren()

  const bg = new PIXI.Graphics()
  bg.roundRect(-20, -20, BOARD_PIXELS + BOARD_OFFSET * 2 + 40, BOARD_PIXELS + BOARD_OFFSET * 2 + 40, 8)
  bg.fill({ color: 0x2d5a3d })
  boardContainer.addChild(bg)

  const grid = new PIXI.Graphics()
  grid.setStrokeStyle({ width: 1, color: 0x4a7c59, alpha: 1 })
  for (let i = 0; i < BOARD_SIZE; i++) {
    grid.moveTo(BOARD_OFFSET + i * CELL_SIZE, BOARD_OFFSET)
    grid.lineTo(BOARD_OFFSET + i * CELL_SIZE, BOARD_OFFSET + BOARD_PIXELS)
    grid.moveTo(BOARD_OFFSET, BOARD_OFFSET + i * CELL_SIZE)
    grid.lineTo(BOARD_OFFSET + BOARD_PIXELS, BOARD_OFFSET + i * CELL_SIZE)
  }
  grid.stroke()
  boardContainer.addChild(grid)

  const starPoints = [[3,3],[3,11],[7,7],[11,3],[11,11]]
  const stars = new PIXI.Graphics()
  for (const [x, y] of starPoints) {
    stars.circle(BOARD_OFFSET + x * CELL_SIZE, BOARD_OFFSET + y * CELL_SIZE, 4)
  }
  stars.fill({ color: 0x1a3a2a })
  boardContainer.addChild(stars)

  if (hoveredCell && gameStore.gameStatus === 'playing' && gameStore.currentPlayer === 1) {
    const { x, y } = hoveredCell
    if (gameStore.board[y][x] === 0) {
      const preview = new PIXI.Graphics()
      preview.circle(BOARD_OFFSET + x * CELL_SIZE, BOARD_OFFSET + y * CELL_SIZE, CELL_SIZE * 0.42)
      preview.fill({ color: 0x0f0f0f, alpha: 0.3 })
      boardContainer.addChild(preview)
    }
  }

  const stones = new PIXI.Graphics()
  for (let i = 0; i < gameStore.moves.length; i++) {
    const move = gameStore.moves[i]
    const cx = BOARD_OFFSET + move.x * CELL_SIZE
    const cy = BOARD_OFFSET + move.y * CELL_SIZE
    const r = CELL_SIZE * 0.42
    const color = move.player === 1 ? 0x111111 : 0xeeeeee

    stones.circle(cx + 2, cy + 2, r)
    stones.fill({ color: 0x000000, alpha: 0.3 })
    stones.circle(cx, cy, r)
    stones.fill({ color })

    if (i === gameStore.moves.length - 1) {
      stones.circle(cx, cy, r * 0.4)
      stones.fill({ color: move.player === 1 ? 0x555555 : 0xaaaaaa, alpha: 0.5 })
    }
  }
  boardContainer.addChild(stones)

  if (gameStore.winLine.length > 0) {
    const winLine = new PIXI.Graphics()
    const start = gameStore.winLine[0]
    const end = gameStore.winLine[gameStore.winLine.length - 1]
    winLine.setStrokeStyle({ width: 4, color: 0xd4af37, alpha: 0.9 })
    winLine.moveTo(BOARD_OFFSET + start.x * CELL_SIZE, BOARD_OFFSET + start.y * CELL_SIZE)
    winLine.lineTo(BOARD_OFFSET + end.x * CELL_SIZE, BOARD_OFFSET + end.y * CELL_SIZE)
    winLine.stroke()
    boardContainer.addChild(winLine)

    const winDots = new PIXI.Graphics()
    for (const pt of gameStore.winLine) {
      winDots.circle(BOARD_OFFSET + pt.x * CELL_SIZE, BOARD_OFFSET + pt.y * CELL_SIZE, CELL_SIZE * 0.48)
      winDots.stroke({ width: 2, color: 0xd4af37, alpha: 0.8 })
    }
    boardContainer.addChild(winDots)
  }
}

function getBoardCoords(stageX: number, stageY: number): { x: number; y: number } | null {
  if (!boardContainer) return null
  const localX = (stageX - boardContainer.position.x) / boardContainer.scale.x
  const localY = (stageY - boardContainer.position.y) / boardContainer.scale.y
  const x = Math.round((localX - BOARD_OFFSET) / CELL_SIZE)
  const y = Math.round((localY - BOARD_OFFSET) / CELL_SIZE)
  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return null
  return { x, y }
}

function onPointerMove(event: PIXI.FederatedPointerEvent) {
  hoveredCell = getBoardCoords(event.global.x, event.global.y)
  drawBoard()
}

function onPointerDown(event: PIXI.FederatedPointerEvent) {
  const coords = getBoardCoords(event.global.x, event.global.y)
  if (coords) emit('cellClick', coords.x, coords.y)
}

watch(() => gameStore.moves.length, () => drawBoard())
watch(() => gameStore.winLine.length, () => drawBoard())
watch(() => gameStore.gameStatus, () => drawBoard())
</script>
