import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GRAPHQL_URL,
  fetchDashboard,
  fetchPublicIp,
  GRAPHQL_URL_STORAGE_KEY,
  isPublicIpv4,
  readDashboard,
  resolveGraphqlUrl,
} from './dashboardApi.js'

afterEach(() => {
  window.localStorage.clear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('readDashboard', () => {
  it('returns the service IP, users, and calls', () => {
    const result = readDashboard({
      data: {
        service: { ip: '10.0.0.1', name: 'react-cicd-bg' },
        users: [{ id: '1', name: 'Asha Rao' }],
        calls: [{ id: '9', method: 'POST' }],
      },
    })

    expect(result.service.ip).toBe('10.0.0.1')
    expect(result.users).toHaveLength(1)
    expect(result.calls[0].method).toBe('POST')
  })

  it('uses an empty call list when calls are absent', () => {
    const result = readDashboard({
      data: {
        service: { ip: '10.0.0.1' },
        users: [],
      },
    })
    expect(result.calls).toEqual([])
  })

  it('keeps the users when GraphQL reports an error for another field', () => {
    const result = readDashboard({
      errors: [{ message: 'service failed' }],
      data: {
        service: null,
        users: [{ id: '1', name: 'Asha Rao' }],
      },
    })
    expect(result.users[0].name).toBe('Asha Rao')
    expect(result.service).toBeNull()
    expect(result.warning).toBe('service failed')
  })

  it('throws the GraphQL error message when nothing usable came back', () => {
    expect(() => readDashboard({ errors: [{ message: 'Cannot query field' }] })).toThrow(
      'Cannot query field',
    )
  })

  it('throws when the IP and users are both missing', () => {
    expect(() => readDashboard({ data: { service: {}, users: [] } })).toThrow(/IP or users/)
    expect(() => readDashboard({ data: {} })).toThrow(/IP or users/)
  })
})

describe('isPublicIpv4', () => {
  it('accepts a public address and rejects private ones', () => {
    expect(isPublicIpv4('175.101.13.163')).toBe(true)
    expect(isPublicIpv4('192.168.1.44')).toBe(false)
    expect(isPublicIpv4('localhost')).toBe(false)
  })
})

describe('fetchPublicIp', () => {
  it('reads the public address from the lookup service', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ip: '175.101.13.163' }),
      }),
    )
    await expect(fetchPublicIp()).resolves.toBe('175.101.13.163')
  })
})

describe('resolveGraphqlUrl', () => {
  it('falls back to the local service', () => {
    vi.stubEnv('VITE_GRAPHQL_URL', '')
    expect(resolveGraphqlUrl()).toBe(DEFAULT_GRAPHQL_URL)
  })

  it('prefers a stored endpoint over the build-time URL', () => {
    vi.stubEnv('VITE_GRAPHQL_URL', 'http://18.60.99.194:4001/graphql')
    expect(resolveGraphqlUrl()).toBe('http://18.60.99.194:4001/graphql')
    window.localStorage.setItem(GRAPHQL_URL_STORAGE_KEY, ' http://10.2.2.2:4001/graphql ')
    expect(resolveGraphqlUrl()).toBe('http://10.2.2.2:4001/graphql')
  })
})

describe('fetchDashboard', () => {
  it('posts the Dashboard query and reads the payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { service: { ip: '10.4.4.4' }, users: [], calls: [] },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchDashboard('http://localhost:4001/graphql')

    expect(result.service.ip).toBe('10.4.4.4')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4001/graphql',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Dashboard'),
      }),
    )
  })

  it('throws when the service responds with an HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
    )

    await expect(fetchDashboard('http://localhost:4001/graphql')).rejects.toThrow('HTTP 503')
  })

  it('wraps a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(fetchDashboard('http://localhost:4001/graphql')).rejects.toThrow('offline')
  })
})
