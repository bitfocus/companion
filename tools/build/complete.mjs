#!/usr/bin/env zx

await $`zx tools/build/dist.mjs ${argv._}`
await $`zx tools/build/package.mjs ${argv._}`
