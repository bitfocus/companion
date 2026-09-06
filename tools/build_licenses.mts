import path from 'node:path'
import { generateLegalArtifacts } from './licenses/generate.mts'

/**
 * Standalone entrypoint for the license inventory, for running it against an existing dist directory without
 * repeating the whole distribution build. `yarn dist` runs the same code as part of packaging.
 */
await generateLegalArtifacts(path.resolve(import.meta.dirname, '../dist'))
