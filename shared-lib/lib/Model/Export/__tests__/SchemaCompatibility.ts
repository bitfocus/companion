type JsonSchema = Record<string, any>

/** Keywords that describe a schema without changing what it accepts */
const ANNOTATIONS = new Set(['$schema', '$defs', 'default', 'description', 'title', 'examples', 'deprecated'])

/** Keywords understood by the comparison. Any other one has to be unchanged */
const COMPARED = new Set([
	'$ref',
	'type',
	'const',
	'enum',
	'anyOf',
	'oneOf',
	'properties',
	'required',
	'additionalProperties',
	'propertyNames',
	'items',
])

/**
 * Find how a new version of a JSON schema is incompatible with the old: where it no longer accepts something the old
 * one did, or no longer has a property the old one had. Adding an optional property, or widening what is accepted, is
 * compatible.
 * @returns a description of each incompatibility, empty if there are none
 */
export function findSchemaIncompatibilities(oldSchema: JsonSchema, newSchema: JsonSchema): string[] {
	return new SchemaComparison(oldSchema, newSchema).compare(oldSchema, newSchema, '')
}

class SchemaComparison {
	readonly #oldRoot: JsonSchema
	readonly #newRoot: JsonSchema
	/** The pairs being compared, so that recursive schemas end */
	readonly #comparing = new Map<JsonSchema, Set<JsonSchema>>()

	constructor(oldRoot: JsonSchema, newRoot: JsonSchema) {
		this.#oldRoot = oldRoot
		this.#newRoot = newRoot
	}

	compare(oldNode: JsonSchema, newNode: JsonSchema, path: string): string[] {
		oldNode = resolve(this.#oldRoot, oldNode)
		newNode = resolve(this.#newRoot, newNode)

		// Revisiting a pair already being compared, through a recursive schema, adds nothing
		let comparing = this.#comparing.get(oldNode)
		if (comparing?.has(newNode)) return []
		if (!comparing) {
			comparing = new Set()
			this.#comparing.set(oldNode, comparing)
		}
		comparing.add(newNode)

		try {
			return this.#compareResolved(oldNode, newNode, path)
		} finally {
			comparing.delete(newNode)
		}
	}

	#compareResolved(oldNode: JsonSchema, newNode: JsonSchema, path: string): string[] {
		const at = path || '(root)'

		// Accepting anything accepts whatever the old one did
		if (acceptsAnything(newNode)) return []
		if (acceptsAnything(oldNode)) return [`${at}: accepted anything, but is now restricted`]

		// Each option of the old one must still be accepted
		const oldOptions = unionOptions(oldNode)
		if (oldOptions) {
			return oldOptions.flatMap((option, index) =>
				this.compare(option, newNode, `${path}${oldOptions.length > 1 ? `<option ${index}>` : ''}`)
			)
		}

		// By any one option of the new one
		const newOptions = unionOptions(newNode)
		if (newOptions) {
			let closest: string[] | undefined
			for (const option of newOptions) {
				const issues = this.compare(oldNode, option, path)
				if (issues.length === 0) return []
				if (!closest || issues.length < closest.length) closest = issues
			}
			return closest ?? [`${at}: no longer accepted`]
		}

		const issues: string[] = []

		for (const key of new Set([...Object.keys(oldNode), ...Object.keys(newNode)])) {
			if (ANNOTATIONS.has(key) || COMPARED.has(key)) continue
			if (JSON.stringify(oldNode[key]) !== JSON.stringify(newNode[key])) {
				issues.push(`${at}: "${key}" changed from ${JSON.stringify(oldNode[key])} to ${JSON.stringify(newNode[key])}`)
			}
		}

		const oldTypes = typesOf(oldNode)
		const newTypes = typesOf(newNode)
		if (newTypes) {
			const removed = (oldTypes ?? ['any']).filter((type) => !acceptsType(newTypes, type))
			if (removed.length) issues.push(`${at}: no longer accepts ${removed.join(', ')}`)
		}

		const newValues = valuesOf(newNode)
		if (newValues) {
			const oldValues = valuesOf(oldNode)
			if (!oldValues) {
				issues.push(`${at}: is now restricted to ${newValues.map((value) => JSON.stringify(value)).join(', ')}`)
			} else {
				const removed = oldValues.filter((value) => !newValues.some((other) => isEqual(value, other)))
				if (removed.length) {
					issues.push(`${at}: no longer accepts ${removed.map((value) => JSON.stringify(value)).join(', ')}`)
				}
			}
		}

		issues.push(...this.#compareObject(oldNode, newNode, path))

		if (oldNode.items || newNode.items) {
			issues.push(...this.compare(oldNode.items ?? {}, newNode.items ?? {}, `${path}[]`))
		}

		return issues
	}

	#compareObject(oldNode: JsonSchema, newNode: JsonSchema, path: string): string[] {
		const issues: string[] = []
		const oldProperties: Record<string, JsonSchema> = oldNode.properties ?? {}
		const newProperties: Record<string, JsonSchema> = newNode.properties ?? {}
		const oldRequired = new Set<string>(oldNode.required ?? [])

		for (const [key, oldProperty] of Object.entries(oldProperties)) {
			const newProperty = newProperties[key]
			if (!newProperty) {
				issues.push(`${path}.${key}: was removed`)
			} else {
				issues.push(...this.compare(oldProperty, newProperty, `${path}.${key}`))
			}
		}

		for (const key of newNode.required ?? []) {
			if (oldRequired.has(key)) continue
			issues.push(oldProperties[key] ? `${path}.${key}: is now required` : `${path}.${key}: was added as required`)
		}

		if (oldNode.additionalProperties !== undefined || newNode.additionalProperties !== undefined) {
			const oldAdditional = additionalSchema(oldNode.additionalProperties)
			const newAdditional = additionalSchema(newNode.additionalProperties)
			if (oldAdditional && !newAdditional) {
				issues.push(`${path || '(root)'}: no longer accepts other properties`)
			} else if (oldAdditional && newAdditional) {
				issues.push(...this.compare(oldAdditional, newAdditional, `${path}.*`))
			}
		}

		if (oldNode.propertyNames || newNode.propertyNames) {
			issues.push(...this.compare(oldNode.propertyNames ?? {}, newNode.propertyNames ?? {}, `${path}<key>`))
		}

		return issues
	}
}

function resolve(root: JsonSchema, node: JsonSchema): JsonSchema {
	const seen = new Set<string>()
	while (typeof node.$ref === 'string') {
		if (seen.has(node.$ref)) throw new Error(`Circular $ref ${node.$ref}`)
		seen.add(node.$ref)

		if (node.$ref === '#') {
			node = root
			continue
		}
		const match = /^#\/\$defs\/(.+)$/.exec(node.$ref)
		const target = match ? root.$defs?.[match[1]] : undefined
		if (!target) throw new Error(`Unable to resolve $ref ${node.$ref}`)
		node = target
	}
	return node
}

function acceptsAnything(node: JsonSchema): boolean {
	return Object.keys(node).every((key) => ANNOTATIONS.has(key))
}

function unionOptions(node: JsonSchema): JsonSchema[] | undefined {
	const options = node.anyOf ?? node.oneOf
	if (!Array.isArray(options)) return undefined

	// Keywords alongside the options apply to each of them
	const shared = Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'anyOf' && key !== 'oneOf'))
	return Object.keys(shared).length ? options.map((option: JsonSchema) => ({ ...shared, ...option })) : options
}

function typesOf(node: JsonSchema): string[] | undefined {
	if (node.type === undefined) return undefined
	return Array.isArray(node.type) ? node.type : [node.type]
}

function acceptsType(types: string[], type: string): boolean {
	return types.includes(type) || (type === 'integer' && types.includes('number'))
}

function valuesOf(node: JsonSchema): unknown[] | undefined {
	if ('const' in node) return [node.const]
	return Array.isArray(node.enum) ? node.enum : undefined
}

/** The schema of the other properties of an object, or null if there may be none */
function additionalSchema(value: unknown): JsonSchema | null {
	if (value === false) return null
	if (value === true || value === undefined) return {}
	return value
}

function isEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b)
}
