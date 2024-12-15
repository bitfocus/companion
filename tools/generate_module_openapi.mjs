#!/usr/bin/env zx

await $`yarn openapi-typescript https://developer.bitfocus.io/openapi.yaml -o ./shared-lib/lib/OpenApi/ModuleStore.ts`

await $`yarn prettier -w ./shared-lib/lib/OpenApi/ModuleStore.ts`
