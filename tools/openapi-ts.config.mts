import { defineConfig, type OpenApiOperationObject, type UserConfig } from '@hey-api/openapi-ts'

/** The specs are committed in `shared-lib/openapi/`; refresh them with `yarn openapi:update-specs` */
export const specs = [
	{ name: 'ModuleStore', url: 'https://developer-staging.bitfocus.io/openapi.yaml', file: 'ModuleStore.yaml' },
	{ name: 'CompanionUpdates', url: 'https://updates.companion.free/docs/json', file: 'CompanionUpdates.json' },
] as const

export const specsDir = './shared-lib/openapi'

/**
 * The module store spec declares `moduleType` twice on its `{moduleType}/{moduleName}` paths, instead of `moduleType`
 * and `moduleName`. Rename each duplicated path parameter to the placeholder the path is missing a parameter for.
 */
function fixDuplicatePathParameters(
	_method: string,
	path: string,
	operation: OpenApiOperationObject.V3_0_X | OpenApiOperationObject.V3_1_X | OpenApiOperationObject.V2_0_X
): void {
	const pathParameters = (operation.parameters ?? []).filter(
		(parameter): parameter is { in: 'path'; name: string } => 'in' in parameter && parameter.in === 'path'
	)
	const missingNames = Array.from(path.matchAll(/\{(\w+)\}/g), (match) => match[1]).filter(
		(name) => !pathParameters.some((parameter) => parameter.name === name)
	)

	const seenNames = new Set<string>()
	for (const parameter of pathParameters) {
		if (seenNames.has(parameter.name)) parameter.name = missingNames.shift() ?? parameter.name
		seenNames.add(parameter.name)
	}
}

export default defineConfig(
	specs.map((spec): UserConfig => ({
		input: `${specsDir}/${spec.file}`,
		// shared-lib uses Node16 module resolution, which needs explicit extensions
		output: { path: `./shared-lib/lib/OpenApi/${spec.name}`, module: { extension: '.js' } },
		parser: { patch: { operations: fixDuplicatePathParameters } },
		plugins: [
			'@hey-api/client-fetch',
			'@hey-api/typescript',
			// Each API is on its own server, so require each call to be given its client rather than using a default one
			{ name: '@hey-api/sdk', client: false },
		],
	}))
)
