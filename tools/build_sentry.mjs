#!/usr/bin/env zx

import { writeFile } from 'fs'
const dsn = await process.env.SENTRY_DSN
console.log('Writing:', dsn)

await writeFile(new URL('../SENTRY', import.meta.url), dsn)
