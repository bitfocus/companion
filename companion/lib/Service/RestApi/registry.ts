import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

/**
 * Global OpenAPI registry that collects all route and schema definitions.
 * Each router module registers its paths here; the spec is generated from this at startup.
 */
export const registry = new OpenAPIRegistry()

// Register the Bearer token security scheme
registry.registerComponent('securitySchemes', 'bearerAuth', {
	type: 'http',
	scheme: 'bearer',
	description: 'API token.',
})
