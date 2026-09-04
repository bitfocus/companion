import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import readline from 'node:readline'

export interface CompanionServer {
	readonly url: string
	readonly port: number
	readonly configDir: string
	stop(): Promise<void>
}

const READY_MARKER = 'COMPANION_READY '

/**
 * Launch a real Companion application (via the integration-test fixture) as a child process,
 * resolving once its http server is listening.
 */
export async function launchCompanion(): Promise<CompanionServer> {
	const repoRoot = path.join(import.meta.dirname, '../..')

	const child: ChildProcess = spawn(
		process.execPath,
		['--conditions=companion:source', '--import', 'tsx', path.join(import.meta.dirname, 'launch-app.mts')],
		{
			cwd: repoRoot,
			stdio: ['ignore', 'pipe', 'inherit'],
		}
	)

	const ready = await new Promise<{ port: number; configDir: string }>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('Timed out waiting for companion to start')), 60_000)

		const rl = readline.createInterface({ input: child.stdout! })
		rl.on('line', (line) => {
			if (line.startsWith(READY_MARKER)) {
				clearTimeout(timeout)
				resolve(JSON.parse(line.slice(READY_MARKER.length)))
			} else if (line.trim()) {
				// Forward app logs for debugging
				console.log(`[companion] ${line}`)
			}
		})

		child.on('exit', (code) => {
			clearTimeout(timeout)
			reject(new Error(`Companion exited before becoming ready (code ${code})`))
		})
		child.on('error', (err) => {
			clearTimeout(timeout)
			reject(err)
		})
	})

	return {
		url: `http://127.0.0.1:${ready.port}`,
		port: ready.port,
		configDir: ready.configDir,

		async stop() {
			if (child.exitCode !== null) return

			const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
			child.kill('SIGTERM')

			// Give the graceful shutdown a chance before force-killing
			const timeout = setTimeout(() => child.kill('SIGKILL'), 15_000)
			await exited
			clearTimeout(timeout)
		},
	}
}
