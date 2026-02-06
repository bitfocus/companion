import { $, path } from 'zx'
import fs from 'fs'
import { Ajv2020 } from 'ajv/dist/2020.js'
import standaloneCode from 'ajv/dist/standalone/index.js'
import { compileFromFile } from 'json-schema-to-typescript'

// Once we drop node18, we can use an import statement instead of a fs readFileSync
// import schema from '../assets/manifest.schema.json' with { type: 'json' }
const schemaPath = path.join(import.meta.dirname, '../assets/satellite-surface.schema.json')
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))

// The generated code will have a default export:
// `module.exports = <validateFunctionCode>;module.exports.default = <validateFunctionCode>;`
const ajv = new Ajv2020({
	code: { source: true, esm: true },
	allowMatchingProperties: true, // because of 'default' in stylePresets
})
const validate = ajv.compile(schema)
// @ts-expect-error - TS can't resolve the default export properly with node16 moduleResolution
let moduleCode = standaloneCode(ajv, validate)

// Now you can write the module code to file
const validatorPath = path.join(import.meta.dirname, '../companion/generated/SatelliteSurfaceSchemaValidator.js')
fs.writeFileSync(validatorPath, '/* eslint-disable */\n' + moduleCode)

// Format with prettier so that it doesnt bloat git
$`prettier -w ${validatorPath}`

const PrettierConf = JSON.parse(fs.readFileSync(new URL('../.prettierrc', import.meta.url), 'utf8'))

// Now compile to typescript
const compiledTypescript = await compileFromFile(schemaPath, {
	additionalProperties: true,
	style: PrettierConf,
	enableConstEnums: false,
})

fs.writeFileSync(
	new URL('../companion/lib/Service/Satellite/SatelliteSurfaceManifestSchema.ts', import.meta.url),
	compiledTypescript,
	'utf8'
)
