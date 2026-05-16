import { defineStore } from 'pinia'
import { useSupabase } from '~/composables/useSupabase'

export interface User {
  id: string
  nickname: string
  email?: string
  country: string
  countryCode: string
  flag: string
  totalMoves: number
  gamesPlayed: number
  wins: number
  createdAt: string
}

export type ModelProvider = 'openai' | 'anthropic' | 'deepseek' | 'minimax' | 'local'

export interface AIModel {
  id: string
  name: string
  provider: ModelProvider
  modelName?: string
  difficulty: number
  icon: string
  color: string
  wins: number
  games: number
}

export interface Move {
  x: number
  y: number
  player: 1 | 2
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost' | 'draw'

export const useGameStore = defineStore('game', {
  state: () => ({
    // User state
    currentUser: null as User | null,

    // AI Models
      aiModels: [
        { id: 'gpt55',         name: 'GPT-5.5',         provider: 'openai'    as const, modelName: 'gpt-5.5',             difficulty: 5, icon: '⚡', color: '#10a37f', wins: 0, games: 0 },
        { id: 'gpt4o',         name: 'GPT-4o',          provider: 'openai'    as const, modelName: 'gpt-4o',              difficulty: 4, icon: '⚔', color: '#74aa9c', wins: 0, games: 0 },
        { id: 'claude-opus',   name: 'Claude Opus',     provider: 'anthropic' as const, modelName: 'claude-opus-4-7',    difficulty: 5, icon: '🛡', color: '#9b59b6', wins: 0, games: 0 },
        { id: 'claude-sonnet', name: 'Claude Sonnet',   provider: 'anthropic' as const, modelName: 'claude-sonnet-4-6',  difficulty: 4, icon: '◎', color: '#3498db', wins: 0, games: 0 },
        { id: 'deepseek-pro',  name: 'DeepSeek V4 Pro', provider: 'deepseek'  as const, modelName: 'deepseek-v4-pro',    difficulty: 5, icon: '🧠', color: '#e67e22', wins: 0, games: 0 },
        { id: 'deepseek-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek' as const, modelName: 'deepseek-v4-flash', difficulty: 3, icon: '🔮', color: '#d35400', wins: 0, games: 0 },
        { id: 'minimax',       name: 'MiniMax M2.7',    provider: 'minimax'   as const, modelName: 'MiniMax-M2.7',       difficulty: 4, icon: '✦', color: '#8e44ad', wins: 0, games: 0 },
        { id: 'local',         name: 'Local AI',        provider: 'local'     as const,                                  difficulty: 2, icon: '📚', color: '#1abc9c', wins: 0, games: 0 },
      ] as AIModel[],

    // Selected AI
    selectedModel: null as AIModel | null,

    // Game state
    board: Array(15).fill(null).map(() => Array(15).fill(0)) as number[][],
    currentPlayer: 1 as 1 | 2,
    moves: [] as Move[],
    gameStatus: 'idle' as GameStatus,
    winner: null as 1 | 2 | null,
    winLine: [] as {x: number, y: number}[],
    gameStartTime: null as string | null,
    aiMovePending: false,
    aiThinking: null as null | {
      reasoning: string
      taunt: string
      thinkingSteps: string[]
      confidence: 'high' | 'medium' | 'low'
      moveLabel: string
    },
    aiThinkingHistory: [] as {
      moveNumber: number
      moveLabel: string
      reasoning: string
      taunt: string
      thinkingSteps: string[]
      confidence: 'high' | 'medium' | 'low'
    }[],

    // Users leaderboard (from storage)
    users: [] as User[],
  }),

  getters: {
    humanRanking: (state) => {
      return [...state.users]
        .sort((a, b) => b.totalMoves - a.totalMoves)
        .slice(0, 100)
    },

    aiRanking: (state) => {
      return [...state.aiModels]
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 20)
    },

    isGameActive: (state) => state.gameStatus === 'playing',

    moveCount: (state) => state.moves.length,

    currentUserRank: (state) => {
      if (!state.currentUser) return null
      const sorted = [...state.users].sort((a, b) => b.totalMoves - a.totalMoves)
      const index = sorted.findIndex(u => u.id === state.currentUser?.id)
      return index >= 0 ? index + 1 : null
    },
  },

  actions: {
    // ── User management ───────────────────────────────────────────────────────

    async setUser(userData: Omit<User, 'id' | 'totalMoves' | 'gamesPlayed' | 'wins' | 'createdAt'>) {
      const user: User = {
        ...userData,
        id: crypto.randomUUID(),
        totalMoves: 0,
        gamesPlayed: 0,
        wins: 0,
        createdAt: new Date().toISOString(),
      }
      this.currentUser = user
      if (typeof window !== 'undefined') {
        localStorage.setItem('gomoku_current_user', JSON.stringify(user))
      }

      // Persist to Supabase
      try {
        const sb = useSupabase()
        await sb.from('users').insert({
          id: user.id,
          nickname: user.nickname,
          email: user.email || null,
          country: user.country,
          country_code: user.countryCode,
          flag: user.flag,
          total_moves: 0,
          games_played: 0,
          wins: 0,
          created_at: user.createdAt,
        })
      } catch (e) {
        console.warn('Supabase insert user failed:', e)
      }

      await this.loadUsers()
    },

    async loadUsers() {
      if (typeof window === 'undefined') return

      // Restore current user from localStorage
      if (!this.currentUser) {
        const storedUser = localStorage.getItem('gomoku_current_user')
        if (storedUser) {
          try { this.currentUser = JSON.parse(storedUser) } catch {}
        }
      }

      // Load leaderboard from Supabase
      try {
        const sb = useSupabase()
        const { data, error } = await sb
          .from('users')
          .select('id,nickname,country,country_code,flag,total_moves,games_played,wins,created_at')
          .order('total_moves', { ascending: false })
          .limit(100)
        if (!error && data) {
          this.users = data.map(r => ({
            id: r.id,
            nickname: r.nickname,
            country: r.country,
            countryCode: r.country_code,
            flag: r.flag,
            totalMoves: r.total_moves,
            gamesPlayed: r.games_played,
            wins: r.wins,
            createdAt: r.created_at,
          }))
          return
        }
      } catch (e) {
        console.warn('Supabase loadUsers failed, using localStorage:', e)
      }

      // Fallback to localStorage
      const stored = localStorage.getItem('gomoku_users')
      if (stored) {
        try { this.users = JSON.parse(stored) } catch {}
      }
    },

    saveUsers() {
      if (typeof window === 'undefined') return
      localStorage.setItem('gomoku_users', JSON.stringify(this.users))
    },

    async loadAIStats() {
      if (typeof window === 'undefined') return

      // Restore selected model
      if (!this.selectedModel) {
        const storedModelId = localStorage.getItem('gomoku_selected_model')
        if (storedModelId) {
          const found = this.aiModels.find(m => m.id === storedModelId)
          if (found) this.selectedModel = found
        }
      }

      // Load AI stats from Supabase
      try {
        const sb = useSupabase()
        const { data, error } = await sb.from('ai_stats').select('model_id,wins,games')
        if (!error && data) {
          this.aiModels.forEach(model => {
            const row = data.find(r => r.model_id === model.id)
            if (row) { model.wins = row.wins; model.games = row.games }
          })
          return
        }
      } catch (e) {
        console.warn('Supabase loadAIStats failed, using localStorage:', e)
      }

      // Fallback to localStorage
      const stored = localStorage.getItem('gomoku_ai_stats')
      if (stored) {
        try {
          const stats = JSON.parse(stored)
          this.aiModels.forEach(model => {
            if (stats[model.id]) {
              model.wins = stats[model.id].wins || 0
              model.games = stats[model.id].games || 0
            }
          })
        } catch {}
      }
    },

    saveAIStats() {
      if (typeof window === 'undefined') return
      const stats: Record<string, { wins: number; games: number }> = {}
      this.aiModels.forEach(model => { stats[model.id] = { wins: model.wins, games: model.games } })
      localStorage.setItem('gomoku_ai_stats', JSON.stringify(stats))
    },

    // ── Game management ───────────────────────────────────────────────────────

    selectModel(model: AIModel) {
      this.selectedModel = model
      if (typeof window !== 'undefined') {
        localStorage.setItem('gomoku_selected_model', model.id)
      }
    },

    startGame() {
      this.board = Array(15).fill(null).map(() => Array(15).fill(0))
      this.currentPlayer = 1
      this.moves = []
      this.gameStatus = 'playing'
      this.winner = null
      this.winLine = []
      this.gameStartTime = new Date().toISOString()
      this.aiMovePending = false
      this.aiThinking = null
      this.aiThinkingHistory = []
    },

    async placeStone(x: number, y: number): Promise<boolean> {
      if (this.gameStatus !== 'playing') return false
      if (this.board[y][x] !== 0) return false
      if (this.currentPlayer !== 1) return false // Human must be player 1

      this.board[y][x] = 1
      this.moves.push({ x, y, player: 1 })

      // Check win
      const winResult = this.checkWin(x, y, 1)
      if (winResult) {
        this.gameStatus = 'won'
        this.winner = 1
        this.winLine = winResult
        await this.endGame(true)
        return true
      }

      // Check draw
      if (this.moves.length >= 225) {
        this.gameStatus = 'draw'
        await this.endGame(false)
        return true
      }

      // AI turn
      this.currentPlayer = 2
      this.aiMovePending = true
      return true
    },

    async aiMove() {
      if (this.gameStatus !== 'playing') return
      if (!this.aiMovePending) return

      const model = this.selectedModel
      let move: { x: number; y: number } | null = null

      if (model && model.provider !== 'local') {
        try {
          move = await this.aiMoveStream(model)
        } catch (err) {
          console.warn('AI stream failed, falling back to heuristic:', err)
        }
      }

      if (!move) {
        move = this.findBestMove()
      }

      if (move) {
        this.board[move.y][move.x] = 2
        this.moves.push({ x: move.x, y: move.y, player: 2 })
        this.aiMovePending = false

        const winResult = this.checkWin(move.x, move.y, 2)
        if (winResult) {
          this.gameStatus = 'lost'
          this.winner = 2
          this.winLine = winResult
          await this.endGame(false)
          return
        }

        this.currentPlayer = 1

        if (this.moves.length >= 225) {
          this.gameStatus = 'draw'
          await this.endGame(false)
        }
      }
    },

    async aiMoveStream(model: typeof this.selectedModel): Promise<{x: number, y: number} | null> {
      if (!model) return null

      // Initialize a live entry that streams into
      const moveNumber = this.moves.filter(m => m.player === 2).length + 1
      const liveEntry = {
        moveNumber,
        moveLabel: '...',
        reasoning: '',
        taunt: '',
        thinkingSteps: [] as string[],
        confidence: 'medium' as 'high' | 'medium' | 'low',
      }
      this.aiThinking = liveEntry
      this.aiThinkingHistory.unshift(liveEntry)

      return new Promise((resolve, reject) => {
        fetch('/api/ai-move-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            board: this.board,
            moves: this.moves,
            provider: model.provider,
            modelName: model.modelName,
          }),
        }).then(async (res) => {
          if (!res.ok || !res.body) {
            reject(new Error(`HTTP ${res.status}`))
            return
          }

          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buf = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })

            const parts = buf.split('\n\n')
            buf = parts.pop() ?? ''

            for (const part of parts) {
              const line = part.replace(/^data: /, '').trim()
              if (!line) continue
              try {
                const event = JSON.parse(line)
                if (event.type === 'step') {
                  this.aiThinkingHistory[0]!.thinkingSteps.push(event.text)
                } else if (event.type === 'token') {
                  if (event.field === 'reasoning') this.aiThinkingHistory[0]!.reasoning += event.text
                  else if (event.field === 'taunt') this.aiThinkingHistory[0]!.taunt += event.text
                } else if (event.type === 'done') {
                  const col = 'ABCDEFGHIJKLMNO'[event.move.x]
                  const row = event.move.y + 1
                  this.aiThinkingHistory[0]!.moveLabel = `${col}${row}`
                  this.aiThinkingHistory[0]!.reasoning = event.reasoning
                  this.aiThinkingHistory[0]!.taunt = event.taunt
                  this.aiThinkingHistory[0]!.confidence = event.confidence
                  this.aiThinkingHistory[0]!.thinkingSteps = event.thinkingSteps
                  this.aiThinking = this.aiThinkingHistory[0]!
                  resolve(event.move)
                } else if (event.type === 'error') {
                  reject(new Error(event.message))
                }
              } catch {}
            }
          }
        }).catch(reject)
      })
    },

    findBestMove(): {x: number, y: number} | null {
      const model = this.selectedModel
      if (!model) return null

      // Find all empty spots
      const emptySpots: {x: number, y: number, score: number}[] = []

      for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 15; x++) {
          if (this.board[y][x] === 0) {
            let score = 0

            // Check patterns
            const directions = [
              [0, 1], [1, 0], [1, 1], [1, -1]
            ]

            for (const [dx, dy] of directions) {
              // Check own stones (offensive)
              const ownCount = this.countInDirection(x, y, dx, dy, 2)
              const ownOpen = this.countOpenEnds(x, y, dx, dy, 2)
              score += this.getPatternScore(ownCount, ownOpen, 'offense', model.id)

              // Check opponent stones (defensive)
              const oppCount = this.countInDirection(x, y, dx, dy, 1)
              const oppOpen = this.countOpenEnds(x, y, dx, dy, 1)
              score += this.getPatternScore(oppCount, oppOpen, 'defense', model.id)
            }

            // Center preference
            const centerDist = Math.abs(x - 7) + Math.abs(y - 7)
            score += Math.max(0, (14 - centerDist) * 0.5)

            // Add some randomness based on difficulty
            const randomFactor = (6 - model.difficulty) * 2
            score += Math.random() * randomFactor

            emptySpots.push({ x, y, score })
          }
        }
      }

      if (emptySpots.length === 0) return null

      // Sort by score (model-specific behavior)
      emptySpots.sort((a, b) => b.score - a.score)

      // For some models, pick from top N options to add variety
      if (model.id === 'oracle') {
        const topOptions = emptySpots.slice(0, Math.min(5, emptySpots.length))
        const chosen = topOptions[Math.floor(Math.random() * topOptions.length)]
        return { x: chosen.x, y: chosen.y }
      }

      return { x: emptySpots[0].x, y: emptySpots[0].y }
    },

    countInDirection(x: number, y: number, dx: number, dy: number, player: number): number {
      let count = 0
      let nx = x + dx
      let ny = y + dy

      while (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && this.board[ny][nx] === player) {
        count++
        nx += dx
        ny += dy
      }

      return count
    },

    countOpenEnds(x: number, y: number, dx: number, dy: number, player: number): number {
      let openEnds = 0

      // Check forward
      let fx = x + dx
      let fy = y + dy
      if (fx >= 0 && fx < 15 && fy >= 0 && fy < 15 && this.board[fy][fx] === 0) {
        openEnds++
      }

      // Check backward
      let bx = x - dx
      let by = y - dy
      if (bx >= 0 && bx < 15 && by >= 0 && by < 15 && this.board[by][bx] === 0) {
        openEnds++
      }

      return openEnds
    },

    getPatternScore(count: number, openEnds: number, type: 'offense' | 'defense', modelId: string): number {
      let baseScore = 0

      // Model-specific strategy adjustments
      const isAggressive = modelId === 'battlemind'
      const isDefensive = modelId === 'guardian'

      if (count >= 4) baseScore = 100000 // Win or block win
      else if (count === 3) {
        baseScore = openEnds >= 2 ? 10000 : (isAggressive ? 5000 : 1000)
      }
      else if (count === 2) {
        baseScore = openEnds >= 2 ? (isDefensive ? 500 : 1000) : (isAggressive ? 200 : 100)
      }
      else if (count === 1) {
        baseScore = openEnds >= 2 ? 50 : 10
      }

      // Defensive is prioritized for guardian
      if (type === 'defense' && isDefensive) {
        baseScore *= 1.5
      }

      return baseScore
    },

    checkWin(x: number, y: number, player: number): {x: number, y: number}[] | null {
      const directions = [
        { dx: 0, dy: 1 },  // vertical
        { dx: 1, dy: 0 },  // horizontal
        { dx: 1, dy: 1 },   // diagonal
        { dx: 1, dy: -1 }   // anti-diagonal
      ]

      for (const { dx, dy } of directions) {
        const line = [{ x, y }]

        // Forward direction
        let nx = x + dx
        let ny = y + dy
        while (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && this.board[ny][nx] === player) {
          line.push({ x: nx, y: ny })
          nx += dx
          ny += dy
        }

        // Backward direction
        nx = x - dx
        ny = y - dy
        while (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && this.board[ny][nx] === player) {
          line.unshift({ x: nx, y: ny })
          nx -= dx
          ny -= dy
        }

        if (line.length >= 5) {
          return line
        }
      }

      return null
    },

    async endGame(playerWon: boolean) {
      const result: 'won' | 'lost' | 'draw' =
        this.gameStatus === 'draw' ? 'draw' : playerWon ? 'won' : 'lost'

      if (this.currentUser) {
        this.currentUser.totalMoves += this.moves.length
        this.currentUser.gamesPlayed++
        if (playerWon) this.currentUser.wins++

        // Persist user stats to Supabase
        try {
          const sb = useSupabase()
          await sb.from('users').update({
            total_moves: this.currentUser.totalMoves,
            games_played: this.currentUser.gamesPlayed,
            wins: this.currentUser.wins,
          }).eq('id', this.currentUser.id)
        } catch (e) {
          console.warn('Supabase update user stats failed:', e)
        }

        // Fallback local save
        this.saveUsers()
        if (typeof window !== 'undefined') {
          localStorage.setItem('gomoku_current_user', JSON.stringify(this.currentUser))
        }
      }

      if (this.selectedModel) {
        this.selectedModel.games++
        if (!playerWon) this.selectedModel.wins++

        // Persist AI stats to Supabase
        try {
          const sb = useSupabase()
          await sb.from('ai_stats').update({
            wins: this.selectedModel.wins,
            games: this.selectedModel.games,
          }).eq('model_id', this.selectedModel.id)
        } catch (e) {
          console.warn('Supabase update ai_stats failed:', e)
        }

        this.saveAIStats()
      }

      // Write game record
      if (this.currentUser && this.selectedModel) {
        try {
          const sb = useSupabase()
          await sb.from('games').insert({
            user_id: this.currentUser.id,
            model_id: this.selectedModel.id,
            result,
            move_count: this.moves.length,
          })
        } catch (e) {
          console.warn('Supabase insert game failed:', e)
        }
      }
    },

    surrender() {
      if (this.gameStatus !== 'playing') return
      this.gameStatus = 'lost'
      this.winner = 2
      this.endGame(false)   // fire-and-forget ok here
    },

    resetGame() {
      this.board = Array(15).fill(null).map(() => Array(15).fill(0))
      this.currentPlayer = 1
      this.moves = []
      this.gameStatus = 'idle'
      this.winner = null
      this.winLine = []
      this.aiMovePending = false
      this.aiThinking = null
      this.aiThinkingHistory = []
      this.selectedModel = null
    }
  }
})