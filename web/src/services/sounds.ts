// WebAudio-synthesized chess sounds. No audio files shipped — each "instrument"
// is a single oscillator + gain envelope. Callers pass `muted` so the global
// sound toggle is the single source of truth.

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try { ctx = new Ctor() } catch { return null }
  }
  // Some browsers suspend the context until a user gesture.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

interface ToneSpec {
  type: OscillatorType
  freq: number
  duration: number
  peak: number
  // freqEnd > 0 sweeps from freq to freqEnd over duration (for capture clack).
  freqEnd?: number
}

function playTone(spec: ToneSpec, startOffsetSec = 0): void {
  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime + startOffsetSec
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = spec.type
  osc.frequency.setValueAtTime(spec.freq, t0)
  if (spec.freqEnd && spec.freqEnd !== spec.freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.freqEnd), t0 + spec.duration)
  }
  // Quick attack, exponential decay
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(spec.peak, t0 + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.duration)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + spec.duration + 0.02)
}

export function playMoveSound(): void {
  // Soft low thunk
  playTone({ type: 'sine', freq: 220, duration: 0.08, peak: 0.18 })
  playTone({ type: 'triangle', freq: 140, duration: 0.12, peak: 0.10 })
}

export function playCaptureSound(): void {
  // Brighter clack with a downward sweep
  playTone({ type: 'square', freq: 520, freqEnd: 280, duration: 0.10, peak: 0.16 })
  playTone({ type: 'sine', freq: 180, duration: 0.14, peak: 0.10 })
}

export function playCheckSound(): void {
  // Two-tone alert
  playTone({ type: 'sine', freq: 660, duration: 0.12, peak: 0.20 })
  playTone({ type: 'sine', freq: 880, duration: 0.16, peak: 0.20 }, 0.10)
}

export function playGameOverSound(): void {
  // Descending three-note flourish
  playTone({ type: 'triangle', freq: 523, duration: 0.18, peak: 0.18 })
  playTone({ type: 'triangle', freq: 392, duration: 0.18, peak: 0.18 }, 0.14)
  playTone({ type: 'triangle', freq: 261, duration: 0.30, peak: 0.20 }, 0.28)
}

// Pick the right sound for a move based on the resulting chess.js move object.
export function playSoundForMove(move: { captured?: string; san?: string }, mutedFlag: boolean): void {
  if (mutedFlag) return
  const san = move.san ?? ''
  if (san.endsWith('#')) {
    playCaptureSound()
    setTimeout(() => playGameOverSound(), 120)
    return
  }
  if (san.endsWith('+')) {
    playCheckSound()
    return
  }
  if (move.captured) {
    playCaptureSound()
    return
  }
  playMoveSound()
}
