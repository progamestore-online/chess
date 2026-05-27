import { describe, it, expect } from 'vitest'

interface ReconnectState {
  didOpen: boolean
  backoff: number
  shouldRetry: boolean
}

function simulateClose(didOpen: boolean, currentBackoff: number): ReconnectState {
  if (!didOpen) {
    return { didOpen, backoff: currentBackoff, shouldRetry: false }
  }
  return {
    didOpen,
    backoff: Math.min(currentBackoff * 2, 30_000),
    shouldRetry: true,
  }
}

function simulateOpen(currentBackoff: number): ReconnectState {
  return { didOpen: true, backoff: 1000, shouldRetry: true }
}

describe('lobby WebSocket reconnect logic', () => {
  it('does not retry if connection was rejected (didOpen=false)', () => {
    const result = simulateClose(false, 1000)
    expect(result.shouldRetry).toBe(false)
  })

  it('retries if connection was previously open', () => {
    const result = simulateClose(true, 1000)
    expect(result.shouldRetry).toBe(true)
  })

  it('doubles backoff on each retry', () => {
    let backoff = 1000
    for (const expected of [2000, 4000, 8000, 16000, 30000, 30000]) {
      const result = simulateClose(true, backoff)
      backoff = result.backoff
      expect(backoff).toBe(expected)
    }
  })

  it('caps backoff at 30 seconds', () => {
    const result = simulateClose(true, 20_000)
    expect(result.backoff).toBe(30_000)
  })

  it('resets backoff on successful open', () => {
    const result = simulateOpen(16_000)
    expect(result.backoff).toBe(1000)
  })

  it('401 scenario: connect → immediate close without open → no retry', () => {
    // Simulates WebSocket upgrade rejected by server
    const result = simulateClose(false, 1000)
    expect(result.shouldRetry).toBe(false)
    expect(result.backoff).toBe(1000)
  })

  it('network drop scenario: connect → open → close → retry with backoff', () => {
    const open = simulateOpen(1000)
    expect(open.backoff).toBe(1000)
    const close = simulateClose(true, open.backoff)
    expect(close.shouldRetry).toBe(true)
    expect(close.backoff).toBe(2000)
  })
})
