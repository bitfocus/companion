import fs from 'node:fs'
import path from 'node:path'
import prettier from 'prettier'
import { z } from 'zod'
import { LinkMessageSchema } from '../companion/lib/Link/Protocol/Schemas.js'
import { LINK_FEATURES, LINK_PROTOCOL_VERSION } from '../companion/lib/Link/Protocol/Versions.js'

/**
 * The zod schemas and feature table of the Companion Link protocol are the source of truth. This generates json
 * documents from them, so that implementations in other languages have a machine readable description.
 *
 * Pass `--check` to verify the committed files are up to date, instead of writing them.
 */

const checkOnly = process.argv.includes('--check')

const assetsDir = path.join(import.meta.dirname, '../assets')

// `io: 'input'` ensures unknown properties are not forbidden, so that the schema is forwards compatible
const messageSchema = z.toJSONSchema(LinkMessageSchema, { target: 'draft-2020-12', io: 'input' })

const outputs: { content: unknown; outputPath: string }[] = [
	{ content: messageSchema, outputPath: path.join(assetsDir, 'link-protocol.schema.json') },
	{
		content: { protocolVersion: LINK_PROTOCOL_VERSION, features: LINK_FEATURES },
		outputPath: path.join(assetsDir, 'link-protocol-features.json'),
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
	console.error(`\nRun 'yarn build:link-schema' and commit the result.`)
	process.exit(1)
}
