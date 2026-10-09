import { DatabaseSync } from 'node:sqlite'
import { describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type { DataDatabase } from '../../lib/Data/Database.js'
import { DataStoreTableView } from '../../lib/Data/StoreBase.js'
import type { GraphicsController } from '../../lib/Graphics/Controller.js'
import { ImageLibrary } from '../../lib/Graphics/ImageLibrary.js'
import LogController from '../../lib/Log/Controller.js'
import type { VariablesController } from '../../lib/Variables/Controller.js'

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const PREVIEW_BYTES = Buffer.from('RIFF....WEBP')

function createLibrary() {
	const logger = LogController.createLogger('test/image-library')
	const sqlite = new DatabaseSync(':memory:')
	const db = {
		getTableView: (tableName: string) =>
			new DataStoreTableView<any>(logger, sqlite, tableName, {
				onDirty: () => {},
				onOperation: () => {},
			}),
	} as unknown as DataDatabase

	const graphicsController = {
		executeCreatePreview: vi.fn(async () => ({
			width: 72,
			height: 72,
			previewDataUrl: `data:image/webp;base64,${PREVIEW_BYTES.toString('base64')}`,
		})),
	}
	const variablesController = mockDeep<VariablesController>()

	const imageLibrary = new ImageLibrary(db, graphicsController as unknown as GraphicsController, variablesController)

	return { imageLibrary, graphicsController, variablesController }
}

describe('ImageLibrary', () => {
	describe('setImageData', () => {
		test('stores the image as a data url and updates its info', async () => {
			const { imageLibrary, graphicsController } = createLibrary()
			imageLibrary.createEmptyImage('logo', 'Company logo')

			const info = await imageLibrary.setImageData('logo', 'image/png', PNG_BYTES)

			const expectedDataUrl = `data:image/png;base64,${PNG_BYTES.toString('base64')}`
			expect(graphicsController.executeCreatePreview).toHaveBeenCalledWith(expectedDataUrl)
			expect(info).toMatchObject({
				name: 'logo',
				mimeType: 'image/png',
				originalSize: PNG_BYTES.length,
				previewSize: PREVIEW_BYTES.length,
			})
			expect(info.checksum).toMatch(/^[0-9a-f]{40}$/)
			expect(imageLibrary.getImageInfo('logo')).toEqual(info)
			expect(imageLibrary.getImageDataUrl('logo', 'original')?.image).toBe(expectedDataUrl)
		})

		test('updates the image variable, so buttons using it redraw', async () => {
			const { imageLibrary, variablesController } = createLibrary()
			imageLibrary.createEmptyImage('logo', '')
			variablesController.values.setVariableValues.mockClear()

			await imageLibrary.setImageData('logo', 'image/png', PNG_BYTES)

			expect(variablesController.values.setVariableValues).toHaveBeenCalledWith('image', [
				{ id: 'logo', value: `data:image/png;base64,${PNG_BYTES.toString('base64')}` },
			])
		})

		test('changes the checksum when the data changes', async () => {
			const { imageLibrary } = createLibrary()
			imageLibrary.createEmptyImage('logo', '')

			const first = await imageLibrary.setImageData('logo', 'image/png', PNG_BYTES)
			const second = await imageLibrary.setImageData('logo', 'image/png', Buffer.concat([PNG_BYTES, PNG_BYTES]))

			expect(second.checksum).not.toBe(first.checksum)
		})

		test('rejects an unknown image', async () => {
			const { imageLibrary } = createLibrary()

			await expect(imageLibrary.setImageData('missing', 'image/png', PNG_BYTES)).rejects.toThrow('Image not found')
		})

		test('rejects an image the renderer cannot decode, leaving the image unchanged', async () => {
			const { imageLibrary, graphicsController } = createLibrary()
			imageLibrary.createEmptyImage('logo', '')
			graphicsController.executeCreatePreview.mockRejectedValueOnce(new Error('Unsupported image type'))

			await expect(imageLibrary.setImageData('logo', 'image/png', PNG_BYTES)).rejects.toThrow()

			expect(imageLibrary.getImageInfo('logo')).toMatchObject({ checksum: '', mimeType: '' })
		})
	})

	describe('getImageBinary', () => {
		test('round-trips the uploaded bytes', async () => {
			const { imageLibrary } = createLibrary()
			imageLibrary.createEmptyImage('logo', '')
			const info = await imageLibrary.setImageData('logo', 'image/png', PNG_BYTES)

			const original = imageLibrary.getImageBinary('logo', 'original')
			expect(original?.mimeType).toBe('image/png')
			expect(original?.checksum).toBe(info.checksum)
			expect(Buffer.compare(original!.data, PNG_BYTES)).toBe(0)

			const preview = imageLibrary.getImageBinary('logo', 'preview')
			expect(preview?.mimeType).toBe('image/webp')
			expect(preview?.checksum).toBe(info.checksum)
			expect(Buffer.compare(preview!.data, PREVIEW_BYTES)).toBe(0)
		})

		test('returns null for an image with no data', () => {
			const { imageLibrary } = createLibrary()
			imageLibrary.createEmptyImage('logo', '')

			expect(imageLibrary.getImageBinary('logo', 'original')).toBeNull()
		})

		test('returns null for an unknown image', () => {
			const { imageLibrary } = createLibrary()

			expect(imageLibrary.getImageBinary('missing', 'original')).toBeNull()
		})
	})
})
