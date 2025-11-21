#!/usr/bin/env zx

import { fs } from 'zx'

//  rm -Rf public/_deps; mkdir public/_deps && cp -R ../node_modules/monaco-editor/min/vs public/_deps/monaco
// Trash old, create folder if it doesn't exist
fs.emptyDirSync('public/_deps')

const cpOpts = { preserveTimestamps: true }
fs.copySync('../node_modules/monaco-editor/min/vs', 'public/_deps/monaco', cpOpts)
