let reloader
try {
	reloader = await import('electron-reloader')
} catch (_) {}

reloader?.default(import.meta)

await import('./main.js')
