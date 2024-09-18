#!/usr/bin/env zx

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

await $`zx tools/build/dist.mjs ${argv._}`
await $`zx tools/build/package.mjs ${argv._}`
