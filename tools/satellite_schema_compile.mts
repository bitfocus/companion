import fs from 'node:fs'
import path from 'node:path'
import prettier from 'prettier'
import { z } from 'zod'
import { API_VERSION } from '../satellite-protocol/lib/constants.js'
import { SatelliteConfigFieldsSchema } from '../satellite-protocol/lib/SatelliteConfigFieldsSchema.js'
import { SatelliteSurfaceLayoutSchema } from '../satellite-protocol/lib/SatelliteSurfaceManifestSchema.js'
import { SATELLITE_FEATURES } from '../satellite-protocol/lib/versions.js'

/**
 * The zod schemas and feature table in satellite-protocol are the source of truth. This generates json documents
 * from them, so that satellite clients have a machine readable description of the protocol.
 *
 * The schemas are written both into the satellite-protocol package (for publishing) and to the root `assets`
 * folder, where they have historically been published.
 *
 * Pass `--check` to verify the committed files are up to date, instead of writing them.
 */

const checkOnly = process.argv.includes('--check')

const assetsDir = path.join(import.meta.dirname, '../assets')
const packageAssetsDir = path.join(import.meta.dirname, '../satellite-protocol/assets')

// `io: 'input'` ensures unknown properties are not forbidden, so that the schema is forwards compatible
const surfaceSchema = z.toJSONSchema(SatelliteSurfaceLayoutSchema, { target: 'draft-2020-12', io: 'input' })
const configFieldsSchema = z.toJSONSchema(SatelliteConfigFieldsSchema, { target: 'draft-2020-12', io: 'input' })

const outputs: { content: unknown; outputPath: string }[] = [
	{ content: surfaceSchema, outputPath: path.join(assetsDir, 'satellite-surface.schema.json') },
	{ content: configFieldsSchema, outputPath: path.join(assetsDir, 'satellite-config-fields.schema.json') },
	{ content: surfaceSchema, outputPath: path.join(packageAssetsDir, 'satellite-surface.schema.json') },
	{ content: configFieldsSchema, outputPath: path.join(packageAssetsDir, 'satellite-config-fields.schema.json') },
	{
		content: { apiVersion: API_VERSION, features: SATELLITE_FEATURES },
		outputPath: path.join(packageAssetsDir, 'satellite-api-features.json'),
	},
]

const prettierConf = await prettier.resolveConfig(outputs[0].outputPath)

let anyOutdated = false

for (const { content, outputPath } of outputs) {
	const formatted = await prettier.format(JSON.stringify(content), { ...prettierConf, parser: 'json' })

	if (checkOnly) {
		const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : ''
		if (current !== formatted) {
			anyOutdated = true
			console.error(`Out of date: ${outputPath}`)
		}
	} else {
		fs.writeFileSync(outputPath, formatted, 'utf8')
	}
}

if (anyOutdated) {
	console.error(`\nRun 'yarn build:satellite-schema' and commit the result.`)
	process.exit(1)
}
