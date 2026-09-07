import fs from 'fs'
import path from 'path'
import prettier from 'prettier'
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

// Feed prettier the expanded form: prettier's `objectWrap: 'preserve'` (the default) keys off the
// input's line breaks, so minified input would collapse short objects into a shape `yarn format`
// then re-expands. Indenting first keeps the output stable under `yarn format`.
const prettierConf = await prettier.resolveConfig(CONTRACT_PATH)
const formatted = await prettier.format(JSON.stringify(normalizedDocument, null, '\t'), {
	...prettierConf,
	parser: 'json',
})

fs.writeFileSync(CONTRACT_PATH, formatted)

console.log(`Wrote ${path.relative(process.cwd(), CONTRACT_PATH)}`)
