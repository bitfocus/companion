#!/usr/bin/env zx

import { fs } from 'zx'

//  rm -Rf public/_deps; mkdir public/_deps && cp -R ../node_modules/monaco-editor/min/vs public/_deps/monaco

// Trash an old folder and/or create a new one
fs.emptyDirSync('public/_deps')

// copy monaco editor run-time
const cpOpts = { preserveTimestamps: true }
fs.copySync('../node_modules/monaco-editor/min/vs', 'public/_deps/monaco', cpOpts)
