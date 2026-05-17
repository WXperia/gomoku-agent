import { defineStore } from 'pinia'
import { useSupabase } from '~/composables/useSupabase'
import { getBrowserFingerprint } from '~/composables/useBrowserFingerprint'

export interface User {
  id: string
  authUserId?: string
  nickname: string
  email?: string
  country: string
  countryCode: string
  flag: string
  totalMoves: number
  gamesPlayed: number
  wins: number
  browserFingerprint?: string
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
  fromX?: number
  fromY?: number
  piece?: string
  captured?: string | null
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost' | 'draw'
export type GameKind = 'gomoku' | 'xiangqi'
export type XiangqiPiece = 'rK' | 'rA' | 'rB' | 'rN' | 'rR' | 'rC' | 'rP' | 'bK' | 'bA' | 'bB' | 'bN' | 'bR' | 'bC' | 'bP'

function createXiangqiBoard(): (XiangqiPiece | null)[][] {
  return [
    ['bR', 'bN', 'bB', 'bA', 'bK', 'bA', 'bB', 'bN', 'bR'],
    [null, null, null, null, null, null, null, null, null],
    [null, 'bC', null, null, null, null, null, 'bC', null],
    ['bP', null, 'bP', null, 'bP', null, 'bP', null, 'bP'],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    ['rP', null, 'rP', null, 'rP', null, 'rP', null, 'rP'],
    [null, 'rC', null, null, null, null, null, 'rC', null],
    [null, null, null, null, null, null, null, null, null],
    ['rR', 'rN', 'rB', 'rA', 'rK', 'rA', 'rB', 'rN', 'rR'],
  ] as (XiangqiPiece | null)[][]
}

export const useGameStore = defineStore('game', {
  state: () => ({
    // User state
    currentUser: null as User | null,

    // AI Models
      aiModels: [
        { id: 'gpt55',         name: 'GPT-5.5',         provider: 'openai'    as const, modelName: 'gpt-5.5',             difficulty: 5, icon: '⚡', color: '#10a37f', wins: 0, games: 0 },
        { id: 'claude-opus',   name: 'Claude Opus 4.7', provider: 'anthropic' as const, modelName: 'claude-opus-4-7',    difficulty: 5, icon: '🛡', color: '#9b59b6', wins: 0, games: 0 },
        { id: 'claude-sonnet', name: 'Claude Sonnet 4.6', provider: 'anthropic' as const, modelName: 'claude-sonnet-4-6',  difficulty: 4, icon: '◎', color: '#3498db', wins: 0, games: 0 },
        { id: 'deepseek-pro',  name: 'DeepSeek V4 Pro', provider: 'deepseek'  as const, modelName: 'deepseek-v4-pro',    difficulty: 5, icon: '🧠', color: '#e67e22', wins: 0, games: 0 },
        { id: 'deepseek-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek' as const, modelName: 'deepseek-v4-flash', difficulty: 3, icon: '🔮', color: '#d35400', wins: 0, games: 0 },
        { id: 'minimax',       name: 'MiniMax M2.7',    provider: 'minimax'   as const, modelName: 'MiniMax-M2.7',       difficulty: 4, icon: '✦', color: '#8e44ad', wins: 0, games: 0 },
        { id: 'local',         name: 'Local AI',        provider: 'local'     as const,                                  difficulty: 2, icon: '📚', color: '#1abc9c', wins: 0, games: 0 },
      ] as AIModel[],

    // Selected AI
    selectedModel: null as AIModel | null,
    selectedGameKind: 'gomoku' as GameKind,

    // Game state
    board: Array(15).fill(null).map(() => Array(15).fill(0)) as number[][],
    xiangqiBoard: createXiangqiBoard(),
    currentPlayer: 1 as 1 | 2,
    moves: [] as Move[],
    gameStatus: 'idle' as GameStatus,
    winner: null as 1 | 2 | null,
    winLine: [] as {x: number, y: number}[],
    gameStartTime: null as string | null,
    currentGameId: null as number | null,
    lastMoveAt: null as number | null,
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

    async ensureAuthSession() {
      if (typeof window === 'undefined') return null
      const sb = useSupabase()
      const { data: existing, error: existingError } = await sb.auth.getSession()
      if (existingError) throw existingError
      if (existing.session) return existing.session

      const { data, error } = await sb.auth.signInAnonymously()
      if (error) throw error
      return data.session
    },

    async getAuthHeader() {
      const session = await this.ensureAuthSession()
      if (!session?.access_token) {
        throw new Error('Supabase anonymous session is unavailable.')
      }
      return { Authorization: `Bearer ${session.access_token}` }
    },

    async setUser(userData: Omit<User, 'id' | 'authUserId' | 'totalMoves' | 'gamesPlayed' | 'wins' | 'createdAt'>) {
      const browserFingerprint = await getBrowserFingerprint()
      const session = await this.ensureAuthSession().catch((e) => {
        console.warn('Supabase anonymous sign-in failed:', e)
        return null
      })
      const user: User = {
        ...userData,
        id: crypto.randomUUID(),
        authUserId: session?.user?.id,
        totalMoves: 0,
        gamesPlayed: 0,
        wins: 0,
        browserFingerprint,
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
          auth_user_id: session?.user?.id ?? null,
          browser_fingerprint: browserFingerprint || null,
          created_at: user.createdAt,
        })
      } catch (e) {
        console.warn('Supabase insert user failed:', e)
      }

      await this.loadUsers()
    },

    async loadUsers() {
      if (typeof window === 'undefined') return
      const browserFingerprint = await getBrowserFingerprint()

      // Restore current user from localStorage
      if (!this.currentUser) {
        const storedUser = localStorage.getItem('gomoku_current_user')
        if (storedUser) {
          try { this.currentUser = JSON.parse(storedUser) } catch {}
        }
      }

      if (!this.currentUser && browserFingerprint) {
        try {
          const sb = useSupabase()
          const { data, error } = await sb
            .from('users')
            .select('id,auth_user_id,nickname,country,country_code,flag,total_moves,games_played,wins,email,browser_fingerprint,created_at')
            .eq('browser_fingerprint', browserFingerprint)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!error && data) {
            this.currentUser = {
              id: data.id,
              authUserId: data.auth_user_id || undefined,
              nickname: data.nickname,
              email: data.email || undefined,
              country: data.country,
              countryCode: data.country_code,
              flag: data.flag,
              totalMoves: data.total_moves,
              gamesPlayed: data.games_played,
              wins: data.wins,
              browserFingerprint: data.browser_fingerprint || undefined,
              createdAt: data.created_at,
            }
            localStorage.setItem('gomoku_current_user', JSON.stringify(this.currentUser))
          }
        } catch (e) {
          console.warn('Supabase fingerprint restore failed:', e)
        }
      }

      // Load leaderboard from Supabase
      try {
        const sb = useSupabase()
        const { data, error } = await sb
          .from('users')
          .select('id,auth_user_id,nickname,country,country_code,flag,total_moves,games_played,wins,browser_fingerprint,created_at')
          .order('total_moves', { ascending: false })
          .limit(100)
        if (!error && data) {
          this.users = data.map(r => ({
            id: r.id,
            authUserId: r.auth_user_id || undefined,
            nickname: r.nickname,
            country: r.country,
            countryCode: r.country_code,
            flag: r.flag,
            totalMoves: r.total_moves,
            gamesPlayed: r.games_played,
            wins: r.wins,
            browserFingerprint: r.browser_fingerprint || undefined,
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

    async logoutUser() {
      this.currentUser = null
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gomoku_current_user')
      }
      try {
        const sb = useSupabase()
        await sb.auth.signOut()
      } catch (e) {
        console.warn('Supabase sign out failed:', e)
      }
      this.resetGame()
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

      const storedGameKind = localStorage.getItem('gomoku_game_kind')
      if (storedGameKind === 'gomoku' || storedGameKind === 'xiangqi') {
        this.selectedGameKind = storedGameKind
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

    selectGameKind(kind: GameKind) {
      this.selectedGameKind = kind
      if (typeof window !== 'undefined') {
        localStorage.setItem('gomoku_game_kind', kind)
      }
    },

    async startGame() {
      this.board = Array(15).fill(null).map(() => Array(15).fill(0))
      this.xiangqiBoard = createXiangqiBoard()
      this.currentPlayer = 1
      this.moves = []
      this.gameStatus = 'playing'
      this.winner = null
      this.winLine = []
      this.gameStartTime = new Date().toISOString()
      this.currentGameId = null
      this.lastMoveAt = Date.now()
      this.aiMovePending = false
      this.aiThinking = null
      this.aiThinkingHistory = []
      await this.createRemoteGame()
    },

    async createRemoteGame() {
      if (!this.currentUser || !this.selectedModel) return

      try {
        const sb = useSupabase()
        const session = await this.ensureAuthSession()
        if (session?.user?.id && this.currentUser.authUserId !== session.user.id) {
          this.currentUser.authUserId = session.user.id
          if (typeof window !== 'undefined') {
            localStorage.setItem('gomoku_current_user', JSON.stringify(this.currentUser))
          }
          await sb.from('users')
            .update({ auth_user_id: session.user.id })
            .eq('id', this.currentUser.id)
        }
        const payload = {
          user_id: this.currentUser.id,
          auth_user_id: session?.user?.id ?? null,
          model_id: this.selectedModel.id,
          game_kind: this.selectedGameKind,
          status: 'playing',
          result: null,
          move_count: 0,
          started_at: this.gameStartTime,
        }

        const { data, error } = await sb
          .from('games')
          .insert(payload)
          .select('id')
          .single()

        if (error) throw error
        this.currentGameId = data?.id ?? null
      } catch (e) {
        console.warn('Supabase create game failed:', e)
        this.aiThinkingHistory.unshift({
          moveNumber: 0,
          moveLabel: 'DB',
          reasoning: `创建对局记录失败：${e instanceof Error ? e.message : String(e)}`,
          taunt: '',
          thinkingSteps: ['[Supabase] games insert failed; moves cannot be recorded until a game id exists.'],
          confidence: 'low',
        })
      }
    },

    async recordMove(move: Move, durationMs: number, aiLog?: {
      reasoning: string
      taunt: string
      confidence: 'high' | 'medium' | 'low'
      thinkingSteps: string[]
    }) {
      if (!this.currentGameId) {
        await this.createRemoteGame()
      }
      if (!this.currentGameId) return

      const moveNumber = this.moves.length
      try {
        const sb = useSupabase()
        const { error: insertError } = await sb.from('game_moves').insert({
          game_id: this.currentGameId,
          move_number: moveNumber,
          player: move.player,
          x: move.x,
          y: move.y,
          from_x: move.fromX ?? null,
          from_y: move.fromY ?? null,
          piece: move.piece ?? null,
          captured: move.captured ?? null,
          duration_ms: Math.max(0, Math.round(durationMs)),
          board_snapshot: this.selectedGameKind === 'xiangqi' ? this.xiangqiBoard : this.board,
          ai_reasoning: aiLog?.reasoning ?? null,
          ai_taunt: aiLog?.taunt ?? null,
          ai_confidence: aiLog?.confidence ?? null,
          thinking_steps: aiLog?.thinkingSteps ?? null,
        })
        if (insertError) throw insertError

        const { error: updateError } = await sb.from('games')
          .update({ move_count: moveNumber })
          .eq('id', this.currentGameId)
        if (updateError) throw updateError
      } catch (e) {
        console.warn('Supabase insert move failed:', e)
        this.aiThinkingHistory.unshift({
          moveNumber,
          moveLabel: 'DB',
          reasoning: `记录步骤失败：${e instanceof Error ? e.message : String(e)}`,
          taunt: '',
          thinkingSteps: ['[Supabase] game_moves insert/update failed.'],
          confidence: 'low',
        })
      }
    },

    async placeStone(x: number, y: number): Promise<boolean> {
      if (this.gameStatus !== 'playing') return false
      if (this.selectedGameKind === 'xiangqi') return false
      if (this.board[y][x] !== 0) return false
      if (this.currentPlayer !== 1) return false // Human must be player 1

      const now = Date.now()
      const durationMs = this.lastMoveAt ? now - this.lastMoveAt : 0
      this.board[y][x] = 1
      const move = { x, y, player: 1 as const }
      this.moves.push(move)
      await this.recordMove(move, durationMs)
      this.lastMoveAt = Date.now()

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

    async moveXiangqiPiece(fromX: number, fromY: number, toX: number, toY: number): Promise<boolean> {
      if (this.gameStatus !== 'playing') return false
      if (this.selectedGameKind !== 'xiangqi') return false
      if (this.currentPlayer !== 1 || this.aiMovePending) return false
      if (!this.isLegalXiangqiMove(this.xiangqiBoard, fromX, fromY, toX, toY, 1)) return false

      const now = Date.now()
      const durationMs = this.lastMoveAt ? now - this.lastMoveAt : 0
      const piece = this.xiangqiBoard[fromY][fromX]
      const captured = this.xiangqiBoard[toY][toX]

      this.xiangqiBoard[toY][toX] = piece
      this.xiangqiBoard[fromY][fromX] = null
      const move = { x: toX, y: toY, fromX, fromY, player: 1 as const, piece: piece ?? undefined, captured }
      this.moves.push(move)
      await this.recordMove(move, durationMs)
      this.lastMoveAt = Date.now()

      if (captured === 'bK') {
        this.gameStatus = 'won'
        this.winner = 1
        await this.endGame(true)
        return true
      }

      this.currentPlayer = 2
      this.aiMovePending = true
      return true
    },

    async aiMove() {
      if (this.gameStatus !== 'playing') return
      if (!this.aiMovePending) return

      if (this.selectedGameKind === 'xiangqi') {
        await this.aiXiangqiMove()
        return
      }

      const model = this.selectedModel
      let move: { x: number; y: number } | null = null
      const startedAt = Date.now()

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
        const aiMove = { x: move.x, y: move.y, player: 2 as const }
        this.moves.push(aiMove)
        this.aiMovePending = false
        await this.recordMove(aiMove, Date.now() - startedAt, this.aiThinking ?? undefined)
        this.lastMoveAt = Date.now()

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
        if (!this.currentGameId) {
          reject(new Error('Game record is not ready yet.'))
          return
        }
        this.getAuthHeader().then((authHeader) => {
          fetch('/api/ai-move-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({
              gameId: this.currentGameId,
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
        }).catch(reject)
      })
    },

    async aiXiangqiMove() {
      const startedAt = Date.now()
      const legalMoves = this.getAllXiangqiMoves(2)
      if (!legalMoves.length) {
        this.gameStatus = 'won'
        this.winner = 1
        this.aiMovePending = false
        await this.endGame(true)
        return
      }

      const model = this.selectedModel
      if (!model || model.provider === 'local') {
        this.aiMovePending = false
        this.currentPlayer = 1
        this.aiThinking = {
          moveNumber: this.moves.filter(m => m.player === 2).length + 1,
          moveLabel: '...',
          reasoning: '请选择一个真实 AI 模型来接管中国象棋。',
          taunt: '',
          thinkingSteps: ['[Xiangqi] Local algorithm disabled.'],
          confidence: 'low',
        }
        this.aiThinkingHistory.unshift(this.aiThinking)
        return
      }

      let chosen: { fromX: number; fromY: number; toX: number; toY: number } | null = null
      let aiLog: {
        moveNumber: number
        moveLabel: string
        reasoning: string
        taunt: string
        thinkingSteps: string[]
        confidence: 'high' | 'medium' | 'low'
      } | null = null

      try {
        const result = await this.aiXiangqiMoveStream(model, legalMoves)
        chosen = result.move
        aiLog = result.aiLog
      } catch (err) {
        console.warn('Xiangqi AI failed:', err)
        this.aiMovePending = false
        this.currentPlayer = 1
        this.aiThinking = {
          moveNumber: this.moves.filter(m => m.player === 2).length + 1,
          moveLabel: '...',
          reasoning: `中国象棋 AI 调用失败：${err instanceof Error ? err.message : String(err)}`,
          taunt: '',
          thinkingSteps: ['[Xiangqi] AI failed before choosing a legal move.'],
          confidence: 'low',
        }
        this.aiThinkingHistory.unshift(this.aiThinking)
        return
      }

      if (!chosen || !this.isLegalXiangqiMove(this.xiangqiBoard, chosen.fromX, chosen.fromY, chosen.toX, chosen.toY, 2)) {
        this.aiMovePending = false
        this.currentPlayer = 1
        return
      }

      const piece = this.xiangqiBoard[chosen.fromY][chosen.fromX]
      const captured = this.xiangqiBoard[chosen.toY][chosen.toX]

      this.xiangqiBoard[chosen.toY][chosen.toX] = piece
      this.xiangqiBoard[chosen.fromY][chosen.fromX] = null
      const move = {
        x: chosen.toX,
        y: chosen.toY,
        fromX: chosen.fromX,
        fromY: chosen.fromY,
        player: 2 as const,
        piece: piece ?? undefined,
        captured,
      }
      this.moves.push(move)
      this.aiMovePending = false

      aiLog ??= {
        moveNumber: this.moves.filter(m => m.player === 2).length,
        moveLabel: `${this.xiangqiPieceLabel(piece)} ${this.xiangqiCoord(chosen.fromX, chosen.fromY)}-${this.xiangqiCoord(chosen.toX, chosen.toY)}`,
        reasoning: 'AI selected this legal move.',
        taunt: '',
        thinkingSteps: [`[Xiangqi] AI selected a legal move from ${legalMoves.length} candidates.`],
        confidence: 'medium',
      }
      this.aiThinking = aiLog
      this.aiThinkingHistory.unshift(aiLog)
      await this.recordMove(move, Date.now() - startedAt, aiLog)
      this.lastMoveAt = Date.now()

      if (captured === 'rK') {
        this.gameStatus = 'lost'
        this.winner = 2
        await this.endGame(false)
        return
      }

      this.currentPlayer = 1
    },

    async aiXiangqiMoveStream(model: typeof this.selectedModel, legalMoves: Array<{ fromX: number; fromY: number; toX: number; toY: number }>): Promise<{
      move: { fromX: number; fromY: number; toX: number; toY: number }
      aiLog: {
        moveNumber: number
        moveLabel: string
        reasoning: string
        taunt: string
        thinkingSteps: string[]
        confidence: 'high' | 'medium' | 'low'
      }
    }> {
      if (!model) throw new Error('No AI model selected')

      const thinkingSteps: string[] = []
      const moveNumber = this.moves.filter(m => m.player === 2).length + 1

      return new Promise((resolve, reject) => {
        if (!this.currentGameId) {
          reject(new Error('Game record is not ready yet.'))
          return
        }
        this.getAuthHeader().then((authHeader) => {
          fetch('/api/xiangqi-move-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({
              gameId: this.currentGameId,
              board: this.xiangqiBoard,
              legalMoves,
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
                  thinkingSteps.push(event.text)
                } else if (event.type === 'done') {
                  const piece = this.xiangqiBoard[event.move.fromY]?.[event.move.fromX]
                  const moveLabel = `${this.xiangqiPieceLabel(piece)} ${this.xiangqiCoord(event.move.fromX, event.move.fromY)}-${this.xiangqiCoord(event.move.toX, event.move.toY)}`
                  resolve({
                    move: event.move,
                    aiLog: {
                      moveNumber,
                      moveLabel,
                      reasoning: event.reasoning,
                      taunt: event.taunt,
                      thinkingSteps: event.thinkingSteps?.length ? event.thinkingSteps : thinkingSteps,
                      confidence: event.confidence,
                    },
                  })
                } else if (event.type === 'error') {
                  reject(new Error(event.message))
                }
              } catch {}
            }
          }
          }).catch(reject)
        }).catch(reject)
      })
    },

    getAllXiangqiMoves(player: 1 | 2) {
      const prefix = player === 1 ? 'r' : 'b'
      const moves: Array<{ fromX: number; fromY: number; toX: number; toY: number; score: number }> = []

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
          const piece = this.xiangqiBoard[y][x]
          if (!piece?.startsWith(prefix)) continue

          for (let toY = 0; toY < 10; toY++) {
            for (let toX = 0; toX < 9; toX++) {
              if (!this.isLegalXiangqiMove(this.xiangqiBoard, x, y, toX, toY, player)) continue
              moves.push({ fromX: x, fromY: y, toX, toY, score: 0 })
            }
          }
        }
      }

      return moves
    },

    isLegalXiangqiMove(board: (XiangqiPiece | null)[][], fromX: number, fromY: number, toX: number, toY: number, player: 1 | 2): boolean {
      if (fromX === toX && fromY === toY) return false
      if (fromX < 0 || fromX > 8 || toX < 0 || toX > 8 || fromY < 0 || fromY > 9 || toY < 0 || toY > 9) return false

      const piece = board[fromY][fromX]
      if (!piece) return false
      const own = player === 1 ? 'r' : 'b'
      const enemy = player === 1 ? 'b' : 'r'
      if (!piece.startsWith(own)) return false
      const target = board[toY][toX]
      if (target?.startsWith(own)) return false

      const type = piece[1]
      const dx = toX - fromX
      const dy = toY - fromY
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)
      const between = this.countXiangqiBetween(board, fromX, fromY, toX, toY)
      let legal = false

      if (type === 'K') {
        const inPalace = toX >= 3 && toX <= 5 && (own === 'r' ? toY >= 7 && toY <= 9 : toY >= 0 && toY <= 2)
        legal = inPalace && adx + ady === 1
      } else if (type === 'A') {
        const inPalace = toX >= 3 && toX <= 5 && (own === 'r' ? toY >= 7 && toY <= 9 : toY >= 0 && toY <= 2)
        legal = inPalace && adx === 1 && ady === 1
      } else if (type === 'B') {
        const staysHome = own === 'r' ? toY >= 5 : toY <= 4
        const eyeX = fromX + dx / 2
        const eyeY = fromY + dy / 2
        legal = staysHome && adx === 2 && ady === 2 && !board[eyeY]?.[eyeX]
      } else if (type === 'N') {
        const legX = fromX + (adx === 2 ? Math.sign(dx) : 0)
        const legY = fromY + (ady === 2 ? Math.sign(dy) : 0)
        legal = ((adx === 1 && ady === 2) || (adx === 2 && ady === 1)) && !board[legY]?.[legX]
      } else if (type === 'R') {
        legal = (dx === 0 || dy === 0) && between === 0
      } else if (type === 'C') {
        legal = (dx === 0 || dy === 0) && (target ? between === 1 : between === 0)
      } else if (type === 'P') {
        const forward = own === 'r' ? -1 : 1
        const crossedRiver = own === 'r' ? fromY <= 4 : fromY >= 5
        legal = (dx === 0 && dy === forward) || (crossedRiver && adx === 1 && dy === 0)
      }

      if (!legal) return false

      const next = board.map(row => [...row])
      next[toY][toX] = piece
      next[fromY][fromX] = null
      return !this.kingsFace(next) && !this.isXiangqiKingInCheck(next, player)
    },

    isXiangqiKingInCheck(board: (XiangqiPiece | null)[][], player: 1 | 2): boolean {
      const own = player === 1 ? 'r' : 'b'
      const enemy = player === 1 ? 'b' : 'r'
      let kingX = -1
      let kingY = -1

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
          if (board[y][x] === `${own}K`) {
            kingX = x
            kingY = y
          }
        }
      }
      if (kingX === -1) return true

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
          const piece = board[y][x]
          if (piece?.startsWith(enemy) && this.canXiangqiPieceAttack(board, x, y, kingX, kingY)) {
            return true
          }
        }
      }

      return false
    },

    canXiangqiPieceAttack(board: (XiangqiPiece | null)[][], fromX: number, fromY: number, toX: number, toY: number): boolean {
      const piece = board[fromY]?.[fromX]
      if (!piece) return false

      const own = piece[0]
      const type = piece[1]
      const dx = toX - fromX
      const dy = toY - fromY
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)
      const between = this.countXiangqiBetween(board, fromX, fromY, toX, toY)

      if (type === 'K') {
        return (dx === 0 && between === 0) || adx + ady === 1
      }
      if (type === 'A') return adx === 1 && ady === 1
      if (type === 'B') {
        const eyeX = fromX + dx / 2
        const eyeY = fromY + dy / 2
        return adx === 2 && ady === 2 && !board[eyeY]?.[eyeX]
      }
      if (type === 'N') {
        const legX = fromX + (adx === 2 ? Math.sign(dx) : 0)
        const legY = fromY + (ady === 2 ? Math.sign(dy) : 0)
        return ((adx === 1 && ady === 2) || (adx === 2 && ady === 1)) && !board[legY]?.[legX]
      }
      if (type === 'R') return (dx === 0 || dy === 0) && between === 0
      if (type === 'C') return (dx === 0 || dy === 0) && between === 1
      if (type === 'P') {
        const forward = own === 'r' ? -1 : 1
        const crossedRiver = own === 'r' ? fromY <= 4 : fromY >= 5
        return (dx === 0 && dy === forward) || (crossedRiver && adx === 1 && dy === 0)
      }
      return false
    },

    countXiangqiBetween(board: (XiangqiPiece | null)[][], fromX: number, fromY: number, toX: number, toY: number): number {
      if (fromX !== toX && fromY !== toY) return -1
      const stepX = Math.sign(toX - fromX)
      const stepY = Math.sign(toY - fromY)
      let x = fromX + stepX
      let y = fromY + stepY
      let count = 0
      while (x !== toX || y !== toY) {
        if (board[y][x]) count++
        x += stepX
        y += stepY
      }
      return count
    },

    kingsFace(board: (XiangqiPiece | null)[][]): boolean {
      let redX = -1
      let redY = -1
      let blackX = -1
      let blackY = -1
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
          if (board[y][x] === 'rK') { redX = x; redY = y }
          if (board[y][x] === 'bK') { blackX = x; blackY = y }
        }
      }
      if (redX === -1 || blackX === -1 || redX !== blackX) return false
      return this.countXiangqiBetween(board, redX, redY, blackX, blackY) === 0
    },

    xiangqiPieceLabel(piece?: string | null): string {
      const labels: Record<string, string> = {
        rK: '帥', rA: '仕', rB: '相', rN: '傌', rR: '俥', rC: '炮', rP: '兵',
        bK: '將', bA: '士', bB: '象', bN: '馬', bR: '車', bC: '砲', bP: '卒',
      }
      return piece ? labels[piece] ?? piece : ''
    },

    xiangqiCoord(x: number, y: number): string {
      return `${String.fromCharCode(65 + x)}${y + 1}`
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

            if (this.wouldCompleteFive(x, y, 2)) {
              score += 5_000_000
            }
            if (this.wouldCompleteFive(x, y, 1)) {
              score += 4_500_000
            }

            let ownForcingLines = 0
            let oppForcingLines = 0

            for (const [dx, dy] of directions) {
              // Check own stones (offensive)
              const ownCount =
                this.countInDirection(x, y, dx, dy, 2) +
                this.countInDirection(x, y, -dx, -dy, 2)
              const ownOpen = this.countOpenEndsForMove(x, y, dx, dy, 2)
              score += this.getPatternScore(ownCount, ownOpen, 'offense', model.id)
              if (ownCount >= 3 && ownOpen >= 1) ownForcingLines++
              if (ownCount >= 2 && ownOpen >= 2) ownForcingLines++

              // Check opponent stones (defensive)
              const oppCount =
                this.countInDirection(x, y, dx, dy, 1) +
                this.countInDirection(x, y, -dx, -dy, 1)
              const oppOpen = this.countOpenEndsForMove(x, y, dx, dy, 1)
              score += this.getPatternScore(oppCount, oppOpen, 'defense', model.id) * 1.15
              if (oppCount >= 3 && oppOpen >= 1) oppForcingLines++
              if (oppCount >= 2 && oppOpen >= 2) oppForcingLines++
            }

            if (ownForcingLines >= 2) score += 180_000
            if (oppForcingLines >= 2) score += 160_000

            // Center preference
            const centerDist = Math.abs(x - 7) + Math.abs(y - 7)
            score += Math.max(0, (14 - centerDist) * 0.5)

            // Add some randomness based on difficulty
            const randomFactor = Math.max(0, 4 - model.difficulty) * 2
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

    wouldCompleteFive(x: number, y: number, player: number): boolean {
      if (this.board[y][x] !== 0) return false
      this.board[y][x] = player
      const win = !!this.checkWin(x, y, player)
      this.board[y][x] = 0
      return win
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

    countOpenEndsForMove(x: number, y: number, dx: number, dy: number, player: number): number {
      let openEnds = 0

      let fx = x + dx
      let fy = y + dy
      while (fx >= 0 && fx < 15 && fy >= 0 && fy < 15 && this.board[fy][fx] === player) {
        fx += dx
        fy += dy
      }
      if (fx >= 0 && fx < 15 && fy >= 0 && fy < 15 && this.board[fy][fx] === 0) {
        openEnds++
      }

      let bx = x - dx
      let by = y - dy
      while (bx >= 0 && bx < 15 && by >= 0 && by < 15 && this.board[by][bx] === player) {
        bx -= dx
        by -= dy
      }
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

      if (count >= 4) baseScore = 1_000_000 // Win or block win
      else if (count === 3) {
        baseScore = openEnds >= 2 ? 180_000 : 60_000
      }
      else if (count === 2) {
        baseScore = openEnds >= 2 ? (isDefensive ? 8000 : 12000) : (isAggressive ? 3000 : 1500)
      }
      else if (count === 1) {
        baseScore = openEnds >= 2 ? 300 : 40
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
        const browserFingerprint = this.currentUser.browserFingerprint || await getBrowserFingerprint()
        this.currentUser.browserFingerprint = browserFingerprint || undefined
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
            auth_user_id: this.currentUser.authUserId ?? null,
            browser_fingerprint: browserFingerprint || null,
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

      // Finish live game record
      if (this.currentGameId) {
        try {
          const sb = useSupabase()
          const endedAt = new Date()
          const startedAt = this.gameStartTime ? new Date(this.gameStartTime).getTime() : endedAt.getTime()
          await sb.from('games').update({
            status: 'finished',
            result,
            move_count: this.moves.length,
            ended_at: endedAt.toISOString(),
            duration_ms: Math.max(0, endedAt.getTime() - startedAt),
          }).eq('id', this.currentGameId)
        } catch (e) {
          console.warn('Supabase update game failed:', e)
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
      this.xiangqiBoard = createXiangqiBoard()
      this.currentPlayer = 1
      this.moves = []
      this.gameStatus = 'idle'
      this.winner = null
      this.winLine = []
      this.currentGameId = null
      this.lastMoveAt = null
      this.aiMovePending = false
      this.aiThinking = null
      this.aiThinkingHistory = []
      this.selectedModel = null
    }
  }
})
