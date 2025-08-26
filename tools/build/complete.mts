#!/usr/bin/env zx

import { $, usePowerShell, argv } from 'zx'

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

// Enable verbose logging to get output from the commands below
$.verbose = true

await $`tsx tools/build/dist.mts ${argv._}`
await $`tsx tools/build/package.mts ${argv._}`
