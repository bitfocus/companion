import { devThreadOutDir, startDevThreadBuild } from '../tools/build_dev_threads.mts'

let reloader
try {
	reloader = await import('electron-reloader')
} catch (_) {}

reloader?.default(import.meta)

// The backend runs from source, but its thread entrypoints must be bundled first (see build_dev_threads.mts)
await startDevThreadBuild()
process.env.COMPANION_DEV_THREAD_DIR = devThreadOutDir

await import('./main.js')
