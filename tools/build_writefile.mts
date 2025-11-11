#!/usr/bin/env zx

import { fs, path, usePowerShell } from 'zx'
import { generateVersionString } from './lib.mts'

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

const buildPath = path.join(import.meta.dirname, '../BUILD')
const build = await generateVersionString()
console.log(`Writing BUILD to ${buildPath}:`, build)
await fs.writeFile(buildPath, build)
// a recent change in webpack.config or Registry.ts breaks the webpack.config rules that would have copied the BUILD file...
if (fs.existsSync(new URL('../dist', import.meta.url))) {
	await fs.writeFile(new URL('../dist/BUILD', import.meta.url), build)
}
const dsn = process.env.SENTRY_DSN || ''
console.log('Writing SENTRY:', dsn)

await fs.writeFile(new URL('../SENTRY', import.meta.url), dsn)
if (fs.existsSync(new URL('../dist', import.meta.url))) {
	await fs.writeFile(new URL('../dist/SENTRY', import.meta.url), dsn)
}
