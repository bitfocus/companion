import fs from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'
import { generateOpenApiDocument } from '../../../lib/Service/RestApi/openapi.js'

const STABLE_CONTRACT_PATH = path.resolve(import.meta.dirname, './contracts/openapi-stable.json')

type JsonObject = Record<string, any>

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'] as const

describe('REST API OpenAPI backwards compatibility', () => {
	test('current OpenAPI contract is compatible with the stable contract', () => {
		const stableContract = JSON.parse(fs.readFileSync(STABLE_CONTRACT_PATH, 'utf8')) as JsonObject
		const currentContract = normalizeOpenApiDocument(generateOpenApiDocument({ appVersion: '0.0.0-current-contract' }))

		const errors = compareOpenApiContracts(stableContract, currentContract)

		expect(errors, `Breaking REST API contract changes:\n${errors.map((error) => `- ${error}`).join('\n')}`).toEqual([])
	})
})

function compareOpenApiContracts(stable: JsonObject, current: JsonObject): string[] {
	const errors: string[] = []

	compareComponents(stable, current, errors)
	comparePaths(stable, current, errors)
	compareNewRequestPropertiesAreOptional(stable, current, errors)

	return errors
}

function compareComponents(stable: JsonObject, current: JsonObject, errors: string[]): void {
	for (const [name, stableSchema] of Object.entries(stable.components?.schemas ?? {})) {
		const currentSchema = current.components?.schemas?.[name]
		if (!currentSchema) {
			errors.push(`Removed schema: ${jsonPointer(['components', 'schemas', name])}`)
			continue
		}

		compareSchema(stableSchema as JsonObject, currentSchema, stable, current, ['components', 'schemas', name], errors)
	}
}

function comparePaths(stable: JsonObject, current: JsonObject, errors: string[]): void {
	for (const [pathName, stablePath] of Object.entries(stable.paths ?? {})) {
		const currentPath = current.paths?.[pathName]
		if (!currentPath) {
			errors.push(`Removed path: ${jsonPointer(['paths', pathName])}`)
			continue
		}

		for (const method of HTTP_METHODS) {
			const stableOperation = (stablePath as JsonObject)[method]
			if (!stableOperation) continue

			const currentOperation = currentPath[method]
			if (!currentOperation) {
				errors.push(`Removed operation: ${jsonPointer(['paths', pathName, method])}`)
				continue
			}

			compareParameters(
				stableOperation.parameters ?? [],
				currentOperation.parameters ?? [],
				['paths', pathName, method, 'parameters'],
				errors
			)
			compareRequestBody(
				stableOperation.requestBody,
				currentOperation.requestBody,
				stable,
				current,
				['paths', pathName, method, 'requestBody'],
				errors
			)
			compareResponses(
				stableOperation.responses ?? {},
				currentOperation.responses ?? {},
				stable,
				current,
				['paths', pathName, method, 'responses'],
				errors
			)
		}
	}
}

function compareParameters(
	stableParameters: JsonObject[],
	currentParameters: JsonObject[],
	path: string[],
	errors: string[]
): void {
	for (const stableParameter of stableParameters) {
		const currentParameter = currentParameters.find(
			(parameter) => parameter.name === stableParameter.name && parameter.in === stableParameter.in
		)

		if (!currentParameter) {
			errors.push(`Removed parameter: ${jsonPointer([...path, `${stableParameter.in}:${stableParameter.name}`])}`)
			continue
		}

		if (!stableParameter.required && currentParameter.required) {
			errors.push(
				`Parameter became required: ${jsonPointer([...path, `${stableParameter.in}:${stableParameter.name}`])}`
			)
		}
	}
}

function compareRequestBody(
	stableRequestBody: JsonObject | undefined,
	currentRequestBody: JsonObject | undefined,
	stableDocument: JsonObject,
	currentDocument: JsonObject,
	path: string[],
	errors: string[]
): void {
	if (!stableRequestBody) return
	if (!currentRequestBody) {
		errors.push(`Removed request body: ${jsonPointer(path)}`)
		return
	}

	if (!stableRequestBody.required && currentRequestBody.required) {
		errors.push(`Request body became required: ${jsonPointer(path)}`)
	}

	compareContent(
		stableRequestBody.content ?? {},
		currentRequestBody.content ?? {},
		stableDocument,
		currentDocument,
		[...path, 'content'],
		errors
	)
}

function compareResponses(
	stableResponses: JsonObject,
	currentResponses: JsonObject,
	stableDocument: JsonObject,
	currentDocument: JsonObject,
	path: string[],
	errors: string[]
): void {
	for (const [status, stableResponse] of Object.entries(stableResponses)) {
		const currentResponse = currentResponses[status]
		if (!currentResponse) {
			errors.push(`Removed response: ${jsonPointer([...path, status])}`)
			continue
		}

		compareContent(
			stableResponse.content ?? {},
			currentResponse.content ?? {},
			stableDocument,
			currentDocument,
			[...path, status, 'content'],
			errors
		)
	}
}

function compareContent(
	stableContent: JsonObject,
	currentContent: JsonObject,
	stableDocument: JsonObject,
	currentDocument: JsonObject,
	path: string[],
	errors: string[]
): void {
	for (const [contentType, stableMedia] of Object.entries(stableContent)) {
		const currentMedia = currentContent[contentType]
		if (!currentMedia) {
			errors.push(`Removed content type: ${jsonPointer([...path, contentType])}`)
			continue
		}

		compareSchema(
			stableMedia.schema,
			currentMedia.schema,
			stableDocument,
			currentDocument,
			[...path, contentType, 'schema'],
			errors
		)
	}
}

function compareSchema(
	stableSchemaInput: JsonObject | undefined,
	currentSchemaInput: JsonObject | undefined,
	stableDocument: JsonObject,
	currentDocument: JsonObject,
	path: string[],
	errors: string[],
	seenReferencePairs = new Set<string>()
): void {
	if (!stableSchemaInput) return
	if (!currentSchemaInput) {
		errors.push(`Removed schema reference: ${jsonPointer(path)}`)
		return
	}

	if (stableSchemaInput.$ref && currentSchemaInput.$ref) {
		const referencePair = `${stableSchemaInput.$ref}\n${currentSchemaInput.$ref}`
		if (seenReferencePairs.has(referencePair)) return
		seenReferencePairs.add(referencePair)
	}

	const stableSchema = resolveSchema(stableSchemaInput, stableDocument)
	const currentSchema = resolveSchema(currentSchemaInput, currentDocument)

	if (stableSchema.type && currentSchema.type && stableSchema.type !== currentSchema.type) {
		errors.push(`Changed schema type from ${stableSchema.type} to ${currentSchema.type}: ${jsonPointer(path)}`)
	}

	if (stableSchema.enum && currentSchema.enum) {
		for (const enumValue of stableSchema.enum) {
			if (!currentSchema.enum.includes(enumValue)) {
				errors.push(`Removed enum value ${JSON.stringify(enumValue)}: ${jsonPointer([...path, 'enum'])}`)
			}
		}
	}

	if (stableSchema.properties) {
		const currentProperties = collectSchemaProperties(currentSchema)
		for (const [propertyName, stableProperty] of Object.entries(stableSchema.properties)) {
			const currentProperty = currentProperties[propertyName]
			if (!currentProperty) {
				errors.push(`Removed property: ${jsonPointer([...path, 'properties', propertyName])}`)
				continue
			}

			compareSchema(
				stableProperty as JsonObject,
				currentProperty,
				stableDocument,
				currentDocument,
				[...path, 'properties', propertyName],
				errors,
				seenReferencePairs
			)
		}
	}

	const stableRequired = new Set(stableSchema.required ?? [])
	for (const requiredProperty of currentSchema.required ?? []) {
		if (!stableRequired.has(requiredProperty)) {
			errors.push(`Property became required: ${jsonPointer([...path, 'required', requiredProperty])}`)
		}
	}

	if (stableSchema.items) {
		compareSchema(
			stableSchema.items,
			currentSchema.items,
			stableDocument,
			currentDocument,
			[...path, 'items'],
			errors,
			seenReferencePairs
		)
	}
}

function collectSchemaProperties(schema: JsonObject): Record<string, JsonObject> {
	const properties: Record<string, JsonObject> = { ...(schema.properties ?? {}) }

	for (const keyword of ['oneOf', 'anyOf', 'allOf'] as const) {
		for (const childSchema of schema[keyword] ?? []) {
			Object.assign(properties, collectSchemaProperties(childSchema))
		}
	}

	return properties
}

function compareNewRequestPropertiesAreOptional(stable: JsonObject, current: JsonObject, errors: string[]): void {
	for (const [pathName, currentPath] of Object.entries(current.paths ?? {})) {
		const stablePath = stable.paths?.[pathName]
		if (!stablePath) continue

		for (const method of HTTP_METHODS) {
			const currentOperation = (currentPath as JsonObject)[method]
			const stableOperation = stablePath[method]
			if (!currentOperation || !stableOperation) continue

			for (const [contentType, currentMedia] of Object.entries(currentOperation.requestBody?.content ?? {})) {
				const stableMedia = stableOperation.requestBody?.content?.[contentType]
				if (!stableMedia) continue

				compareNewRequiredProperties(
					resolveSchema(stableMedia.schema, stable),
					resolveSchema((currentMedia as JsonObject).schema, current),
					['paths', pathName, method, 'requestBody', 'content', contentType, 'schema'],
					errors
				)
			}
		}
	}
}

function compareNewRequiredProperties(
	stableSchema: JsonObject,
	currentSchema: JsonObject,
	path: string[],
	errors: string[]
): void {
	for (const requiredProperty of currentSchema.required ?? []) {
		if (!stableSchema.properties?.[requiredProperty]) {
			errors.push(`New request property is required: ${jsonPointer([...path, 'required', requiredProperty])}`)
		}
	}

	for (const [propertyName, currentProperty] of Object.entries(currentSchema.properties ?? {})) {
		const stableProperty = stableSchema.properties?.[propertyName]
		if (!stableProperty) continue

		compareNewRequiredProperties(
			stableProperty,
			currentProperty as JsonObject,
			[...path, 'properties', propertyName],
			errors
		)
	}

	if (stableSchema.items && currentSchema.items) {
		compareNewRequiredProperties(stableSchema.items, currentSchema.items, [...path, 'items'], errors)
	}
}

function resolveSchema(schema: JsonObject | undefined, document: JsonObject, seen = new Set<string>()): JsonObject {
	if (!schema) return {}
	if (!schema.$ref) return schema

	const ref = schema.$ref as string
	if (seen.has(ref)) return schema
	seen.add(ref)

	if (!ref.startsWith('#/')) return schema

	const target = ref
		.slice(2)
		.split('/')
		.reduce<any>((obj, segment) => obj?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')], document)

	return resolveSchema(target, document, seen)
}

function normalizeOpenApiDocument(document: ReturnType<typeof generateOpenApiDocument>): JsonObject {
	return sortJson({
		...document,
		info: {
			...document.info,
			version: '0.0.0-stable-contract',
		},
	}) as JsonObject
}

function sortJson(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortJson)

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, child]) => [key, sortJson(child)])
		)
	}

	return value
}

function jsonPointer(path: string[]): string {
	return `/${path.map((segment) => segment.replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`
}
