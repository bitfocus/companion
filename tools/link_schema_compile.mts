import { path } from 'zx'
import fs from 'fs'
import { compileFromFile } from 'json-schema-to-typescript'

const schemaPath = path.join(import.meta.dirname, '../assets/link-protocol.schema.json')

const PrettierConf = JSON.parse(fs.readFileSync(new URL('../.prettierrc', import.meta.url), 'utf8'))

// Compile JSON Schema to TypeScript types
const compiledTypescript = await compileFromFile(schemaPath, {
	additionalProperties: false,
	style: PrettierConf,
	enableConstEnums: false,
})

fs.writeFileSync(new URL('../companion/lib/Link/LinkProtocolSchema.ts', import.meta.url), compiledTypescript, 'utf8')
