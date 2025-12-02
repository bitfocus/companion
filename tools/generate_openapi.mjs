#!/usr/bin/env zx
import { $ } from 'zx'

await $`yarn openapi-typescript https://developer-staging.bitfocus.io/openapi.yaml -o ./shared-lib/lib/OpenApi/ModuleStore.ts`

await $`yarn prettier -w ./shared-lib/lib/OpenApi/ModuleStore.ts`

await $`yarn openapi-typescript https://updates.companion.free/docs/json -o ./shared-lib/lib/OpenApi/CompanionUpdates.ts`

await $`yarn prettier -w ./shared-lib/lib/OpenApi/CompanionUpdates.ts`
