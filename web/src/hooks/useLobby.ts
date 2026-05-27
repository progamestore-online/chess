import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@progamestore/games'
import type { OnlineUser, MatchRecord, Challenge } from '../types.ts'

interface LobbyServerMsg {
  type: string
  users?: OnlineUser[]
  user?: OnlineUser
  userId?: string
  challengeId?: string
  from?: OnlineUser
  to?: OnlineUser
  roomId?: string
  opponent?: OnlineUser
  by?: string
  matches?: MatchRecord[]
  message?: string
}

export interface UseLobbyResult {
  connected: boolean
  onlineUsers: OnlineUser[]
  history: MatchRecord[]
  incomingChallenges: Challenge[]
  challenge: (targetUserId: string) => void
  acceptChallenge: (id: string) => void
  declineChallenge: (id: string) => void
  reportResult: (result: {
    roomId: string
    white: { id: string; name: string; avatar: string }
    black: { id: string; name: string; avatar: string }
    winner: 'w' | 'b' | null
    reason: string
    moveCount: number
  }) => void
  onChallengeAccepted: (cb: (roomId: string) => void) => () => void
}

export function useLobby(): UseLobbyResult {
  const { user } = useAuth()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoff = useRef(1000)
  const challengeAcceptedCbs = useRef<Set<(roomId: string) => void>>(new Set())

  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [history, setHistory] = useState<MatchRecord[]>([])
  const [incomingChallenges, setIncomingChallenges] = useState<Challenge[]>([])

  const send = useCallback((msg: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const handleMessage = useCallback((msg: LobbyServerMsg) => {
    switch (msg.type) {
      case 'presence':
        setOnlineUsers(msg.users ?? [])
        break
      case 'user_joined':
        if (msg.user) setOnlineUsers(prev => [...prev.filter(u => u.id !== msg.user!.id), msg.user!])
        break
      case 'user_left':
        if (msg.userId) setOnlineUsers(prev => prev.filter(u => u.id !== msg.userId))
        break
      case 'challenge_incoming':
        if (msg.challengeId && msg.from) {
          setIncomingChallenges(prev => [
            ...prev,
            { id: msg.challengeId!, from: msg.from!, createdAt: Date.now() },
          ])
        }
        break
      case 'challenge_accepted':
        if (msg.roomId) {
          setIncomingChallenges(prev => prev.filter(c => c.id !== msg.challengeId))
          for (const cb of challengeAcceptedCbs.current) cb(msg.roomId)
        }
        break
      case 'challenge_declined':
        setIncomingChallenges(prev => prev.filter(c => c.id !== msg.challengeId))
        break
      case 'history':
        setHistory(msg.matches ?? [])
        break
      case 'ping':
        send({ type: 'pong' })
        break
    }
  }, [send])

  const connect = useCallback(() => {
    if (!user) return
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/lobby/ws`)
    let didOpen = false

    ws.onopen = () => {
      didOpen = true
      setConnected(true)
      backoff.current = 1000
      try { ws.send(JSON.stringify({ type: 'get_history', limit: 20 })) } catch {}
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as LobbyServerMsg
        handleMessage(msg)
      } catch {}
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      if (!didOpen) {
        // Server rejected the upgrade (401, network error) — don't retry
        return
      }
      reconnectTimer.current = setTimeout(() => {
        backoff.current = Math.min(backoff.current * 2, 30_000)
        connect()
      }, backoff.current)
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [user, handleMessage, send])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) wsRef.current.close(1000)
    }
  }, [connect])

  const challenge = useCallback((targetUserId: string) => {
    send({ type: 'challenge', targetUserId })
  }, [send])

  const acceptChallenge = useCallback((id: string) => {
    send({ type: 'challenge_accept', challengeId: id })
    setIncomingChallenges(prev => prev.filter(c => c.id !== id))
  }, [send])

  const declineChallenge = useCallback((id: string) => {
    send({ type: 'challenge_decline', challengeId: id })
    setIncomingChallenges(prev => prev.filter(c => c.id !== id))
  }, [send])

  const reportResult = useCallback((result: {
    roomId: string
    white: { id: string; name: string; avatar: string }
    black: { id: string; name: string; avatar: string }
    winner: 'w' | 'b' | null
    reason: string
    moveCount: number
  }) => {
    send({ type: 'report_result', ...result })
  }, [send])

  const onChallengeAccepted = useCallback((cb: (roomId: string) => void) => {
    challengeAcceptedCbs.current.add(cb)
    return () => { challengeAcceptedCbs.current.delete(cb) }
  }, [])

  return {
    connected,
    onlineUsers,
    history,
    incomingChallenges,
    challenge,
    acceptChallenge,
    declineChallenge,
    reportResult,
    onChallengeAccepted,
  }
}
