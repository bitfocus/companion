import { DatabaseSync } from 'node:sqlite'
import express from 'express'
import type { ApiTokenScope } from '../../../../shared-lib/lib/Model/ApiKeys.js'
import { DataStoreTableView } from '../../../lib/Data/StoreBase.js'
import LogController, { type Logger } from '../../../lib/Log/Controller.js'
import type { Registry } from '../../../lib/Registry.js'
import { RestApiTokenStore } from '../../../lib/Service/RestApi/RestApiTokenStore.js'

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

/**
 * Build a real, in-memory API key store for tests, plus a `mint` helper that creates a key with the
 * given scopes and returns its plaintext token. Uses an on-disk-less SQLite database so the genuine
 * hashing/lookup path is exercised.
 */
export function createTestTokenStore(): {
	store: RestApiTokenStore
	mint: (scopes: ApiTokenScope[]) => string
} {
	const logger = LogController.createLogger('test/api-keys')
	const db = new DatabaseSync(':memory:')
	const table = new DataStoreTableView<any>(logger, db, 'api_keys', {
		onDirty: () => {},
		onOperation: () => {},
	})
	const store = new RestApiTokenStore(logger, table)

	let counter = 0
	return {
		store,
		mint: (scopes) => store.create(`test-${counter++}`, scopes).token,
	}
}
