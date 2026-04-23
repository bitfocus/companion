#!/usr/bin/env zx

/**
 * Start Vite and Docusaurus concurrently, synchronizing the --base arg to Docusaurus's BASE_URL.
 * Usage:
 *   yarn dev:docs
 *   yarn dev:docs --base=/testme/
 *
 * Passes any extra args (e.g. --base) through to Vite.
 * Uses concurrently with --kill-others so both processes stop together (Ctrl-C or Vite's "q").
 * If Vite's "q" is not working, use Ctrl-C to stop both processes.
 */
import { createConnection } from 'net'
import { resolve } from 'path'
import concurrently, { type ConcurrentlyCommandInput } from 'concurrently'
import { $, argv, question, usePowerShell } from 'zx'
import { normalizeBasePath } from './webui-dev-utils.ts'

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

// Parse --base arg and normalize
const normalizedBase = normalizeBasePath(argv.base ?? '')
//docusaurusHost notes:
// (1) dev docusaurus will always be served on the local dev computer
// (2) localhost is hardcoded here and in vite.config.ts, but since it's unlikely to change, should be fine
const docusaurusHost = 'localhost'

// Forward all args after the script name to Vite unaltered (safe regardless of how zx is invoked)
const scriptIndex = process.argv.findIndex((arg) => resolve(arg) === import.meta.filename)
const viteArgs = process.argv.slice(scriptIndex + 1).join(' ')

// Check if a port is already in use
function isPortInUse(port: number, host: string): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host })
		socket.once('connect', () => {
			socket.destroy()
			resolve(true)
		})
		socket.once('error', () => resolve(false))
	})
}

// If port 4000 is in use, ask user what to do
let skipDocusaurus = false
if (await isPortInUse(4000, docusaurusHost)) {
	let answer = ''
	while (!/^(y|s)$/i.test(answer)) {
		answer = await question(
			`Port 4000 (used for Docusaurus) is already in use on ${docusaurusHost}. Do you want to replace it?\n` +
				`  [y] kill existing and start fresh\n` +
				`  [s] skip starting Docusaurus (use the existing instance)\n` +
				`  [N] abort\n` +
				`Choice: `
		)
		if (answer.toLowerCase() === 'n' || answer === '') {
			console.log('Stopping...')
			process.exit(1)
		}
	}
	if (answer.toLowerCase() === 'y') {
		if (process.platform === 'win32') {
			const result = await $`netstat -ano`.quiet().nothrow()
			const pid = result.stdout
				.split('\n')
				.filter((line) => /:4000\s.*LISTENING/.test(line)) // match :4000 followed by whitespace, avoids false matches like :40001
				.map((line) => line.trim().split(/\s+/).pop())
				.find((pid) => pid && pid !== '0')
			if (pid) {
				await $`taskkill /pid ${pid} /f /t`.quiet().nothrow()
				console.log(`Killed process ${pid} on port 4000`)
			} else {
				console.error('Could not find process on port 4000')
				process.exit(1)
			}
		} else {
			await $`lsof -ti TCP:4000 -sTCP:LISTEN | xargs kill -9`.quiet().nothrow()
			console.log('Killed process on port 4000')
		}
	} else {
		// s — skip, use existing Docusaurus instance
		skipDocusaurus = true
	}
}

console.log(`Starting Vite${skipDocusaurus ? '' : ' and Docusaurus'}...`)
if (normalizedBase) console.log(`Base path: ${normalizedBase}`)
console.log(`yarn workspace @companion-app/webui dev ${viteArgs} --clearScreen false`)
if (!skipDocusaurus) {
	console.log(`yarn workspace @companion-app/docs start --no-open --host ${docusaurusHost}`)
	console.log(`\x1b[1;36m* If Vite's "q" is not working, use Ctrl-C. Either one will stop both processes.\x1b[0m`)
}

const commands: ConcurrentlyCommandInput[] = [
	{
		command: `yarn workspace @companion-app/webui dev ${viteArgs} --clearScreen false`,
		name: 'vite',
		raw: true,
	},
	...(!skipDocusaurus
		? [
				{
					command: `yarn workspace @companion-app/docs start --no-open --host ${docusaurusHost}`,
					name: 'docusaurus',
					prefixColor: 'cyan',
					env: {
						...process.env,
						BASE_URL: normalizedBase,
					},
				} satisfies ConcurrentlyCommandInput,
			]
		: []),
]

const { result } = concurrently(commands, {
	killOthersOn: ['failure', 'success'],
	timestampFormat: 'HH:mm:ss', // add .SSS for ms
	prefix: '{time} [{name}]',
})

result.then(
	() => process.exit(0),
	() => process.exit(1)
)
