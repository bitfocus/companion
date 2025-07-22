import * as Sentry from '@sentry/react'

// Enable sentry if the DSN is set
if (import.meta.env.VITE_SENTRY_DSN) {
	Sentry.init({
		dsn: import.meta.env.VITE_SENTRY_DSN,
	})
}
