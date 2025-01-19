#!/usr/bin/env zx

await $`yarn openapi-typescript https://developer-staging.bitfocus.io/openapi.yaml -o ./shared-lib/lib/OpenApi/ModuleStore.ts`

await $`yarn prettier -w ./shared-lib/lib/OpenApi/ModuleStore.ts`
