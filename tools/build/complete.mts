#!/usr/bin/env zx

import { $, usePowerShell, argv } from 'zx'

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

await $`tsx tools/build/dist.mts ${argv._}`
await $`tsx tools/build/package.mts ${argv._}`
