import { describe, expect, test } from 'vitest'
import { LinkPermissionStore } from '../../lib/Link/PermissionStore.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'

describe('LinkPermissionStore', () => {
	test('keeps what is shared across restarts, sharing nothing with an installation until told to', () => {
		const db = new FakeDataDatabase()
		const before = new LinkPermissionStore(db.asDataDatabase())
		expect(before.get('a')).toEqual({ buttons: false })

		before.set('a', { buttons: true })
		expect(before.get('a')).toEqual({ buttons: true })

		const after = new LinkPermissionStore(db.asDataDatabase())
		expect(after.get('a')).toEqual({ buttons: true })
	})

	test('forgets what is shared with an installation that is deleted, or not kept', () => {
		const db = new FakeDataDatabase()
		const store = new LinkPermissionStore(db.asDataDatabase())
		store.set('a', { buttons: true })
		store.set('b', { buttons: true })

		store.delete('a')
		store.retainOnly(new Set())
		expect(store.get('a')).toEqual({ buttons: false })
		expect(store.get('b')).toEqual({ buttons: false })
		expect(new LinkPermissionStore(db.asDataDatabase()).get('b')).toEqual({ buttons: false })
	})
})
