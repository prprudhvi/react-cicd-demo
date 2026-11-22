export const DEFAULT_GRAPHQL_URL = 'http://localhost:4001/graphql'
export const GRAPHQL_URL_STORAGE_KEY = 'react-cicd-bg.graphqlUrl'

export const DASHBOARD_QUERY = `query Dashboard {
  service { name ip addresses hostname port }
  users { id name email role city temporary }
  calls { id method path ip operation receivedAt }
}`

export function resolveGraphqlUrl() {
  const stored = window.localStorage.getItem(GRAPHQL_URL_STORAGE_KEY)?.trim()
  if (stored) {
    return stored
  }
  const fromEnv = import.meta.env.VITE_GRAPHQL_URL?.trim()
  if (fromEnv) {
    return fromEnv
  }
  return DEFAULT_GRAPHQL_URL
}

export function isPublicIpv4(value) {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return false
  }
  const parts = value.split('.').map((part) => Number(part))
  if (parts.some((part) => part > 255)) {
    return false
  }
  const [first, second] = parts
  if (first === 0 || first === 10 || first === 127) {
    return false
  }
  if (first === 192 && second === 168) {
    return false
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return false
  }
  if (first === 169 && second === 254) {
    return false
  }
  return true
}

export function readDashboard(payload) {
  const service = payload?.data?.service?.ip ? payload.data.service : null
  const users = Array.isArray(payload?.data?.users) ? payload.data.users : null
  const calls = Array.isArray(payload?.data?.calls) ? payload.data.calls : []
  const message = payload?.errors?.[0]?.message
  if (service || (users && users.length > 0)) {
    return {
      service,
      users: users ?? [],
      calls,
      warning: service ? '' : message || 'The service did not return a public IP.',
    }
  }
  if (message) {
    throw new Error(message)
  }
  throw new Error('Service response did not include an IP or users.')
}

export async function fetchDashboard(url, signal) {
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operationName: 'Dashboard',
        query: DASHBOARD_QUERY,
      }),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Could not reach the service'
    throw new Error(message)
  }

  if (!response.ok) {
    throw new Error(`Service responded with HTTP ${response.status}`)
  }

  return readDashboard(await response.json())
}

export async function fetchPublicIp(signal) {
  const host = window.location.hostname
  if (isPublicIpv4(host)) {
    return host
  }
  const response = await fetch('https://api.ipify.org?format=json', {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw new Error(`Public IP lookup responded with HTTP ${response.status}`)
  }
  const body = await response.json()
  if (!isPublicIpv4(body?.ip)) {
    throw new Error('Public IP lookup did not return an address.')
  }
  return body.ip
}
