import { describe, it, expect, beforeEach, vi } from 'vitest'
import { playSoundForMove } from '../services/sounds.ts'

interface FakeAudioCtx {
  oscillators: Array<{ type: OscillatorType; freq: number }>
}

function installFakeAudio(): FakeAudioCtx {
  const calls: FakeAudioCtx = { oscillators: [] }
  const fakeOsc = () => {
    const o: any = {
      type: 'sine',
      frequency: {
        setValueAtTime: (v: number) => { o.__freq = v },
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => ({ connect: () => {} }),
      start: () => {},
      stop: () => {},
    }
    return o
  }
  const fakeGain = () => ({
    gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    connect: () => ({ connect: () => {} }),
  })
  class FakeAudioContext {
    state = 'running'
    currentTime = 0
    resume() { return Promise.resolve() }
    createOscillator() {
      const o = fakeOsc()
      const setVal = o.frequency.setValueAtTime
      o.frequency.setValueAtTime = (v: number) => {
        calls.oscillators.push({ type: o.type, freq: v })
        return setVal(v)
      }
      return o
    }
    createGain() { return fakeGain() }
    destination = {}
  }
  ;(globalThis as any).window = (globalThis as any).window ?? {}
  ;(globalThis as any).window.AudioContext = FakeAudioContext
  return calls
}

describe('playSoundForMove', () => {
  beforeEach(() => {
    // Reset module-level audio context between tests
    vi.resetModules()
  })

  it('is silent when muted', async () => {
    const calls = installFakeAudio()
    const { playSoundForMove: fresh } = await import('../services/sounds.ts')
    fresh({ san: 'e4' }, true)
    expect(calls.oscillators).toHaveLength(0)
  })

  it('plays at least one oscillator on a quiet move', async () => {
    const calls = installFakeAudio()
    const { playSoundForMove: fresh } = await import('../services/sounds.ts')
    fresh({ san: 'e4' }, false)
    expect(calls.oscillators.length).toBeGreaterThan(0)
  })

  it('uses a brighter (higher) primary frequency for captures than quiet moves', async () => {
    const moveCalls = installFakeAudio()
    const { playSoundForMove: m } = await import('../services/sounds.ts')
    m({ san: 'Nxe5', captured: 'p' }, false)
    const captureMax = Math.max(...moveCalls.oscillators.map(o => o.freq))

    const quietCalls = installFakeAudio()
    vi.resetModules()
    const { playSoundForMove: q } = await import('../services/sounds.ts')
    q({ san: 'e4' }, false)
    const quietMax = Math.max(...quietCalls.oscillators.map(o => o.freq))

    expect(captureMax).toBeGreaterThan(quietMax)
  })

  it('plays the two-tone check sound on a check move', async () => {
    const calls = installFakeAudio()
    const { playSoundForMove: fresh } = await import('../services/sounds.ts')
    fresh({ san: 'Qh5+' }, false)
    // Check sound: 660 + 880
    expect(calls.oscillators.some(o => o.freq === 660)).toBe(true)
    expect(calls.oscillators.some(o => o.freq === 880)).toBe(true)
  })
})
