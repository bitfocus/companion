import { initTRPC } from '@trpc/server'
import { afterEach, describe, expect, test, vi, type Mock } from 'vitest'
import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { ExpressionVariableCollections } from '../../lib/Controls/ExpressionVariableCollections.js'
import { TriggerCollections } from '../../lib/Controls/TriggerCollections.js'
import { TriggerEvents } from '../../lib/Controls/TriggerEvents.js'
import { DataDatabase } from '../../lib/Data/Database.js'
import { ImageLibraryCollections } from '../../lib/Graphics/ImageLibraryCollections.js'
import type { InstanceConfigStore } from '../../lib/Instance/ConfigStore.js'
import { ConnectionsCollections } from '../../lib/Instance/Connection/Collections.js'
import { SurfaceInstanceCollections } from '../../lib/Instance/Surface/Collections.js'
import type { CollectionsBaseController } from '../../lib/Resources/CollectionsBase.js'
import { OutboundSurfaceCollections } from '../../lib/Surface/OutboundCollections.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { CustomVariableCollections } from '../../lib/Variables/CustomVariableCollections.js'
import { createMockTrpcContext } from '../Util.js'

// The behaviour shared by every collection implementation is covered in CollectionsBase.test.ts. This covers
// what each implementation decides for itself: its table, the metadata of a new collection, and what it calls
// back into its owner.

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

interface Owner {
	/** Called with the valid collection ids when references to removed collections should be cleaned up */
	cleanup: Mock<(validCollectionIds: ReadonlySet<string>, moduleType: ModuleInstanceType | null) => void>
	/** Called when the collections change, with the enabled collections where the owner is given them */
	notify: Mock<(enabledCollectionIds?: ReadonlySet<string>) => void>
	triggerEvents: TriggerEvents | null
}

interface CollectionsUnderTest {
	collections: CollectionsBaseController<any> & {
		isCollectionEnabled?: (collectionId: string | null | undefined) => boolean
	}
	caller: any
}

interface ImplementationCase {
	name: string
	table: string
	newMetaData: unknown
	/** The module type passed to the config store's cleanup, for implementations that clean up through it */
	cleanupType: ModuleInstanceType | null
	notifies: boolean
	create: (db: DataDatabase, owner: Owner) => CollectionsUnderTest
}

function withCaller(collections: CollectionsBaseController<any> & { createTrpcRouter(): any }): CollectionsUnderTest {
	return { collections, caller: t.createCallerFactory(collections.createTrpcRouter())(testCtx) }
}

function configStoreFor(owner: Owner): InstanceConfigStore {
	const configStore: Pick<InstanceConfigStore, 'cleanUnknownCollectionIds'> = {
		cleanUnknownCollectionIds: (moduleType, validCollectionIds) => owner.cleanup(validCollectionIds, moduleType),
	}
	return configStore as InstanceConfigStore
}

const IMPLEMENTATIONS: ImplementationCase[] = [
	{
		name: 'TriggerCollections',
		table: 'trigger_collections',
		newMetaData: { enabled: true },
		cleanupType: null,
		notifies: true,
		create: (db, owner) => {
			owner.triggerEvents = new TriggerEvents()
			return withCaller(
				new TriggerCollections(
					db,
					owner.triggerEvents,
					(ids) => owner.cleanup(ids, null),
					(enabledIds) => owner.notify(enabledIds)
				)
			)
		},
	},
	{
		name: 'ConnectionsCollections',
		table: 'connection_collections',
		newMetaData: { enabled: true },
		cleanupType: ModuleInstanceType.Connection,
		notifies: true,
		create: (db, owner) => withCaller(new ConnectionsCollections(db, configStoreFor(owner), () => owner.notify())),
	},
	{
		name: 'SurfaceInstanceCollections',
		table: 'surface_instance_collections',
		newMetaData: { enabled: true },
		cleanupType: ModuleInstanceType.Surface,
		notifies: true,
		create: (db, owner) => withCaller(new SurfaceInstanceCollections(db, configStoreFor(owner), () => owner.notify())),
	},
	{
		name: 'OutboundSurfaceCollections',
		table: 'surfaces_remote_collections',
		newMetaData: { enabled: true },
		cleanupType: null,
		notifies: true,
		create: (db, owner) =>
			withCaller(
				new OutboundSurfaceCollections(
					db,
					(ids) => owner.cleanup(ids, null),
					() => owner.notify()
				)
			),
	},
	{
		name: 'CustomVariableCollections',
		table: 'custom_variable_collections',
		newMetaData: null,
		cleanupType: null,
		notifies: false,
		create: (db, owner) => withCaller(new CustomVariableCollections(db, (ids) => owner.cleanup(ids, null))),
	},
	{
		name: 'ExpressionVariableCollections',
		table: 'expressionVariableCollections',
		newMetaData: null,
		cleanupType: null,
		notifies: false,
		create: (db, owner) => withCaller(new ExpressionVariableCollections(db, (ids) => owner.cleanup(ids, null))),
	},
	{
		name: 'ImageLibraryCollections',
		table: 'image_library_collections',
		newMetaData: null,
		cleanupType: null,
		notifies: false,
		create: (db, owner) => withCaller(new ImageLibraryCollections(db, (ids) => owner.cleanup(ids, null))),
	},
]

const openDbs: DataDatabase[] = []
const openOwners: Owner[] = []

function setup(implementation: ImplementationCase) {
	const db = new DataDatabase(':memory:', () => {})
	openDbs.push(db)

	const owner: Owner = { cleanup: vi.fn(), notify: vi.fn(), triggerEvents: null }
	openOwners.push(owner)

	const { collections, caller } = implementation.create(db, owner)

	/** What a restart would load */
	const reload = () => implementation.create(db, owner).collections.collectionData

	return { db, owner, collections, caller, reload }
}

afterEach(() => {
	for (const owner of openOwners.splice(0)) owner.triggerEvents?.destroy()
	for (const db of openDbs.splice(0)) db.close()
})

describe.each(IMPLEMENTATIONS)('$name', (implementation) => {
	test('add creates a collection in its own table', async () => {
		const { db, collections, caller, reload } = setup(implementation)

		const id: string = await caller.add({ collectionName: 'New' })

		const created: CollectionBase<unknown> = {
			id,
			label: 'New',
			sortOrder: 0,
			children: [],
			metaData: implementation.newMetaData,
		}
		expect(collections.collectionData).toEqual([created])
		expect(db.getTableView(implementation.table).all()).toEqual({ [id]: created })
		expect(reload()).toEqual([created])
	})

	test('removing a collection asks the owner to clean up references to it', async () => {
		const { owner, caller } = setup(implementation)
		const keep: string = await caller.add({ collectionName: 'Keep' })
		const remove: string = await caller.add({ collectionName: 'Remove' })

		await caller.remove({ collectionId: remove })

		expect(owner.cleanup).toHaveBeenLastCalledWith(new Set([keep]), implementation.cleanupType)
	})

	test.runIf(implementation.notifies)('a change notifies the owner', async () => {
		const { owner, caller } = setup(implementation)

		await caller.add({ collectionName: 'New' })

		expect(owner.notify).toHaveBeenCalledTimes(1)
	})

	test.runIf(implementation.newMetaData !== null)('a child of a disabled collection is disabled', async () => {
		const { collections, caller } = setup(implementation)
		const parent: string = await caller.add({ collectionName: 'Parent' })
		const child: string = await caller.add({ collectionName: 'Child' })
		await caller.reorder({ collectionId: child, parentId: parent, dropIndex: 0 })

		await caller.setEnabled({ collectionId: parent, enabled: false })

		expect(collections.isCollectionEnabled?.(parent)).toBe(false)
		expect(collections.isCollectionEnabled?.(child)).toBe(false)

		await caller.setEnabled({ collectionId: parent, enabled: true })

		expect(collections.isCollectionEnabled?.(child)).toBe(true)
	})
})

describe('TriggerCollections', () => {
	test('a change announces the enabled collections, and rechecks the triggers with them', async () => {
		const { owner, collections, caller } = setup(IMPLEMENTATIONS[0])
		const announced = vi.fn()
		owner.triggerEvents!.on('trigger_collections_enabled', announced)

		const id: string = await caller.add({ collectionName: 'New' })
		await caller.setEnabled({ collectionId: id, enabled: false })

		expect(announced).toHaveBeenCalledTimes(2)
		expect(owner.notify).toHaveBeenLastCalledWith(new Set())
		expect(collections.collectionData[0].metaData).toEqual({ enabled: false })
	})
})
