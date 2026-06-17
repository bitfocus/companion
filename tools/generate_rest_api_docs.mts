/**
 * Generate Docusaurus-compatible markdown documentation from the REST API OpenAPI spec.
 *
 * Usage:  tsx tools/generate_rest_api_docs.mts
 * Output: docs/user-guide/5_remote-control/rest-api/ (gitignored)
 */

import fs from 'fs'
import path from 'path'
import { generateOpenApiDocument } from '../companion/lib/Service/RestApi/openapi.js'

const OUT_DIR = path.resolve(import.meta.dirname, '../docs/user-guide/5_remote-control/rest-api')
const STATIC_DOCS_DIR = path.resolve(import.meta.dirname, 'rest-api-docs')
const CATEGORY_INTRO_FILE = '_category-intro.md'

interface Parameter {
	name: string
	in: string
	required?: boolean
	schema?: { type?: string; example?: unknown }
	description?: string
}

interface SchemaObject {
	type?: string
	properties?: Record<string, SchemaObject>
	items?: SchemaObject
	required?: string[]
	nullable?: boolean
	enum?: string[]
	description?: string
	default?: unknown
	example?: unknown
	additionalProperties?: SchemaObject | boolean
}

interface MediaContent {
	schema?: SchemaObject
}

interface ResponseObject {
	description?: string
	content?: Record<string, MediaContent>
}

interface RequestBody {
	required?: boolean
	content?: Record<string, MediaContent>
}

interface Operation {
	summary?: string
	description?: string
	tags?: string[]
	parameters?: Parameter[]
	requestBody?: RequestBody
	responses?: Record<string, ResponseObject>
	security?: Record<string, string[]>[]
}

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

interface PathItem {
	get?: Operation
	post?: Operation
	put?: Operation
	patch?: Operation
	delete?: Operation
	parameters?: Parameter[]
}

// ── Helpers ──────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
	fs.mkdirSync(dir, { recursive: true })
}

function escapeTableCell(value: string): string {
	return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function typeToMarkdown(schema: SchemaObject): string {
	if (schema.enum) return schema.enum.map((v) => `\`${v}\``).join(' \\| ')

	let type = schema.type ?? 'object'
	if (type === 'array' && schema.items) {
		type = `${schema.items.type ?? 'object'}[]`
	}
	if (schema.additionalProperties && type === 'object') {
		type = 'object'
	}
	if (schema.nullable) type += ' | null'

	return `\`${escapeTableCell(type)}\``
}

function schemaToTable(schema: SchemaObject, options: { showRequired: boolean }, indent = 0): string {
	if (!schema.properties) return ''

	const rows: string[] = []
	if (indent === 0) {
		rows.push(options.showRequired ? '| Field | Type | Required | Description |' : '| Field | Type | Description |')
		rows.push(options.showRequired ? '|-------|------|----------|-------------|' : '|-------|------|-------------|')
	}

	const required = new Set(schema.required ?? [])

	for (const [name, prop] of Object.entries(schema.properties)) {
		const prefix = indent > 0 ? '&nbsp;'.repeat(indent * 2) + '↳ ' : ''
		const req = required.has(name) ? 'Yes' : 'No'
		const desc = escapeTableCell(prop.description ?? '')
		if (options.showRequired) {
			rows.push(`| ${prefix}\`${name}\` | ${typeToMarkdown(prop)} | ${req} | ${desc} |`)
		} else {
			rows.push(`| ${prefix}\`${name}\` | ${typeToMarkdown(prop)} | ${desc} |`)
		}

		if (prop.properties) {
			rows.push(schemaToTable(prop, options, indent + 1))
		}
	}

	return rows.join('\n')
}

function renderResponse(code: string, resp: ResponseObject): string {
	const lines: string[] = []
	const responseLabel = code === '200' ? '**Successful response** (`200`)' : '**Successful response**'
	lines.push(`${responseLabel} — ${resp.description ?? ''}`)

	const jsonContent = resp.content?.['application/json']
	if (jsonContent?.schema) {
		const schema = jsonContent.schema
		// For envelope schemas, render the inner data shape
		if (schema.properties?.data) {
			const dataSchema = schema.properties.data
			if (dataSchema.type === 'array' && dataSchema.items?.properties) {
				lines.push('')
				lines.push('Response body (collection):')
				lines.push('')
				lines.push(schemaToTable(dataSchema.items, { showRequired: false }))
			} else if (dataSchema.properties) {
				lines.push('')
				lines.push('Response body:')
				lines.push('')
				lines.push(schemaToTable(dataSchema, { showRequired: false }))
			}
		}
	}

	return lines.join('\n')
}

function getDocumentedResponse(responses: Record<string, ResponseObject>): [string, ResponseObject] | undefined {
	const okResponse = responses['200']
	if (okResponse) return ['200', okResponse]

	return Object.entries(responses).find(([code]) => code.startsWith('2'))
}

function renderRequestBody(body: RequestBody): string {
	const lines: string[] = []
	const jsonContent = body.content?.['application/json']
	if (jsonContent?.schema) {
		lines.push('**Request body** (`application/json`):')
		lines.push('')
		lines.push(schemaToTable(jsonContent.schema, { showRequired: true }))
	}
	return lines.join('\n')
}

function exampleValue(schema: SchemaObject | undefined, fieldName = 'value'): unknown {
	if (!schema) return null
	if (schema.example !== undefined) return schema.example
	if (schema.default !== undefined) return schema.default
	if (schema.nullable) return null
	if (schema.enum?.length) return schema.enum[0]
	if (schema.type === 'array') return [exampleValue(schema.items, fieldName)]
	if (schema.properties) {
		const result: Record<string, unknown> = {}
		for (const [name, prop] of Object.entries(schema.properties)) {
			result[name] = exampleValue(prop, name)
		}
		return result
	}
	if (schema.additionalProperties) return {}

	switch (schema.type) {
		case 'boolean':
			return fieldName.startsWith('include_') ? true : false
		case 'number':
		case 'integer':
			return 1
		case 'string':
			return 'string'
		default:
			return null
	}
}

function renderJsonExample(title: string, value: unknown): string {
	return [`**${title}:**`, '', '```json', JSON.stringify(value, null, 2), '```'].join('\n')
}

function renderEndpointExample(method: HttpMethod, apiPath: string, op: Operation, params: Parameter[]): string {
	const lines: string[] = []
	const requestSchema = op.requestBody?.content?.['application/json']?.schema
	const responseEntry = op.responses ? getDocumentedResponse(op.responses) : undefined
	const responseSchema = responseEntry?.[1].content?.['application/json']?.schema
	const examplePath = params.reduce((pathStr, param) => {
		if (param.in !== 'path') return pathStr

		return pathStr.replaceAll(`{${param.name}}`, String(param.schema?.example ?? 'string'))
	}, apiPath)
	const requestExample = requestSchema ? exampleValue(requestSchema) : undefined

	lines.push('**Example:**')
	lines.push('')
	lines.push(`\`${method.toUpperCase()} /api${examplePath}\``)

	if (requestSchema) {
		lines.push('')
		lines.push(renderJsonExample('Request body', requestExample))
	}

	if (responseSchema) {
		lines.push('')
		lines.push(renderJsonExample('Response body', exampleValue(responseSchema)))
	}

	return lines.join('\n')
}

function copyStaticMarkdownDocs(): number {
	const entries = fs.readdirSync(STATIC_DOCS_DIR, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
	let fileCount = 0

	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.startsWith('_')) continue

		fs.copyFileSync(path.join(STATIC_DOCS_DIR, entry.name), path.join(OUT_DIR, entry.name))
		console.log(`Generated: rest-api/${entry.name}`)
		fileCount++
	}

	return fileCount
}

function readStaticMarkdown(fileName: string): string {
	return fs.readFileSync(path.join(STATIC_DOCS_DIR, fileName), 'utf8').trim()
}

function writeCategoryIndexDoc(): void {
	const lines: string[] = []

	lines.push('---')
	lines.push('title: REST API')
	lines.push('sidebar_position: 0')
	lines.push('---')
	lines.push('')
	lines.push("import DocCardList from '@theme/DocCardList'")
	lines.push('')
	lines.push('# REST API')
	lines.push('')
	lines.push(readStaticMarkdown(CATEGORY_INTRO_FILE))
	lines.push('')
	lines.push('<DocCardList />')
	lines.push('')

	fs.writeFileSync(path.join(OUT_DIR, 'index.md'), lines.join('\n'))
	console.log('Generated: rest-api/index.md')
}

// ── Main ─────────────────────────────────────────────────────────────

const doc = generateOpenApiDocument()

ensureDir(OUT_DIR)

// Write category metadata
fs.writeFileSync(
	path.join(OUT_DIR, '_category_.json'),
	JSON.stringify(
		{
			label: 'REST API',
			position: 1,
			link: {
				type: 'doc',
				id: 'remote-control/rest-api/index',
			},
		},
		null,
		'\t'
	) + '\n'
)

// Group operations by tag
const tagGroups = new Map<string, { method: HttpMethod; path: string; op: Operation; pathParams: Parameter[] }[]>()

for (const [pathStr, pathItem] of Object.entries(doc.paths ?? {})) {
	const item = pathItem as PathItem
	const pathParams = item.parameters ?? []

	for (const method of ['get', 'post', 'put', 'patch', 'delete'] as HttpMethod[]) {
		const op = item[method]
		if (!op) continue

		const tag = op.tags?.[0] ?? 'General'
		if (!tagGroups.has(tag)) tagGroups.set(tag, [])
		tagGroups.get(tag)!.push({ method, path: pathStr, op, pathParams })
	}
}

// Generate one markdown file per tag
let tagPosition = 1
for (const [tag, operations] of tagGroups) {
	const slug = tag.toLowerCase().replace(/\s+/g, '-')
	const lines: string[] = []

	lines.push('---')
	lines.push(`title: ${tag}`)
	lines.push(`sidebar_position: ${tagPosition++}`)
	lines.push(`description: REST API endpoints for ${tag}`)
	lines.push('---')
	lines.push('')
	lines.push(`# ${tag}`)
	lines.push('')

	for (const { method, path: apiPath, op, pathParams } of operations) {
		const verb = method.toUpperCase()
		lines.push(`## ${verb} \`${apiPath}\``)
		lines.push('')
		if (op.summary) lines.push(`**${op.summary}**`)
		if (op.description) {
			lines.push('')
			lines.push(op.description)
		}
		lines.push('')

		// Scope from security
		const scopes = op.security?.[0]?.['bearerAuth']
		if (scopes && scopes.length > 0) {
			lines.push(`**Required scope:** \`${scopes.join(', ')}\``)
			lines.push('')
		}

		// Path parameters
		const allParams = [...pathParams, ...(op.parameters ?? [])]
		if (allParams.length > 0) {
			lines.push('**Parameters:**')
			lines.push('')
			lines.push('| Parameter | In | Type | Description |')
			lines.push('|-----------|----|------|-------------|')
			for (const param of allParams) {
				lines.push(
					`| \`${param.name}\` | ${param.in} | \`${param.schema?.type ?? 'string'}\` | ${escapeTableCell(param.description ?? '')} |`
				)
			}
			lines.push('')
		}

		// Request body
		if (op.requestBody) {
			lines.push(renderRequestBody(op.requestBody as RequestBody))
			lines.push('')
		}

		lines.push(renderEndpointExample(method, apiPath, op, allParams))
		lines.push('')

		// Successful response
		if (op.responses) {
			const responseEntry = getDocumentedResponse(op.responses)
			if (responseEntry) {
				lines.push(renderResponse(responseEntry[0], responseEntry[1] as ResponseObject))
				lines.push('')
			}
		}

		lines.push('---')
		lines.push('')
	}

	fs.writeFileSync(path.join(OUT_DIR, `${slug}.md`), lines.join('\n'))
	console.log(`Generated: rest-api/${slug}.md (${operations.length} endpoints)`)
}

writeCategoryIndexDoc()
const staticDocCount = copyStaticMarkdownDocs()

console.log(`\nDone! Generated ${tagGroups.size + staticDocCount + 1} files in ${OUT_DIR}`)
