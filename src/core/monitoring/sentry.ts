export function initSentry() {
    if (import.meta.env.VITE_APP_ENV === 'production') {
        console.log('Sentry initialized (mock)')
        // Sentry.init({
        //   dsn: import.meta.env.VITE_SENTRY_DSN,
        //   integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
        //   tracesSampleRate: 1.0,
        //   replaysSessionSampleRate: 0.1,
        //   replaysOnErrorSampleRate: 1.0,
        // });
    }
}

export function logError(error: Error, context?: Record<string, any>) {
    if (import.meta.env.VITE_APP_ENV === 'production') {
        // Sentry.captureException(error, { extra: context });
        console.error('[Sentry]', error, context)
    } else {
        console.error(error)
    }
}
