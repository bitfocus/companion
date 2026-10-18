import fs from 'node:fs'
import path from 'node:path'
import prettier from 'prettier'
import { z } from 'zod'
import { LinkAnnouncementSchema } from '../companion/lib/Link/Protocol/Announcement.js'
import { LinkMessageSchema } from '../companion/lib/Link/Protocol/v1/Schemas.js'

/**
 * The zod schemas of the Companion Link protocol are the source of truth. This generates json schemas from them (the
 * announcement, which is the same for every major version, and the messages of each major version), so that
 * implementations in other languages have a machine readable description.
 *
 * Pass `--check` to verify the committed files are up to date, instead of writing them.
 */

const checkOnly = process.argv.includes('--check')

const assetsDir = path.join(import.meta.dirname, '../assets')

// `io: 'input'` ensures unknown properties are not forbidden, so that the schema is forwards compatible
const toJsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' })

const outputs: { content: unknown; outputPath: string }[] = [
	{ content: toJsonSchema(LinkAnnouncementSchema), outputPath: path.join(assetsDir, 'link-announcement.schema.json') },
	{ content: toJsonSchema(LinkMessageSchema), outputPath: path.join(assetsDir, 'link-protocol-v1.schema.json') },
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
