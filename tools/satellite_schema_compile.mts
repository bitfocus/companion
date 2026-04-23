import fs from 'fs'
import { Ajv2020 } from 'ajv/dist/2020.js'
import standaloneCode from 'ajv/dist/standalone/index.js'
import { compileFromFile } from 'json-schema-to-typescript'
import { $, path } from 'zx'

const PrettierConf = JSON.parse(fs.readFileSync(new URL('../.prettierrc', import.meta.url), 'utf8'))

interface CompileSchemaOptions {
	schemaPath: string
	validatorOutputPath: string
	typescriptOutputPath: string
	/** Passed to json-schema-to-typescript */
	additionalProperties: boolean
	/** Extra Ajv2020 options */
	ajvOptions?: ConstructorParameters<typeof Ajv2020>[0]
}

async function compileSchema(opts: CompileSchemaOptions): Promise<void> {
	const schema = JSON.parse(fs.readFileSync(opts.schemaPath, 'utf8'))

	// The generated code will have a default export:
	// `module.exports = <validateFunctionCode>;module.exports.default = <validateFunctionCode>;`
	const ajv = new Ajv2020({
		code: { source: true, esm: true },
		...opts.ajvOptions,
	})
	const validate = ajv.compile(schema)
	// @ts-expect-error - TS can't resolve the default export properly with node16 moduleResolution
	const moduleCode = standaloneCode(ajv, validate)

	fs.writeFileSync(opts.validatorOutputPath, moduleCode)
	// Format with prettier so that it doesnt bloat git
	await $`prettier -w ${opts.validatorOutputPath}`

	// Compile to TypeScript types
	const compiledTypescript = await compileFromFile(opts.schemaPath, {
		additionalProperties: opts.additionalProperties,
		style: PrettierConf,
		enableConstEnums: false,
	})
	fs.writeFileSync(opts.typescriptOutputPath, compiledTypescript, 'utf8')
}

// ---- Surface manifest schema ----

await compileSchema({
	schemaPath: path.join(import.meta.dirname, '../assets/satellite-surface.schema.json'),
	validatorOutputPath: path.join(import.meta.dirname, '../companion/generated/SatelliteSurfaceSchemaValidator.js'),
	typescriptOutputPath: path.join(
		import.meta.dirname,
		'../companion/lib/Service/Satellite/SatelliteSurfaceManifestSchema.ts'
	),
	additionalProperties: true,
	ajvOptions: { allowMatchingProperties: true }, // because of 'default' in stylePresets
})

// ---- Config fields schema ----

await compileSchema({
	schemaPath: path.join(import.meta.dirname, '../assets/satellite-config-fields.schema.json'),
	validatorOutputPath: path.join(import.meta.dirname, '../companion/generated/SatelliteConfigFieldsSchemaValidator.js'),
	typescriptOutputPath: path.join(
		import.meta.dirname,
		'../companion/lib/Service/Satellite/SatelliteConfigFieldsSchema.ts'
	),
	additionalProperties: true,
	ajvOptions: { allowUnionTypes: true },
})
