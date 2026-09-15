import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, test } from 'vitest'
import { DataStoreTableView } from '../../../lib/Data/StoreBase.js'
import LogController from '../../../lib/Log/Controller.js'
import { RestApiTokenStore } from '../../../lib/Service/RestApi/RestApiTokenStore.js'

function createStore() {
	const logger = LogController.createLogger('test/api-keys')
	const db = new DatabaseSync(':memory:')
	const table = new DataStoreTableView<any>(logger, db, 'api_keys', {
		onDirty: () => {},
		onOperation: () => {},
	})
	return { store: new RestApiTokenStore(logger, table), table }
}

describe('RestApiTokenStore', () => {
	test('create returns a usable token and matching metadata', () => {
		const { store } = createStore()

		const { info, token } = store.create('CI deploy', ['read', 'write'])

		expect(token).toMatch(/^cpn_/)
		expect(info.name).toBe('CI deploy')
		expect(info.scopes).toEqual(['read', 'write'])
		expect(info.api).toBe('rest-v2')
		expect(token.startsWith(info.tokenPrefix)).toBe(true)
		expect(info.lastUsedAt).toBeNull()

		const identity = store.findByToken(token)
		expect(identity).toEqual({ id: info.id, name: 'CI deploy', scopes: ['read', 'write'] })
	})

	test('findByToken rejects unknown or empty tokens', () => {
		const { store } = createStore()
		store.create('key', ['read'])

		expect(store.findByToken('cpn_not_a_real_token')).toBeUndefined()
		expect(store.findByToken('')).toBeUndefined()
	})

	test('list exposes only metadata, oldest first, never the secret', () => {
		const { store } = createStore()
		const first = store.create('first', ['read'])
		const second = store.create('second', ['admin'])

		const list = store.list()
		expect(list.map((k) => k.name)).toEqual(['first', 'second'])
		// No secret material leaks through the public metadata
		for (const key of list) {
			expect(Object.keys(key)).not.toContain('tokenHash')
			expect(JSON.stringify(key)).not.toContain(first.token)
			expect(JSON.stringify(key)).not.toContain(second.token)
		}
	})

	test('update changes name and scopes but keeps the token working', () => {
		const { store } = createStore()
		const { info, token } = store.create('old name', ['read'])

		const updated = store.update(info.id, { name: 'new name', scopes: ['read', 'write'] })
		expect(updated).toMatchObject({ id: info.id, name: 'new name', scopes: ['read', 'write'] })

		// The same token still authenticates, now with the updated identity
		expect(store.findByToken(token)).toEqual({ id: info.id, name: 'new name', scopes: ['read', 'write'] })
	})

	test('update of an unknown key returns undefined', () => {
		const { store } = createStore()
		expect(store.update('nope', { name: 'x', scopes: ['read'] })).toBeUndefined()
	})

	test('delete revokes a key', () => {
		const { store } = createStore()
		const { info, token } = store.create('temp', ['read'])

		expect(store.delete(info.id)).toBe(true)
		expect(store.findByToken(token)).toBeUndefined()
		expect(store.list()).toHaveLength(0)
		// deleting again is a no-op
		expect(store.delete(info.id)).toBe(false)
	})

	test('findByToken records last use', () => {
		const { store } = createStore()
		const { token } = store.create('key', ['read'])

		expect(store.list()[0].lastUsedAt).toBeNull()
		store.findByToken(token)
		expect(store.list()[0].lastUsedAt).not.toBeNull()
	})

	test('a token minted for a different API audience is rejected', () => {
		const { store, table } = createStore()

		// Seed a record belonging to some other, future API surface
		seedForeignKey(table)

		expect(store.findByToken('foreigntoken')).toBeUndefined()
	})

	test('key management is scoped to this API - foreign keys are invisible and untouchable', () => {
		const { store, table } = createStore()

		const own = store.create('own', ['read'])
		seedForeignKey(table)

		// list only exposes keys minted for this API
		expect(store.list().map((k) => k.id)).toEqual([own.info.id])

		// a foreign key cannot be edited or revoked through this store
		expect(store.update('foreign', { name: 'hijack', scopes: ['admin'] })).toBeUndefined()
		expect(store.delete('foreign')).toBe(false)

		// and it remains untouched in the shared table
		expect(table.get('foreign')).toMatchObject({ name: 'foreign', scopes: ['read'] })
	})
})

/** Seed a record belonging to some other, future API surface into the shared `api_keys` table. */
function seedForeignKey(table: DataStoreTableView<any>): void {
	table.set('foreign', {
		id: 'foreign',
		name: 'foreign',
		api: 'other-api',
		scopes: ['read'],
		tokenHash: createHash('sha256').update('foreigntoken').digest('hex'),
		tokenPrefix: 'cpn_xxxxxx',
		createdAt: 1,
		lastUsedAt: null,
	})
}
