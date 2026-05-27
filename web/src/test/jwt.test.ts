import { describe, it, expect } from 'vitest'

function base64url(data: Uint8Array): string {
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlEncode(str: string): string {
  return base64url(new TextEncoder().encode(str))
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function jwtSign(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64urlEncode(JSON.stringify(payload))
  const data = `${header}.${body}`
  const key = await getSigningKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${base64url(new Uint8Array(sig))}`
}

async function jwtVerify(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const key = await getSigningKey(secret)
  const sigBytes = Uint8Array.from(
    atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  )
  const valid = await crypto.subtle.verify(
    'HMAC', key, sigBytes,
    new TextEncoder().encode(`${header}.${body}`),
  )
  if (!valid) return null
  const padded = body.replace(/-/g, '+').replace(/_/g, '/')
  const decoded = atob(padded)
  const bytes = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i)
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

function getCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? match[1] : null
}

const SECRET = 'test-secret-key-for-chess'

describe('JWT sign and verify', () => {
  it('round-trips a valid token', async () => {
    const payload = { sub: 'user123', name: 'Test User', avatar: 'pic.png', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }
    const token = await jwtSign(payload, SECRET)
    const decoded = await jwtVerify(token, SECRET)
    expect(decoded).not.toBeNull()
    expect(decoded!.sub).toBe('user123')
    expect(decoded!.name).toBe('Test User')
    expect(decoded!.avatar).toBe('pic.png')
  })

  it('rejects a token signed with a different secret', async () => {
    const payload = { sub: 'user1', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }
    const token = await jwtSign(payload, 'secret-a')
    const decoded = await jwtVerify(token, 'secret-b')
    expect(decoded).toBeNull()
  })

  it('rejects an expired token', async () => {
    const payload = { sub: 'user1', iat: 1000, exp: 1001 }
    const token = await jwtSign(payload, SECRET)
    const decoded = await jwtVerify(token, SECRET)
    expect(decoded).toBeNull()
  })

  it('rejects a token with wrong number of parts', async () => {
    expect(await jwtVerify('abc.def', SECRET)).toBeNull()
    expect(await jwtVerify('abc', SECRET)).toBeNull()
    expect(await jwtVerify('', SECRET)).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const payload = { sub: 'user1', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }
    const token = await jwtSign(payload, SECRET)
    const parts = token.split('.')
    const tamperedPayload = base64urlEncode(JSON.stringify({ ...payload, sub: 'hacker' }))
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`
    const decoded = await jwtVerify(tampered, SECRET)
    expect(decoded).toBeNull()
  })

  it('handles tokens with unicode in payload', async () => {
    const payload = { sub: 'u1', name: 'Ünïcödé Üser 日本語', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }
    const token = await jwtSign(payload, SECRET)
    const decoded = await jwtVerify(token, SECRET)
    expect(decoded!.name).toBe('Ünïcödé Üser 日本語')
  })

  it('handles null avatar gracefully', async () => {
    const payload = { sub: 'u1', name: 'No Pic', avatar: null, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }
    const token = await jwtSign(payload, SECRET)
    const decoded = await jwtVerify(token, SECRET)
    expect(decoded!.avatar).toBeNull()
  })
})

describe('getCookie', () => {
  it('extracts a named cookie from a header', () => {
    expect(getCookie('pgs_token=abc123; other=xyz', 'pgs_token')).toBe('abc123')
  })

  it('extracts cookie at start of header', () => {
    expect(getCookie('pgs_token=abc123', 'pgs_token')).toBe('abc123')
  })

  it('returns null when cookie is not present', () => {
    expect(getCookie('other=xyz; another=123', 'pgs_token')).toBeNull()
  })

  it('returns null for empty header', () => {
    expect(getCookie('', 'pgs_token')).toBeNull()
  })

  it('handles cookie with equals in value', () => {
    expect(getCookie('pgs_token=abc=123; other=x', 'pgs_token')).toBe('abc=123')
  })

  it('does not match partial cookie names', () => {
    expect(getCookie('not_pgs_token=abc', 'pgs_token')).toBeNull()
  })

  it('extracts cookie in the middle of the header', () => {
    expect(getCookie('a=1; pgs_token=thevalue; b=2', 'pgs_token')).toBe('thevalue')
  })
})
