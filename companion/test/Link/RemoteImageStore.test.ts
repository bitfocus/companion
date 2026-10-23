import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { LinkRemoteImageStore, type LinkButtonImage } from '../../lib/Link/RemoteImageStore.js'

const square = { width: 144, height: 144 }
const wide = { width: 288, height: 144 }

function image(size: { width: number; height: number }, current = true): LinkButtonImage {
	return {
		...size,
		dataUrl: `data:image/png;base64,${size.width}x${size.height}`,
		revision: { stream: 's', seq: 1 },
		current,
	}
}

describe('LinkRemoteImageStore', () => {
	let store: LinkRemoteImageStore
	beforeEach(() => {
		vi.useFakeTimers()
		store = new LinkRemoteImageStore()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	test('a draw waiting for a shape gets nothing more to wait for once its button is gone', async () => {
		store.setImages('remote', [image(square)])
		store.expectShape('remote', wide, Date.now() + 1000)

		const waiting = store.getImage('remote', { width: 200, height: 100 })
		store.delete('remote')
		await expect(waiting).resolves.toBeNull()
	})

	test('a shape that is refused is drawn from the closest shape straight away', async () => {
		store.setImages('remote', [image(square)])
		store.expectShape('remote', wide, Date.now() + 1000)

		const waiting = store.getImage('remote', { width: 200, height: 100 })
		store.shapeArrived('remote', wide, null)
		await expect(waiting).resolves.toMatchObject({ dataUrl: 'data:image/png;base64,144x144' })
	})

	test('an older image is drawn only when there is no current one', async () => {
		store.setImages('remote', [image(square), image(wide, false)])
		await expect(store.getImage('remote', { width: 200, height: 100 })).resolves.toMatchObject({
			dataUrl: 'data:image/png;base64,144x144',
		})

		store.setImages('remote', [image(wide, false)])
		await expect(store.getImage('remote', { width: 200, height: 100 })).resolves.toMatchObject({
			dataUrl: 'data:image/png;base64,288x144',
		})
	})
})
