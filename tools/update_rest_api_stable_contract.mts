import fs from 'fs'
import path from 'path'
import { generateOpenApiDocument } from '../companion/lib/Service/RestApi/openapi.js'

const CONTRACT_PATH = path.resolve(
	import.meta.dirname,
	'../companion/test/Service/RestApi/contracts/openapi-stable.json'
)

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

function normalizeOpenApiDocument(document: ReturnType<typeof generateOpenApiDocument>): unknown {
	return sortJson({
		...document,
		info: {
			...document.info,
			version: '0.0.0-stable-contract',
		},
	})
}

fs.mkdirSync(path.dirname(CONTRACT_PATH), { recursive: true })

const document = generateOpenApiDocument({ appVersion: '0.0.0-stable-contract' })
const normalizedDocument = normalizeOpenApiDocument(document)

fs.writeFileSync(CONTRACT_PATH, `${JSON.stringify(normalizedDocument, null, '\t')}\n`)

console.log(`Wrote ${path.relative(process.cwd(), CONTRACT_PATH)}`)
