import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { GRAPHQL_URL_STORAGE_KEY } from './dashboardApi.js'

function dashboard(ip = '203.0.113.10') {
  return {
    data: {
      service: {
        name: 'react-cicd-bg',
        ip,
        addresses: [ip, '192.168.1.44'],
        hostname: 'api-box',
        port: 4001,
      },
      users: [
        {
          id: '1',
          name: 'Asha Rao',
          email: 'asha@example.com',
          role: 'Admin',
          city: 'Hyderabad',
          temporary: true,
        },
        {
          id: '2',
          name: 'Ravi Kumar',
          email: 'ravi@example.com',
          role: 'Developer',
          city: 'Bengaluru',
          temporary: true,
        },
      ],
      calls: [
        {
          id: '1',
          method: 'POST',
          path: '/graphql',
          ip: '127.0.0.1',
          operation: 'Dashboard',
          receivedAt: '2026-11-22T07:00:00.000Z',
        },
      ],
    },
  }
}

function installFetch(graphql) {
  const fetchMock = vi.fn(async (url, init) => {
    if (String(url).includes('ipify')) {
      return { ok: true, json: async () => ({ ip: '175.101.13.163' }) }
    }
    return graphql(url, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows both public IPs, the users, and the call log', async () => {
    installFetch(async () => ({
      ok: true,
      json: async () => dashboard(),
    }))

    render(<App />)

    expect(await screen.findByTestId('web-app-host')).toHaveTextContent('175.101.13.163')
    expect(await screen.findByTestId('service-ip')).toHaveTextContent('203.0.113.10')
    expect(screen.getByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ravi Kumar' })).toBeInTheDocument()
    expect(screen.getByText('asha@example.com')).toBeInTheDocument()
    expect(screen.getByText('Service responded')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('keeps the web app public IP visible when GraphQL cannot be reached', async () => {
    installFetch(async () => {
      throw new Error('network down')
    })

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('network down')
    expect(await screen.findByTestId('web-app-host')).toHaveTextContent('175.101.13.163')
    expect(screen.getByText('User details appear after the service answers.')).toBeInTheDocument()
  })

  it('keeps user details when GraphQL returns users without a service IP', async () => {
    installFetch(async () => ({
      ok: true,
      json: async () => ({
        errors: [{ message: 'service failed' }],
        data: {
          service: null,
          users: [
            {
              id: '1',
              name: 'Asha Rao',
              email: 'asha@example.com',
              role: 'Admin',
              city: 'Hyderabad',
              temporary: true,
            },
          ],
          calls: [],
        },
      }),
    }))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('service failed')
  })

  it('loads a service endpoint chosen in the form', async () => {
    const fetchMock = installFetch(async () => ({
      ok: true,
      json: async () => dashboard(),
    }))
    const user = userEvent.setup()

    render(<App />)
    await screen.findByTestId('service-ip')

    const input = screen.getByLabelText('GraphQL endpoint')
    await user.clear(input)
    await user.type(input, 'http://10.1.1.1:4001/graphql')
    await user.click(screen.getByRole('button', { name: 'Load service' }))

    expect(fetchMock).toHaveBeenCalledWith(
      'http://10.1.1.1:4001/graphql',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(window.localStorage.getItem(GRAPHQL_URL_STORAGE_KEY)).toBe(
      'http://10.1.1.1:4001/graphql',
    )
  })

  it('asks for an endpoint when the field is empty', async () => {
    installFetch(async () => ({
      ok: true,
      json: async () => dashboard(),
    }))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('service-ip')

    await user.clear(screen.getByLabelText('GraphQL endpoint'))
    await user.click(screen.getByRole('button', { name: 'Load service' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter the GraphQL endpoint.')
  })

  it('refreshes the service public IP', async () => {
    const seen = { ip: '203.0.113.10' }
    installFetch(async () => ({
      ok: true,
      json: async () => dashboard(seen.ip),
    }))
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByTestId('service-ip')).toHaveTextContent('203.0.113.10')
    seen.ip = '203.0.113.20'
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByTestId('service-ip')).toHaveTextContent('203.0.113.20')
  })
})
