import { createRequire } from 'module'
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import { registry } from './registry.js'
import { registerConnectionPaths } from './routes/ConnectionsRouter.js'

const require = createRequire(import.meta.url)
const { version } = require('../../../package.json') as { version: string }

/**
 * Generate the OpenAPI 3.0 JSON document from the registry.
 * All route modules register their paths before this is called.
 */
export function generateOpenApiDocument(): ReturnType<OpenApiGeneratorV3['generateDocument']> {
	// Register all route paths into the registry
	registerConnectionPaths()

	const generator = new OpenApiGeneratorV3(registry.definitions)

	return generator.generateDocument({
		openapi: '3.0.3',
		info: {
			title: 'Bitfocus Companion REST API',
			version,
			description: 'REST API for programmatic configuration management of Bitfocus Companion.',
		},
		servers: [{ url: '/api', description: 'REST API (resources versioned independently)' }],
		security: [{ bearerAuth: [] }],
	})
}
