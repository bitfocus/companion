#!/usr/bin/env zx

import path from 'path'
import { fs } from 'zx'

const toolsDir = path.join(__dirname, '..')
const frameworkDir = path.resolve('@companion-module/base')
console.log(`Building for: ${process.cwd()}`)

console.log(`Tools path: ${toolsDir}`)
console.log(`Framework path: ${frameworkDir}`)

// clean old
await fs.remove('pkg')

// build the code
const webpackConfig = path.join(toolsDir, 'webpack.config.cjs')
await $`yarn webpack -c ${webpackConfig}`

// copy in the metadata
await fs.copy('companion', 'pkg/companion')
