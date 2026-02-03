export type HealthStatus = {
  app: 'ok'
  env: 'valid' | 'invalid'
}

type HealthViewProps = {
  status: HealthStatus
}

export function HealthView({ status }: HealthViewProps) {
  const envColor =
    status.env === 'valid'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
      : 'bg-rose-500/10 text-rose-300 border-rose-500/40'

  const envLabel = status.env === 'valid' ? 'Environment OK' : 'Environment Invalid'

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/60">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              RetroChat
            </p>
            <h1 className="mt-1 text-lg font-semibold text-slate-50">
              Health Check: <span className="text-emerald-400">PWA Boot</span>
            </h1>
          </div>
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-500/10 px-3 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        </header>

        <section className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-slate-900/80 px-3 py-2 ring-1 ring-slate-800">
            <span className="text-slate-300">App runtime</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Boot OK
            </span>
          </div>

          <div className={`flex items-center justify-between rounded-lg px-3 py-2 ring-1 ${envColor}`}>
            <span className="text-slate-200">Config</span>
            <span className="text-xs font-medium">{envLabel}</span>
          </div>
        </section>

        <footer className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">
          <p>
            This page is safe to expose for uptime checks; it performs no network or wallet
            calls and leaks no secrets.
          </p>
        </footer>
      </div>
    </main>
  )
}

