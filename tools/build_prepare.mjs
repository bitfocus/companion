#!/usr/bin/env zx

// Fetch correct libvips for sharp
await $`rimraf node_modules/sharp/vendor`
await $`yarn --cwd node_modules/sharp node install/libvips`
await $`yarn --cwd node_modules/sharp node install/dll-copy`
