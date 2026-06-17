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

interface Parameter {
	name: string
	in: string
	required?: boolean
	schema?: { type?: string }
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

function schemaToTable(schema: SchemaObject, indent = 0): string {
	if (!schema.properties) return ''

	const rows: string[] = []
	if (indent === 0) {
		rows.push('| Field | Type | Required | Description |')
		rows.push('|-------|------|----------|-------------|')
	}

	const required = new Set(schema.required ?? [])

	for (const [name, prop] of Object.entries(schema.properties)) {
		let type = prop.type ?? 'object'
		if (prop.nullable) type += ' \\| null'
		if (prop.enum) type = prop.enum.map((v) => `\`${v}\``).join(' \\| ')
		if (type === 'array' && prop.items) {
			const itemType = prop.items.type ?? 'object'
			type = `${itemType}[]`
		}

		const prefix = indent > 0 ? '&nbsp;'.repeat(indent * 2) + '↳ ' : ''
		const req = required.has(name) ? 'Yes' : 'No'
		const desc = prop.description ?? ''
		rows.push(`| ${prefix}\`${name}\` | \`${type}\` | ${req} | ${desc} |`)

		if (prop.properties) {
			rows.push(schemaToTable(prop, indent + 1))
		}
	}

	return rows.join('\n')
}

function renderResponse(code: string, resp: ResponseObject): string {
	const lines: string[] = []
	lines.push(`**\`${code}\`** — ${resp.description ?? ''}`)

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
				lines.push(schemaToTable(dataSchema.items))
			} else if (dataSchema.properties) {
				lines.push('')
				lines.push('Response body:')
				lines.push('')
				lines.push(schemaToTable(dataSchema))
			}
		}
	}

	return lines.join('\n')
}

function renderRequestBody(body: RequestBody): string {
	const lines: string[] = []
	const jsonContent = body.content?.['application/json']
	if (jsonContent?.schema) {
		lines.push('**Request body** (`application/json`):')
		lines.push('')
		lines.push(schemaToTable(jsonContent.schema))
	}
	return lines.join('\n')
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
				type: 'generated-index',
				description:
					'Auto-generated documentation for the Companion REST API. Enable the REST API in settings and restart Companion to use these endpoints. Interactive docs are also available at /api/docs (Swagger UI) when the API is enabled.',
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
	lines.push(':::info Auto-generated')
	lines.push('This page is auto-generated from the OpenAPI specification. Do not edit manually.')
	lines.push(':::')
	lines.push('')
	lines.push('All endpoints require a **Bearer token** in the `Authorization` header.')
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
			lines.push('**Path parameters:**')
			lines.push('')
			lines.push('| Parameter | Type | Description |')
			lines.push('|-----------|------|-------------|')
			for (const param of allParams) {
				lines.push(`| \`${param.name}\` | \`${param.schema?.type ?? 'string'}\` | ${param.description ?? ''} |`)
			}
			lines.push('')
		}

		// Request body
		if (op.requestBody) {
			lines.push(renderRequestBody(op.requestBody as RequestBody))
			lines.push('')
		}

		// Responses
		if (op.responses) {
			lines.push('**Responses:**')
			lines.push('')
			for (const [code, resp] of Object.entries(op.responses)) {
				lines.push(renderResponse(code, resp as ResponseObject))
				lines.push('')
			}
		}

		lines.push('---')
		lines.push('')
	}

	fs.writeFileSync(path.join(OUT_DIR, `${slug}.md`), lines.join('\n'))
	console.log(`Generated: rest-api/${slug}.md (${operations.length} endpoints)`)
}

// Write an authentication overview page
const authLines: string[] = []
authLines.push('---')
authLines.push('title: Authentication')
authLines.push('sidebar_position: 0')
authLines.push('description: How to authenticate with the REST API')
authLines.push('---')
authLines.push('')
authLines.push('# Authentication')
authLines.push('')
authLines.push(':::info Auto-generated')
authLines.push('This page is auto-generated from the OpenAPI specification. Do not edit manually.')
authLines.push(':::')
authLines.push('')
authLines.push('The REST API uses **Bearer token** authentication. Include your token in every request:')
authLines.push('')
authLines.push('```')
authLines.push('Authorization: Bearer <token>')
authLines.push('```')
authLines.push('')
authLines.push('## Development Tokens')
authLines.push('')
authLines.push('Static tokens are available for development and testing:')
authLines.push('')
authLines.push('| Token | Scopes | Description |')
authLines.push('|-------|--------|-------------|')
authLines.push('| `cpn_read` | read | Read-only access |')
authLines.push('| `cpn_write` | read, write | Read and write access |')
authLines.push('| `cpn_execute` | read, execute | Read and execute access |')
authLines.push('| `cpn_admin` | admin (all) | Full admin access |')
authLines.push('')
authLines.push('## Scopes')
authLines.push('')
authLines.push('| Scope | Grants |')
authLines.push('|-------|--------|')
authLines.push('| `read` | Read resources (GET endpoints) |')
authLines.push('| `write` | Create, update, delete resources (implies `read`) |')
authLines.push('| `execute` | Trigger actions like restart (implies `read`) |')
authLines.push('| `admin` | Full access (implies all scopes) |')
authLines.push('')
authLines.push('## Enabling the REST API')
authLines.push('')
authLines.push('The REST API must be enabled in Companion settings (`rest_api_enabled`). **A restart is required** after changing this setting.')
authLines.push('')
authLines.push('When enabled, interactive documentation is available at `/api/docs` (Swagger UI).')
authLines.push('')

fs.writeFileSync(path.join(OUT_DIR, 'authentication.md'), authLines.join('\n'))
console.log('Generated: rest-api/authentication.md')

console.log(`\nDone! Generated ${tagGroups.size + 1} files in ${OUT_DIR}`)
