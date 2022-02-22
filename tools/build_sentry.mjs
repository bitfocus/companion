#!/usr/bin/env zx

const dsn = await process.env.SENTRY_DSN
console.log('Writing:', dsn)

await fs.writeFile(new URL('../SENTRY', import.meta.url), dsn)
