import crypto from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ImageLibraryExportData, ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import type { VariableDefinition } from '@companion-app/shared/Model/Variables.js'
import { DataDatabase } from '../../lib/Data/Database.js'
import type { GraphicsController } from '../../lib/Graphics/Controller.js'
import { ImageLibrary } from '../../lib/Graphics/ImageLibrary.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import type { VariablesController } from '../../lib/Variables/Controller.js'
import type { VariableValueEntry } from '../../lib/Variables/Values.js'
import { createMockTrpcContext } from '../Util.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

const TABLE = 'image_library'
const COLLECTIONS_TABLE = 'image_library_collections'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const PREVIEW = 'data:image/png;base64,UFJFVklFVw=='

function info(name: string, overrides: Partial<ImageLibraryInfo> = {}): ImageLibraryInfo {
	return {
		name,
		description: `${name} description`,
		originalSize: 0,
		previewSize: 0,
		createdAt: 1,
		modifiedAt: 1,
		checksum: '',
		mimeType: '',
		sortOrder: 0,
		backgroundColor: 'rgba(0, 0, 0, 0)',
		...overrides,
	}
}

function row(name: string, overrides: Partial<ImageLibraryInfo> = {}, originalImage = '') {
	return { originalImage, previewImage: originalImage ? PREVIEW : '', info: info(name, overrides) }
}

const openDbs: DataDatabase[] = []

function createLibrary(rows: Record<string, unknown> = {}, collectionRows: Record<string, unknown> = {}) {
	const db = new DataDatabase(':memory:', () => {})
	openDbs.push(db)

	const table = db.getTableView<Record<string, any>>(TABLE)
	for (const [id, value] of Object.entries(rows)) table.set(id, value)
	const collectionsTable = db.getTableView<Record<string, any>>(COLLECTIONS_TABLE)
	for (const [id, value] of Object.entries(collectionRows)) collectionsTable.set(id, value)

	const graphics = {
		executeCreatePreview: vi.fn(async (_dataUrl: string) => ({ width: 10, height: 20, previewDataUrl: PREVIEW })),
	}
	const setVariableValues = vi.fn<(label: string, values: VariableValueEntry[]) => void>()
	const setVariableDefinitions = vi.fn<(label: string, definitions: VariableDefinition[]) => void>()
	const variables = { values: { setVariableValues }, definitions: { setVariableDefinitions } }

	const library = new ImageLibrary(
		db,
		graphics as unknown as GraphicsController,
		variables as unknown as VariablesController
	)
	const caller = t.createCallerFactory(library.createTrpcRouter())(testCtx)

	/** The current value of each image variable, from everything set so far */
	const variableValues = () => {
		const values = new Map<string, unknown>()
		for (const [label, entries] of setVariableValues.mock.calls) {
			expect(label).toBe('image')
			for (const entry of entries) values.set(entry.id, entry.value)
		}
		return Object.fromEntries([...values].filter(([, value]) => value !== undefined))
	}
	const variableDefinitions = () => setVariableDefinitions.mock.lastCall?.[1].map((d) => [d.name, d.description])

	return { db, table, collectionsTable, library, caller, graphics, variableValues, variableDefinitions }
}

async function upload(caller: any, imageName: string, dataUrl: string): Promise<string> {
	const data = Buffer.from(dataUrl, 'utf-8')
	const sessionId: string = await caller.upload.start({ name: 'image.png', size: data.length })
	await caller.upload.uploadChunk({ sessionId, offset: 0, data: data.toString('base64') })
	return caller.upload.complete({
		sessionId,
		expectedChecksum: crypto.createHash('sha1').update(data).digest('hex'),
		userData: { imageName },
	})
}

afterEach(() => {
	for (const db of openDbs.splice(0)) db.close()
})

describe('ImageLibrary', () => {
	describe('loading', () => {
		test('sets a variable and definition for each image', () => {
			const { variableValues, variableDefinitions } = createLibrary({
				logo: row('logo', {}, PNG),
				empty: row('empty', { description: '' }),
			})

			expect(variableValues()).toEqual({ logo: PNG, empty: '' })
			// An image without a description is described by its name
			expect(variableDefinitions()).toEqual([
				['logo', 'logo description'],
				['empty', 'empty'],
			])
		})

		test('moves images out of collections that no longer exist', () => {
			const { library, table } = createLibrary({ logo: row('logo', { collectionId: 'gone' }) })

			expect(library.getImageInfo('logo')?.collectionId).toBeUndefined()
			expect(table.get('logo').info.collectionId).toBeUndefined()
		})
	})

	describe('create', () => {
		test('creates an empty image', async () => {
			const { library, caller, table, variableValues, variableDefinitions } = createLibrary()

			expect(await caller.create({ name: 'logo', description: 'The logo' })).toBe('logo')

			expect(table.get('logo')).toEqual({
				originalImage: '',
				previewImage: '',
				info: {
					...info('logo', { description: 'The logo' }),
					createdAt: expect.any(Number),
					modifiedAt: expect.any(Number),
				},
			})
			expect(library.getImageInfo('logo')?.name).toBe('logo')
			expect(variableValues()).toEqual({ logo: '' })
			expect(variableDefinitions()).toEqual([['logo', 'The logo']])
		})

		test('makes the name safe', () => {
			const { library } = createLibrary()

			expect(library.createEmptyImage('my logo!', '')).toBe('my_logo_')
		})

		test('rejects a duplicate or invalid name', () => {
			const { library } = createLibrary({ logo: row('logo') })

			expect(() => library.createEmptyImage('logo', '')).toThrow('already exists')
			expect(() => library.createEmptyImage('', '')).toThrow('Invalid image name')
		})

		test('makeImageNameUnique numbers a name that is taken', () => {
			const { library } = createLibrary({ logo: row('logo'), logo_2: row('logo_2') })

			expect(library.makeImageNameUnique('fresh')).toBe('fresh')
			expect(library.makeImageNameUnique('logo')).toBe('logo_3')
		})
	})

	describe('upload', () => {
		test('stores the image and its preview', async () => {
			const { library, caller, graphics, table, variableValues } = createLibrary({ logo: row('logo') })

			expect(await upload(caller, 'logo', PNG)).toBe('logo')

			expect(graphics.executeCreatePreview).toHaveBeenCalledWith(PNG)
			expect(table.get('logo')).toMatchObject({ originalImage: PNG, previewImage: PREVIEW })
			expect(library.getImageInfo('logo')).toMatchObject({
				mimeType: 'image/png',
				originalSize: 8,
				previewSize: 7,
				checksum: crypto.createHash('sha1').update(PNG).digest('hex'),
			})
			expect(variableValues()).toEqual({ logo: PNG })
		})

		test('rejects something that is not an image data URL', async () => {
			const { caller, table } = createLibrary({ logo: row('logo') })

			await expect(upload(caller, 'logo', 'not an image')).rejects.toThrow('Invalid data URL')
			expect(table.get('logo').originalImage).toBe('')
		})

		test('rejects an unknown image', async () => {
			const { caller } = createLibrary()

			await expect(upload(caller, 'nope', PNG)).rejects.toThrow('Image not found')
		})
	})

	describe('reading', () => {
		test('getData returns the original or the preview, with the checksum', async () => {
			const { caller } = createLibrary({ logo: row('logo', { checksum: 'abc' }, PNG) })

			expect(await caller.getData({ imageName: 'logo', type: 'original' })).toEqual({ image: PNG, checksum: 'abc' })
			expect(await caller.getData({ imageName: 'logo', type: 'preview' })).toEqual({ image: PREVIEW, checksum: 'abc' })
			expect(await caller.getData({ imageName: 'nope', type: 'original' })).toBeNull()
		})

		test('listImages is newest first', () => {
			const { library } = createLibrary({
				old: row('old', { modifiedAt: 1 }),
				new: row('new', { modifiedAt: 3 }),
				mid: row('mid', { modifiedAt: 2 }),
			})

			expect(library.listImages().map((i) => i.name)).toEqual(['new', 'mid', 'old'])
		})

		test('getVariableDefinitions', () => {
			const { library } = createLibrary({ logo: row('logo') })

			expect(library.getVariableDefinitions()).toEqual([{ name: 'logo', description: 'logo description' }])
		})
	})

	describe('editing', () => {
		test('setDescription persists and updates the definitions', async () => {
			const { caller, table, variableDefinitions } = createLibrary({ logo: row('logo') })

			expect(await caller.setDescription({ imageName: 'logo', description: 'New' })).toBe(true)

			expect(table.get('logo').info.description).toBe('New')
			expect(table.get('logo').info.modifiedAt).toBeGreaterThan(1)
			expect(variableDefinitions()).toEqual([['logo', 'New']])
			expect(await caller.setDescription({ imageName: 'nope', description: '' })).toBe(false)
		})

		test('setBackgroundColor persists', async () => {
			const { caller, table } = createLibrary({ logo: row('logo') })

			expect(await caller.setBackgroundColor({ imageName: 'logo', backgroundColor: '#ff0000' })).toBe(true)

			expect(table.get('logo').info.backgroundColor).toBe('#ff0000')
			expect(await caller.setBackgroundColor({ imageName: 'nope', backgroundColor: '' })).toBe(false)
		})

		test('setName moves the image and its variable', async () => {
			const { library, caller, table, variableValues, variableDefinitions } = createLibrary({
				logo: row('logo', {}, PNG),
			})

			expect(await caller.setName({ imageName: 'logo', newName: 'brand mark' })).toBe('brand_mark')

			expect(table.get('logo')).toBeUndefined()
			expect(table.get('brand_mark')).toMatchObject({ originalImage: PNG, info: { name: 'brand_mark' } })
			expect(library.getImageInfo('logo')).toBeNull()
			expect(variableValues()).toEqual({ brand_mark: PNG })
			expect(variableDefinitions()).toEqual([['brand_mark', 'logo description']])
		})

		test('setName to the same name does nothing', () => {
			const { library, table } = createLibrary({ logo: row('logo') })

			expect(library.setImageName('logo', 'logo')).toBe('logo')
			expect(table.get('logo').info.modifiedAt).toBe(1)
		})

		test('setName rejects a taken, invalid or unknown name', () => {
			const { library } = createLibrary({ logo: row('logo'), other: row('other') })

			expect(() => library.setImageName('logo', 'other')).toThrow('already exists')
			expect(() => library.setImageName('logo', '')).toThrow('Invalid image name')
			expect(() => library.setImageName('nope', 'x')).toThrow('not found')
		})

		test('delete removes the image and its variable', async () => {
			const { caller, table, variableValues, variableDefinitions } = createLibrary({
				logo: row('logo', {}, PNG),
				keep: row('keep'),
			})

			expect(await caller.delete({ imageName: 'logo' })).toBe(true)

			expect(table.get('logo')).toBeUndefined()
			expect(variableValues()).toEqual({ keep: '' })
			expect(variableDefinitions()).toEqual([['keep', 'keep description']])
			expect(await caller.delete({ imageName: 'logo' })).toBe(false)
		})
	})

	describe('ordering and collections', () => {
		function createThree() {
			return createLibrary(
				{
					a: row('a', { sortOrder: 0 }),
					b: row('b', { sortOrder: 1 }),
					c: row('c', { sortOrder: 2 }),
				},
				{ col: { id: 'col', label: 'Collection', sortOrder: 0, children: [], metaData: null } }
			)
		}

		function rootOrder(library: ImageLibrary): string[] {
			return library
				.listImages()
				.filter((i) => !i.collectionId)
				.sort((x, y) => x.sortOrder - y.sortOrder)
				.map((i) => i.name)
		}

		test('reorders images, persisting the new orders', async () => {
			const { library, caller, table } = createThree()

			await caller.reorder({ collectionId: null, imageName: 'c', dropIndex: 0 })

			expect(rootOrder(library)).toEqual(['c', 'a', 'b'])
			expect(['a', 'b', 'c'].map((name) => table.get(name).info.sortOrder)).toEqual([1, 2, 0])
		})

		test('a negative drop index moves to the end', () => {
			const { library } = createThree()

			library.setImageOrder(null, 'a', -1)

			expect(rootOrder(library)).toEqual(['b', 'c', 'a'])
		})

		test('moves an image into a collection', () => {
			const { library, table } = createThree()

			library.setImageOrder('col', 'b', 0)

			expect(table.get('b').info).toMatchObject({ collectionId: 'col', sortOrder: 0 })
			expect(rootOrder(library)).toEqual(['a', 'c'])
		})

		test('ignores an unknown image or collection', () => {
			const { library } = createThree()

			library.setImageOrder(null, 'nope', 0)
			library.setImageOrder('nope', 'a', 0)

			expect(rootOrder(library)).toEqual(['a', 'b', 'c'])
		})

		test('removing a collection moves its images back to the root', async () => {
			const { library, caller, table } = createThree()
			library.setImageOrder('col', 'b', 0)

			await caller.collections.remove({ collectionId: 'col' })

			expect(table.get('b').info.collectionId).toBeUndefined()
		})
	})

	describe('import and reset', () => {
		function exported(name: string, overrides: Partial<ImageLibraryInfo> = {}): ImageLibraryExportData {
			return { info: info(name, overrides), originalImage: PNG, previewImage: PREVIEW }
		}

		test('import replaces the library', () => {
			const { library, table, variableValues } = createLibrary({ old: row('old', {}, PNG) })

			library.importImageLibrary(
				[{ id: 'col', label: 'Imported', sortOrder: 0, children: [], metaData: null }],
				[exported('logo', { collectionId: 'col' }), exported('loose')]
			)

			expect(Object.keys(table.all()).sort()).toEqual(['logo', 'loose'])
			expect(table.get('logo')).toMatchObject({ originalImage: PNG, info: { collectionId: 'col' } })
			expect(variableValues()).toEqual({ logo: PNG, loose: PNG })
		})

		test('import makes names safe and unique, and skips invalid ones', () => {
			const { library } = createLibrary()

			library.importImageLibrary([], [exported('my logo'), exported('my_logo'), exported('')])

			expect(
				library
					.listImages()
					.map((i) => i.name)
					.sort()
			).toEqual(['my_logo', 'my_logo_2'])
		})

		test('import moves images out of collections it does not include', () => {
			const { library } = createLibrary()

			library.importImageLibrary([], [exported('logo', { collectionId: 'missing' })])

			expect(library.getImageInfo('logo')?.collectionId).toBeUndefined()
		})

		test('reset removes every image and collection', async () => {
			const { library, caller, table, collectionsTable, variableValues } = createLibrary({
				logo: row('logo', {}, PNG),
			})
			await caller.collections.add({ collectionName: 'Col' })

			library.resetImageLibrary()

			expect(table.all()).toEqual({})
			expect(collectionsTable.all()).toEqual({})
			expect(variableValues()).toEqual({})
		})
	})

	test('watch streams the images then changes', async () => {
		const { library, caller } = createLibrary({ logo: row('logo') })

		const subscription = new SubscriptionTester(await caller.watch())
		await subscription.expectValue([{ type: 'init', images: [info('logo')] }])

		library.deleteImage('logo')
		await subscription.expectValue([{ type: 'remove', itemName: 'logo' }])

		await subscription.cleanup()
	})
})
