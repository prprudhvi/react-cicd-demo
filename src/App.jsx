import { useEffect, useState } from 'react'
import {
  fetchDashboard,
  fetchPublicIp,
  GRAPHQL_URL_STORAGE_KEY,
  resolveGraphqlUrl,
} from './dashboardApi.js'
import './App.css'

function statusLabel(status) {
  if (status === 'ready') {
    return 'Service responded'
  }
  if (status === 'error') {
    return 'Service unreachable'
  }
  return 'Checking service'
}

function formatWhen(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function App() {
  const webOrigin = window.location.origin
  const webProtocol = window.location.protocol.replace(':', '')
  const [webIp, setWebIp] = useState('')
  const [webIpError, setWebIpError] = useState('')
  const [endpoint, setEndpoint] = useState(resolveGraphqlUrl)
  const [draft, setDraft] = useState(endpoint)
  const [requestId, setRequestId] = useState(0)
  const [status, setStatus] = useState('loading')
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState('')
  const [loadedAt, setLoadedAt] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    fetchPublicIp(controller.signal)
      .then((ip) => {
        if (active) {
          setWebIp(ip)
          setWebIpError('')
        }
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) {
          return
        }
        setWebIpError(err instanceof Error ? err.message : 'Could not look up the web app public IP')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function run() {
      setStatus('loading')
      setError('')
      try {
        const next = await fetchDashboard(endpoint, controller.signal)
        if (!active) {
          return
        }
        setPayload(next)
        setStatus('ready')
        setLoadedAt(new Date())
      } catch (err) {
        if (!active || controller.signal.aborted) {
          return
        }
        setPayload(null)
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Could not reach the service')
      }
    }

    run()
    return () => {
      active = false
      controller.abort()
    }
  }, [endpoint, requestId])

  function onConnect(event) {
    event.preventDefault()
    const next = draft.trim()
    if (!next) {
      setPayload(null)
      setStatus('error')
      setError('Enter the GraphQL endpoint.')
      return
    }
    window.localStorage.setItem(GRAPHQL_URL_STORAGE_KEY, next)
    setEndpoint(next)
    setRequestId((value) => value + 1)
  }

  function refresh() {
    setRequestId((value) => value + 1)
  }

  const calls = payload?.calls ?? []

  return (
    <main className="dashboard">
      <header className="intro">
        <p className="kicker">react-cicd-demo</p>
        <h1>Runtime</h1>
        <p className="lede">
          Public addresses for this web app and the NestJS service, plus the temporary users
          returned by GraphQL.
        </p>
      </header>

      <section className="ip-grid" aria-label="Addresses">
        <article className="panel">
          <h2>Web app</h2>
          <p className="eyebrow">Public IP</p>
          <p className="ip" data-testid="web-app-host">
            {webIp || (webIpError ? 'Unavailable' : 'Looking up…')}
          </p>
          <dl className="meta">
            <div>
              <dt>Origin</dt>
              <dd>{webOrigin}</dd>
            </div>
            <div>
              <dt>Protocol</dt>
              <dd>{webProtocol}</dd>
            </div>
          </dl>
          {webIpError ? <p className="pending">{webIpError}</p> : null}
        </article>

        <article className="panel panel-service" aria-busy={status === 'loading'}>
          <div className="panel-head">
            <h2>NestJS service</h2>
            <p className={`status status-${status}`}>
              <span className="dot" aria-hidden="true" />
              {statusLabel(status)}
            </p>
          </div>
          {payload?.service?.ip ? (
            <>
              <p className="eyebrow">Public IP</p>
              <p className="ip" data-testid="service-ip">
                {payload.service.ip}
              </p>
              <dl className="meta">
                <div>
                  <dt>Name</dt>
                  <dd>{payload.service.name}</dd>
                </div>
                <div>
                  <dt>Hostname</dt>
                  <dd>{payload.service.hostname}</dd>
                </div>
                <div>
                  <dt>Port</dt>
                  <dd>{payload.service.port}</dd>
                </div>
                <div>
                  <dt>Addresses</dt>
                  <dd>{(payload.service.addresses ?? [payload.service.ip]).join(', ')}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="pending">
              {payload?.warning
                ? payload.warning
                : status === 'error'
                  ? 'The service did not answer. Check the endpoint and try again.'
                  : 'Checking the service…'}
            </p>
          )}
        </article>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>Temporary users</h2>
          {loadedAt ? <p className="freshness">Updated {loadedAt.toLocaleTimeString()}</p> : null}
        </div>
        {payload?.users?.length ? (
          <ul className="users">
            {payload.users.map((user) => (
              <li key={user.id} className="user-card">
                <h3>{user.name}</h3>
                <p className="role">{user.role}</p>
                <p>{user.email}</p>
                <p className="city">{user.city}</p>
                {user.temporary ? <p className="temp">Temporary</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pending">User details appear after the service answers.</p>
        )}
      </section>

      <form className="endpoint" onSubmit={onConnect}>
        <label htmlFor="graphql-endpoint">GraphQL endpoint</label>
        <div className="endpoint-row">
          <input
            id="graphql-endpoint"
            name="endpoint"
            type="url"
            inputMode="url"
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit">Load service</button>
          <button type="button" onClick={refresh}>
            Refresh
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : null}
      {payload?.warning ? (
        <p role="alert" className="alert">
          {payload.warning}
        </p>
      ) : null}

      <section className="block">
        <h2>Call log</h2>
        <p className="hint">Each request the service accepts is logged, including this page load.</p>
        {calls.length > 0 ? (
          <ul className="call-log">
            {calls.slice(0, 5).map((call) => (
              <li key={call.id}>
                <span>{call.method}</span>
                <span>{call.path}</span>
                <span>{call.operation || 'request'}</span>
                <span>{call.ip}</span>
                <time dateTime={call.receivedAt}>{formatWhen(call.receivedAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pending">No calls logged yet.</p>
        )}
      </section>
    </main>
  )
}

export default App
