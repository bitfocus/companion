#!/usr/bin/env zx

await $`zx tools/build/dist.mjs ${argv._.slice(1)}`
await $`zx tools/build/package.mjs ${argv._.slice(1)}`
