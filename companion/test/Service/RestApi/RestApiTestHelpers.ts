import express from 'express'
import type { Logger } from '../../../lib/Log/Controller.js'
import type { Registry } from '../../../lib/Registry.js'

/** The only member the REST API router uses from each Registry resource. */
type FakeRestApiResource = { createRestApiRouter: (logger: Logger) => express.Router }

/**
 * Build the fake Registry for REST API router tests. Every resource defaults to an empty router;
 * pass overrides for the resource(s) under test. Adding a new REST API resource means adding its
 * default here once, rather than editing every resource's test file.
 */
export function createTestRestApiResources(
	overrides: Partial<Record<'instance' | 'surfaces', FakeRestApiResource>>
): Registry {
	const emptyResource: FakeRestApiResource = { createRestApiRouter: () => express.Router() }
	return {
		instance: emptyResource,
		surfaces: emptyResource,
		...overrides,
	} as unknown as Registry
}
