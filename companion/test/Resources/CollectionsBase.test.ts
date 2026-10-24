import { initTRPC } from '@trpc/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
	createCollectionSchema,
	EnabledCollectionDataSchema,
	type CollectionBase,
	type EnabledCollectionData,
} from '@companion-app/shared/Model/Collections.js'
import { DataDatabase } from '../../lib/Data/Database.js'
import { BROKEN_ROWS_TABLE } from '../../lib/Data/SchemaTableView.js'
import { EnabledCollectionsBaseController } from '../../lib/Resources/EnabledCollectionsBase.js'
import { router, type TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

const TABLE = 'test_collections'
const TestCollectionSchema = createCollectionSchema(EnabledCollectionDataSchema)

type TestCollection = CollectionBase<EnabledCollectionData>

/** Exposes the protected operations, and records what the base asks of its subclass */
class TestCollections extends EnabledCollectionsBaseController<EnabledCollectionData> {
	readonly removeUnknownCalls = vi.fn()
	readonly emitUpdateUserCalls = vi.fn()

	constructor(db: DataDatabase) {
		super(db.getSchemaTableView(TABLE, TestCollectionSchema))
	}

	override removeUnknownCollectionReferences(): void {
		this.removeUnknownCalls(this.collectAllCollectionIds())
	}

	override emitUpdateUser(rows: TestCollection[]): void {
		this.emitUpdateUserCalls(rows)
	}

	create(label: string, enabled: boolean): string {
		return this.collectionCreate(label, { enabled })
	}
	remove(collectionId: string): void {
		this.collectionRemove(collectionId)
	}
	setName(collectionId: string, name: string): void {
		this.collectionSetName(collectionId, name)
	}
	move(collectionId: string, parentId: string | null, dropIndex: number): void {
		this.collectionMove(collectionId, parentId, dropIndex)
	}

	createTrpcRouter() {
		return router(this.createTrpcRouterBase())
	}
}

function collection(id: string, sortOrder: number, children: TestCollection[] = [], enabled = true): TestCollection {
	return { id, label: id, sortOrder, children, metaData: { enabled } }
}

/** The tree as nested ids, in order */
function shape(collections: TestCollection[]): unknown[] {
	return collections.map((c) => (c.children.length ? { [c.id]: shape(c.children) } : c.id))
}

const openDbs: DataDatabase[] = []

function createCollections(rows: Record<string, unknown> = {}) {
	const db = new DataDatabase(':memory:', () => {})
	openDbs.push(db)

	const table = db.getTableView<Record<string, any>>(TABLE)
	for (const [id, row] of Object.entries(rows)) table.set(id, row)

	const collections = new TestCollections(db)
	const caller = t.createCallerFactory(collections.createTrpcRouter())(testCtx)

	/** What a restart would load */
	const reload = () => new TestCollections(db).collectionData

	return { db, table, collections, caller, reload }
}

/**
 * root: a (b, c (d)), e
 */
function createTree() {
	return createCollections({
		a: collection('a', 0, [collection('b', 0), collection('c', 1, [collection('d', 0)])]),
		e: collection('e', 1),
	})
}

afterEach(() => {
	for (const db of openDbs.splice(0)) db.close()
})

describe('CollectionsBaseController', () => {
	describe('loading', () => {
		test('sorts every level by sortOrder', () => {
			const { collections } = createCollections({
				late: collection('late', 2),
				early: collection('early', 0, [collection('second', 1), collection('first', 0)]),
				middle: collection('middle', 1),
			})

			expect(shape(collections.collectionData)).toEqual([{ early: ['first', 'second'] }, 'middle', 'late'])
		})

		test('fills in defaults for old rows', () => {
			const { collections } = createCollections({
				old: { id: 'old', children: [{ id: 'child' }] },
			})

			expect(collections.collectionData).toEqual([
				{
					id: 'old',
					label: '',
					sortOrder: 0,
					metaData: { enabled: true },
					children: [{ id: 'child', label: '', sortOrder: 0, metaData: { enabled: true }, children: [] }],
				},
			])
		})

		test('moves an invalid row to the broken rows table', () => {
			const { db, collections } = createCollections({
				good: collection('good', 0),
				bad: { id: 'bad', children: 'none' },
			})

			expect(shape(collections.collectionData)).toEqual(['good'])
			const broken = Object.values(db.getTableView<Record<string, any>>(BROKEN_ROWS_TABLE).all())
			expect(broken).toEqual([expect.objectContaining({ table: TABLE, rowId: 'bad' })])
		})
	})

	describe('lookups', () => {
		test('collectAllCollectionIds includes every level', () => {
			const { collections } = createTree()

			expect(collections.collectAllCollectionIds()).toEqual(new Set(['a', 'b', 'c', 'd', 'e']))
		})

		test('doesCollectionIdExist', () => {
			const { collections } = createTree()

			expect(collections.doesCollectionIdExist('d')).toBe(true)
			expect(collections.doesCollectionIdExist('nope')).toBe(false)
			// No collection means the root, which always exists
			expect(collections.doesCollectionIdExist(null)).toBe(true)
			expect(collections.doesCollectionIdExist(undefined)).toBe(true)
		})

		test('collectionData is a copy of the root list', () => {
			const { collections } = createTree()

			collections.collectionData.pop()

			expect(shape(collections.collectionData)).toEqual([{ a: ['b', { c: ['d'] }] }, 'e'])
		})
	})

	describe('create', () => {
		test('appends a persisted collection after the last one', () => {
			const { collections, table, reload } = createTree()

			const id = collections.create('New', false)

			const created = collections.collectionData.at(-1)
			expect(created).toEqual({ id, label: 'New', sortOrder: 2, children: [], metaData: { enabled: false } })
			expect(table.get(id)).toEqual(created)
			expect(reload()).toEqual(collections.collectionData)
		})

		test('the first collection has sortOrder 0', () => {
			const { collections } = createCollections()

			collections.create('First', true)

			expect(collections.collectionData[0].sortOrder).toBe(0)
		})

		test('notifies the subclass', () => {
			const { collections } = createCollections()

			collections.create('First', true)

			expect(collections.emitUpdateUserCalls).toHaveBeenCalledWith(collections.collectionData)
		})
	})

	describe('remove', () => {
		test('removes a root collection, rehoming its children in its place', () => {
			const { collections, table, reload } = createTree()

			collections.remove('a')

			expect(shape(collections.collectionData)).toEqual(['b', { c: ['d'] }, 'e'])
			expect(collections.collectionData.map((c) => c.sortOrder)).toEqual([0, 1, 2])
			expect(table.get('a')).toBeUndefined()
			expect(reload()).toEqual(collections.collectionData)
		})

		test('removes a root collection without children, persisting the new order', () => {
			const { collections, reload } = createCollections({
				x: collection('x', 0),
				y: collection('y', 1),
				z: collection('z', 2),
			})

			collections.remove('x')
			collections.create('New', true)

			expect(shape(collections.collectionData)).toEqual(['y', 'z', expect.any(String)])
			expect(reload()).toEqual(collections.collectionData)
		})

		test('removes a nested collection, rehoming its children into its parent', () => {
			const { collections, reload } = createTree()

			collections.remove('c')

			expect(shape(collections.collectionData)).toEqual([{ a: ['b', 'd'] }, 'e'])
			expect(collections.collectionData[0].children.map((c) => c.sortOrder)).toEqual([0, 1])
			expect(reload()).toEqual(collections.collectionData)
		})

		test('asks the subclass to clean up references to it', () => {
			const { collections } = createTree()

			collections.remove('c')

			expect(collections.removeUnknownCalls).toHaveBeenCalledWith(new Set(['a', 'b', 'd', 'e']))
		})

		test('ignores an unknown id', () => {
			const { collections } = createTree()

			collections.remove('nope')

			expect(shape(collections.collectionData)).toEqual([{ a: ['b', { c: ['d'] }] }, 'e'])
			expect(collections.removeUnknownCalls).not.toHaveBeenCalled()
		})
	})

	describe('setName', () => {
		test('renames a nested collection', () => {
			const { collections, reload } = createTree()

			collections.setName('d', 'Renamed')

			expect(collections.collectionData[0].children[1].children[0].label).toBe('Renamed')
			expect(reload()).toEqual(collections.collectionData)
		})

		test('fails for an unknown id', () => {
			const { collections } = createTree()

			expect(() => collections.setName('nope', 'x')).toThrow('Collection nope not found')
		})
	})

	describe('move', () => {
		test('reorders at the root', () => {
			const { collections, reload } = createTree()

			collections.move('e', null, 0)

			expect(shape(collections.collectionData)).toEqual(['e', { a: ['b', { c: ['d'] }] }])
			expect(collections.collectionData.map((c) => c.sortOrder)).toEqual([0, 1])
			expect(reload()).toEqual(collections.collectionData)
		})

		test('moves a root collection into another', () => {
			const { collections, table, reload } = createTree()

			collections.move('e', 'c', 0)

			expect(shape(collections.collectionData)).toEqual([{ a: ['b', { c: ['e', 'd'] }] }])
			// It is stored as part of its new root, not as a row of its own
			expect(Object.keys(table.all())).toEqual(['a'])
			expect(reload()).toEqual(collections.collectionData)
		})

		test('moves a nested collection to the root', () => {
			const { collections, reload } = createTree()

			collections.move('d', null, 1)

			expect(shape(collections.collectionData)).toEqual([{ a: ['b', 'c'] }, 'd', 'e'])
			expect(reload()).toEqual(collections.collectionData)
		})

		test('moves a nested collection between parents', () => {
			const { collections, reload } = createTree()

			collections.move('b', 'e', 0)

			expect(shape(collections.collectionData)).toEqual([{ a: [{ c: ['d'] }] }, { e: ['b'] }])
			expect(reload()).toEqual(collections.collectionData)
		})

		test('cannot move a collection into itself or its own descendant', () => {
			const { collections } = createTree()

			collections.move('a', 'a', 0)
			collections.move('a', 'd', 0)

			expect(shape(collections.collectionData)).toEqual([{ a: ['b', { c: ['d'] }] }, 'e'])
		})

		test('fails for an unknown collection or parent', () => {
			const { collections } = createTree()

			expect(() => collections.move('nope', null, 0)).toThrow('Collection nope not found')
			expect(() => collections.move('e', 'nope', 0)).toThrow('Parent collection nope not found')
		})
	})

	describe('replaceCollections', () => {
		test('replaces everything, normalising the new collections', () => {
			const { collections, table, reload } = createTree()

			collections.replaceCollections([
				{ id: 'late', sortOrder: 1 },
				{ id: 'early', sortOrder: 0, children: [{ id: 'second', sortOrder: 1 }, { id: 'first' }] },
			] as any)

			expect(shape(collections.collectionData)).toEqual([{ early: ['first', 'second'] }, 'late'])
			expect(collections.collectionData[1]).toEqual({
				id: 'late',
				label: '',
				sortOrder: 1,
				children: [],
				metaData: { enabled: true },
			})
			expect(Object.keys(table.all()).sort()).toEqual(['early', 'late'])
			expect(reload()).toEqual(collections.collectionData)
		})

		test('skips an invalid collection', () => {
			const { collections } = createCollections()

			collections.replaceCollections([{ id: 'bad', label: 5 }, collection('good', 0)] as any)

			expect(shape(collections.collectionData)).toEqual(['good'])
		})

		test('merging keeps the existing collections with the same id', () => {
			const { collections } = createTree()

			collections.replaceCollections([{ ...collection('e', 5), label: 'Imported' }, collection('new', 2)], true)

			expect(shape(collections.collectionData)).toEqual([{ a: ['b', { c: ['d'] }] }, 'e', 'new'])
			expect(collections.collectionData[1].label).toBe('e')
		})

		test('merging skips a collection whose id is already nested', () => {
			const { collections } = createTree()

			collections.replaceCollections([collection('d', 2)], true)

			expect(shape(collections.collectionData)).toEqual([{ a: ['b', { c: ['d'] }] }, 'e'])
		})

		test('asks the subclass to clean up references', () => {
			const { collections } = createTree()

			collections.replaceCollections([collection('only', 0)])

			expect(collections.removeUnknownCalls).toHaveBeenCalledWith(new Set(['only']))
		})
	})

	test('discardAllCollections removes everything', () => {
		const { collections, table } = createTree()

		collections.discardAllCollections()

		expect(collections.collectionData).toEqual([])
		expect(table.all()).toEqual({})
		expect(collections.removeUnknownCalls).toHaveBeenCalledWith(new Set())
	})

	describe('trpc', () => {
		test('watchQuery streams the initial tree then changes', async () => {
			const { collections, caller } = createTree()

			const subscription = new SubscriptionTester(await caller.watchQuery())
			expect(shape(await subscription.next())).toEqual([{ a: ['b', { c: ['d'] }] }, 'e'])

			collections.remove('e')
			expect(shape(await subscription.next())).toEqual([{ a: ['b', { c: ['d'] }] }])

			await subscription.cleanup()
		})

		test('remove, setName and reorder', async () => {
			const { collections, caller } = createTree()

			await caller.setName({ collectionId: 'e', collectionName: 'Renamed' })
			await caller.reorder({ collectionId: 'e', parentId: 'a', dropIndex: 0 })
			await caller.remove({ collectionId: 'b' })

			expect(shape(collections.collectionData)).toEqual([{ a: ['e', { c: ['d'] }] }])
			expect(collections.collectionData[0].children[0].label).toBe('Renamed')
		})

		test('setEnabled', async () => {
			const { collections, caller } = createTree()

			await caller.setEnabled({ collectionId: 'c', enabled: false })

			expect(collections.isCollectionEnabled('c')).toBe(false)
		})
	})
})

describe('EnabledCollectionsBaseController', () => {
	/**
	 * root: on (off (under-off)), top-off
	 */
	function createEnabledTree() {
		return createCollections({
			on: collection('on', 0, [collection('off', 0, [collection('under-off', 0)], false)]),
			'top-off': collection('top-off', 1, [], false),
		})
	}

	test('a collection is enabled only if it and all its parents are', () => {
		const { collections } = createEnabledTree()

		expect(collections.enabledCollectionIds).toEqual(new Set(['on']))
		expect(collections.isCollectionEnabled('on')).toBe(true)
		expect(collections.isCollectionEnabled('off')).toBe(false)
		expect(collections.isCollectionEnabled('under-off')).toBe(false)
		expect(collections.isCollectionEnabled('top-off')).toBe(false)
	})

	test('onlyDirect ignores the parents', () => {
		const { collections } = createEnabledTree()

		expect(collections.isCollectionEnabled('under-off', true)).toBe(true)
		expect(collections.isCollectionEnabled('off', true)).toBe(false)
		expect(collections.isCollectionEnabled('nope', true)).toBe(false)
	})

	test('no collection is enabled, an unknown one is not', () => {
		const { collections } = createEnabledTree()

		expect(collections.isCollectionEnabled(null)).toBe(true)
		expect(collections.isCollectionEnabled(undefined)).toBe(true)
		expect(collections.isCollectionEnabled('nope')).toBe(false)
	})

	test('setCollectionEnabled updates the enabled set and persists', () => {
		const { collections, reload } = createEnabledTree()

		collections.setCollectionEnabled('off', true)
		expect(collections.enabledCollectionIds).toEqual(new Set(['on', 'off', 'under-off']))

		collections.setCollectionEnabled('on', 'toggle')
		expect(collections.enabledCollectionIds).toEqual(new Set())

		collections.setCollectionEnabled('on', 'toggle')
		expect(collections.enabledCollectionIds).toEqual(new Set(['on', 'off', 'under-off']))

		expect(reload()).toEqual(collections.collectionData)
	})

	test('the enabled set follows moves and removals', () => {
		const { collections } = createEnabledTree()

		// Out from under the disabled parent
		collections.move('under-off', null, 0)
		expect(collections.enabledCollectionIds).toEqual(new Set(['under-off', 'on']))

		collections.remove('on')
		expect(collections.enabledCollectionIds).toEqual(new Set(['under-off']))
	})

	test('setCollectionEnabled fails for an unknown id', () => {
		const { collections } = createEnabledTree()

		expect(() => collections.setCollectionEnabled('nope', true)).toThrow('Collection nope not found')
	})
})
