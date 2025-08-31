import fs from 'fs'
import Ajv2020 from 'ajv/dist/2020'
import standaloneCode from 'ajv/dist/standalone/index.js'
import { compileFromFile } from 'json-schema-to-typescript'
import { fileURLToPath } from 'url'

// Once we drop node18, we can use an import statement instead of a fs readFileSync
// import schema from '../assets/manifest.schema.json' with { type: 'json' }
const schemaPath = fileURLToPath(new URL('../assets/satellite-surface.schema.json', import.meta.url))
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))

// The generated code will have a default export:
// `module.exports = <validateFunctionCode>;module.exports.default = <validateFunctionCode>;`
const ajv = new Ajv2020({
	code: { source: true, esm: true },
	allowMatchingProperties: true, // because of 'default' in stylePresets
})
const validate = ajv.compile(schema)
let moduleCode = standaloneCode(ajv, validate)

// Now you can write the module code to file
fs.writeFileSync(
	new URL('../companion/lib/Service/Satellite/SatelliteSurfaceSchemaValidator.js', import.meta.url),
	'/* eslint-disable */\n' + moduleCode
)

const PrettierConf = JSON.parse(fs.readFileSync(new URL('../.prettierrc', import.meta.url), 'utf8'))

// Now compile to typescript
const compiledTypescript = await compileFromFile(schemaPath, {
	additionalProperties: true,
	style: PrettierConf,
	enableConstEnums: false,
})

fs.writeFileSync(
	new URL('../companion/lib/Service/Satellite/SatelliteSurfaceSchema.ts', import.meta.url),
	compiledTypescript,
	'utf8'
)
