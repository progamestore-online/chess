type PendingCommand = {
  resolve: (lines: string[]) => void
  lines: string[]
  readyToken: string
}

type QueueEntry = {
  commands: string[]  // UCI commands to send
  readyToken: string  // token to look for in output
  resolve: (lines: string[]) => void
}

class StockfishService {
  private worker: Worker | null = null
  private pending: PendingCommand | null = null
  private queue: QueueEntry[] = []
  private _ready = false
  private _loading = false
  private _failed = false

  get ready() { return this._ready }
  get failed() { return this._failed }

  async init(): Promise<boolean> {
    if (this._ready) return true
    if (this._failed) return false
    if (this._loading) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this._ready || this._failed) {
            clearInterval(check)
            resolve(this._ready)
          }
        }, 100)
      })
    }

    this._loading = true

    return new Promise((resolve) => {
      try {
        this.worker = new Worker('/stockfish/stockfish.js')

        const timeout = setTimeout(() => {
          this._failed = true
          this._loading = false
          this.worker?.terminate()
          this.worker = null
          resolve(false)
        }, 10000)

        this.worker.onmessage = (e) => {
          const line = e.data as string

          if (!this._ready && line.includes('uciok')) {
            clearTimeout(timeout)
            this._ready = true
            this._loading = false
            this.send('isready')
            resolve(true)
            return
          }

          if (this.pending) {
            this.pending.lines.push(line)
            if (line.includes(this.pending.readyToken)) {
              const p = this.pending
              this.pending = null
              p.resolve(p.lines)
              this.processQueue()
            }
          }
        }

        this.worker.onerror = () => {
          clearTimeout(timeout)
          this._failed = true
          this._loading = false
          this.worker = null
          resolve(false)
        }

        this.worker.postMessage('uci')
      } catch {
        this._failed = true
        this._loading = false
        resolve(false)
      }
    })
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd)
  }

  private processQueue() {
    if (this.pending || this.queue.length === 0) return
    const entry = this.queue.shift()!
    this.pending = { resolve: entry.resolve, lines: [], readyToken: entry.readyToken }
    for (const cmd of entry.commands) {
      this.send(cmd)
    }
  }

  // Queue a batch of UCI commands and wait for a response containing readyToken
  private enqueue(commands: string[], readyToken: string): Promise<string[]> {
    return new Promise((resolve) => {
      this.queue.push({ commands, readyToken, resolve })
      this.processQueue()
    })
  }

  async setSkillLevel(level: number) {
    if (!this.worker) return
    this.send(`setoption name Skill Level value ${level}`)
  }

  async findBestMove(fen: string, depth: number): Promise<string | null> {
    if (!this.worker || !this._ready) return null

    const lines = await this.enqueue(
      ['ucinewgame', `position fen ${fen}`, `go depth ${depth}`],
      'bestmove'
    )
    const bestLine = lines.find(l => l.startsWith('bestmove'))
    if (!bestLine) return null

    const match = bestLine.match(/bestmove\s+(\S+)/)
    return match ? match[1] : null
  }

  async evaluate(fen: string, depth: number): Promise<{ score: number; bestMove: string | null; pv: string }> {
    if (!this.worker || !this._ready) return { score: 0, bestMove: null, pv: '' }

    const lines = await this.enqueue(
      [`position fen ${fen}`, `go depth ${depth}`],
      'bestmove'
    )

    let score = 0
    let pv = ''
    for (const line of lines) {
      if (line.startsWith('info') && line.includes(' score ')) {
        const mateMatch = line.match(/score mate (-?\d+)/)
        if (mateMatch) {
          const mateIn = parseInt(mateMatch[1])
          score = mateIn > 0 ? 99999 - mateIn : -99999 + Math.abs(mateIn)
        } else {
          const cpMatch = line.match(/score cp (-?\d+)/)
          if (cpMatch) score = parseInt(cpMatch[1])
        }
        const pvMatch = line.match(/ pv (.+)/)
        if (pvMatch) pv = pvMatch[1]
      }
    }

    const bestLine = lines.find(l => l.startsWith('bestmove'))
    const bestMatch = bestLine?.match(/bestmove\s+(\S+)/)
    const bestMove = bestMatch ? bestMatch[1] : null

    return { score, bestMove, pv }
  }

  destroy() {
    this.worker?.terminate()
    this.worker = null
    this._ready = false
    this._loading = false
  }
}

export const stockfish = new StockfishService()
