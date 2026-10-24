import { createHash } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { DataDatabase } from '../../../lib/Data/Database.js'
import { BROKEN_ROWS_TABLE } from '../../../lib/Data/SchemaTableView.js'
import type { DataStoreTableView } from '../../../lib/Data/TableView.js'
import LogController from '../../../lib/Log/Controller.js'
import { RestApiTokenStore } from '../../../lib/Service/RestApi/RestApiTokenStore.js'

function createStore() {
	const logger = LogController.createLogger('test/api-keys')
	const db = new DataDatabase(':memory:', () => {})
	const table = db.getTableView<Record<string, any>>('api_keys')
	return { store: new RestApiTokenStore(logger, db), table, db }
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

	describe('stored keys are validated', () => {
		test('a key saved without lastUsedAt still works', () => {
			const { store, table } = createStore()
			const { lastUsedAt: _lastUsedAt, ...withoutLastUsed } = storedKey('old', 'oldtoken')
			table.set('old', withoutLastUsed)

			expect(store.list()).toEqual([expect.objectContaining({ id: 'old', lastUsedAt: null })])
			expect(store.findByToken('oldtoken')).toMatchObject({ id: 'old', scopes: ['read'] })
		})

		test('a key with an unknown scope is never accepted, but is kept', () => {
			const { store, table } = createStore()
			table.set('odd', { ...storedKey('odd', 'oddtoken'), scopes: ['read', 'superuser'] })

			expect(store.findByToken('oddtoken')).toBeUndefined()
			expect(store.list()).toEqual([])
			expect(store.update('odd', { name: 'x', scopes: ['admin'] })).toBeUndefined()
			expect(store.delete('odd')).toBe(false)

			expect(table.get('odd')).toMatchObject({ scopes: ['read', 'superuser'] })
		})

		test('a key with a malformed hash is never accepted', () => {
			const { store, table } = createStore()
			table.set('odd', { ...storedKey('odd', 'oddtoken'), tokenHash: 'not-a-hash' })

			expect(store.list()).toEqual([])
		})

		test('a key missing its hash is moved to the broken rows table', () => {
			const { store, table, db } = createStore()
			const { tokenHash: _tokenHash, ...withoutHash } = storedKey('broken', 'brokentoken')
			table.set('broken', withoutHash)

			expect(store.list()).toEqual([])
			expect(table.get('broken')).toBeUndefined()
			expect(Object.values(db.getTableView<Record<string, any>>(BROKEN_ROWS_TABLE).all())).toEqual([
				expect.objectContaining({ table: 'api_keys', rowId: 'broken' }),
			])
		})

		test("another API's key is kept, even with scopes this API doesn't know", () => {
			const { store, table } = createStore()
			table.set('foreign', { ...storedKey('foreign', 'foreigntoken'), api: 'other-api', scopes: ['publish'] })

			expect(store.list()).toEqual([])
			expect(table.get('foreign')).toMatchObject({ api: 'other-api', scopes: ['publish'] })
		})
	})
})

/** A key as this store would have saved it, for the given plaintext token */
function storedKey(id: string, token: string) {
	return {
		id,
		name: id,
		api: 'rest-v2',
		scopes: ['read'],
		tokenHash: createHash('sha256').update(token).digest('hex'),
		tokenPrefix: 'cpn_xxxxxx',
		createdAt: 1,
		lastUsedAt: null,
	}
}

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
