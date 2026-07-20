import fs from 'node:fs'
import path from 'node:path'
import prettier from 'prettier'
import { z } from 'zod'
import { SatelliteConfigFieldsSchema } from '../companion/lib/Service/Satellite/SatelliteConfigFieldsSchema.js'
import { SatelliteSurfaceLayoutSchema } from '../companion/lib/Service/Satellite/SatelliteSurfaceManifestSchema.js'

/**
 * The zod schemas are the source of truth. This generates the json-schema documents from them, so that satellite
 * clients have a machine readable description of the protocol.
 *
 * Pass `--check` to verify the committed files are up to date, instead of writing them.
 */

const checkOnly = process.argv.includes('--check')

const schemas: { schema: z.ZodType; outputPath: string }[] = [
	{
		schema: SatelliteSurfaceLayoutSchema,
		outputPath: path.join(import.meta.dirname, '../assets/satellite-surface.schema.json'),
	},
	{
		schema: SatelliteConfigFieldsSchema,
		outputPath: path.join(import.meta.dirname, '../assets/satellite-config-fields.schema.json'),
	},
]

const prettierConf = await prettier.resolveConfig(schemas[0].outputPath)

let anyOutdated = false

for (const { schema, outputPath } of schemas) {
	// `io: 'input'` ensures unknown properties are not forbidden, so that the schema is forwards compatible
	const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' })

	const formatted = await prettier.format(JSON.stringify(jsonSchema), { ...prettierConf, parser: 'json' })

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
