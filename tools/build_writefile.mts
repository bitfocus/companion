#!/usr/bin/env zx

import { fs, usePowerShell } from 'zx'
import { generateVersionString } from './lib.mts'

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

const build = await generateVersionString()
console.log(`Writing BUILD to ${new URL('../BUILD', import.meta.url)}:`, build)
console.log( process.cwd())
await fs.writeFile(new URL('../BUILD', import.meta.url), build)
if (fs.existsSync(new URL('../dist', import.meta.url))) {
	await fs.writeFile(new URL('../dist/BUILD', import.meta.url), build)
}
const dsn = process.env.SENTRY_DSN || ''
console.log('Writing SENTRY:', dsn)

await fs.writeFile(new URL('../SENTRY', import.meta.url), dsn)
if (fs.existsSync(new URL('../dist', import.meta.url))) {
	await fs.writeFile(new URL('../dist/SENTRY', import.meta.url), dsn)
}