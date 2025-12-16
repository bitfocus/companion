import * as Sentry from '@sentry/react'

// Initialise Sentry only when a DSN is provided.
if (import.meta.env.VITE_SENTRY_DSN) {
	Sentry.init({
		dsn: import.meta.env.VITE_SENTRY_DSN,
		// Conservative, stack-aware filtering to drop Monaco/editor errors
		// while avoiding any message-only ignores.
		beforeSend(event, _hint) {
			try {
				const frames = (event?.exception?.values?.[0]?.stacktrace?.frames as any[]) || []

				// If we have a stacktrace, prefer that to decide origin.
				if (frames.length > 0) {
					let monaco = 0
					let app = 0
					const host = typeof window !== 'undefined' ? window.location?.hostname : ''
					for (const f of frames) {
						const name = String(f.filename || f.abs_path || f.module || '')
						if (/monaco|monaco-editor|vs\/editor|loader\.js|_deps\/monaco/i.test(name)) monaco++
						if (host && name.includes(host)) app++
						if (/\/src\/|\/assets\/|webui|app\.|bundle/i.test(name)) app++
						if (monaco > 0 && app > 0) break
					}
					if (monaco > 0 && app === 0) return null
				}
				// If there's no stacktrace we conservatively send the event.
			} catch (_err) {
				// On error in our filter, don't swallow the event.
			}
			return event
		},
	})
}
