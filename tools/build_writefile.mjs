#!/usr/bin/env zx

import { generateVersionString } from './lib.mjs'

const build = await generateVersionString()
console.log('Writing:', build)

await fs.writeFile(new URL('../BUILD', import.meta.url), build)
