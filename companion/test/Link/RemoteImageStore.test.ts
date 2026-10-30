import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { LinkRemoteImageStore, type LinkButtonImage } from '../../lib/Link/RemoteImageStore.js'

const square = { width: 72, height: 72 }
const wide = { width: 200, height: 100 }

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

	test('says which images it no longer holds, so that their decoded forms can be dropped', async () => {
		const released = vi.fn()
		store.onReleased(released)
		store.setImages('remote', [image(square), image(wide)])
		expect(released).not.toHaveBeenCalled()

		// A newer revision at the same size is the same slot, so isn't let go of
		store.setImages('remote', [{ ...image(square), revision: { stream: 's', seq: 2 } }, image(wide)])
		expect(released).not.toHaveBeenCalled()

		store.setImages('remote', [image(square)])
		expect(released).toHaveBeenLastCalledWith(['remote@200x100'])
		store.delete('remote')
		expect(released).toHaveBeenLastCalledWith(['remote@72x72'])

		// The slots it gives are the ones it is drawn from
		store.setImages('other', [image(square)])
		await expect(store.getImage('other', square, false)).resolves.toMatchObject({ slot: 'other@72x72' })
	})

	test('a draw waiting for a shape gets nothing more to wait for once its button is gone', async () => {
		store.setImages('remote', [image(square)])
		store.expectShape('remote', wide, Date.now() + 1000)

		const waiting = store.getImage('remote', { width: 200, height: 100 }, true)
		store.delete('remote')
		await expect(waiting).resolves.toBeNull()
	})

	test('a shape that is refused is drawn from the closest shape straight away', async () => {
		store.setImages('remote', [image(square)])
		store.expectShape('remote', wide, Date.now() + 1000)

		const waiting = store.getImage('remote', { width: 200, height: 100 }, true)
		store.shapeArrived('remote', wide, null)
		await expect(waiting).resolves.toMatchObject({ dataUrl: 'data:image/png;base64,72x72' })
	})

	test('does not wait for a shape when told not to, eg when serving onwards', async () => {
		store.setImages('remote', [image(square)])
		store.expectShape('remote', wide, Date.now() + 1000)

		await expect(store.getImage('remote', { width: 200, height: 100 }, false)).resolves.toMatchObject({
			dataUrl: 'data:image/png;base64,72x72',
		})
	})

	test('a shape subscribed to again, after the first wait gave up, is waited for again', async () => {
		store.setImages('remote', [image(square)])
		store.expectShape('remote', wide, Date.now() + 100)
		await vi.advanceTimersByTimeAsync(200)

		store.expectShape('remote', wide, Date.now() + 1000)
		const waiting = store.getImage('remote', { width: 200, height: 100 }, true)
		store.shapeArrived('remote', wide, image(wide))
		await expect(waiting).resolves.toMatchObject({ dataUrl: 'data:image/png;base64,200x100' })
	})

	test('letting go of one size does not end the wait for another of the same shape', async () => {
		store.setImages('remote', [image(square)])
		const larger = { width: 576, height: 288 }
		store.expectShape('remote', wide, Date.now() + 1000)
		store.expectShape('remote', larger, Date.now() + 1000)

		const waiting = store.getImage('remote', larger, true)
		store.shapeArrived('remote', wide, null)
		store.shapeArrived('remote', larger, image(larger))
		await expect(waiting).resolves.toMatchObject({ dataUrl: 'data:image/png;base64,576x288' })
	})

	test('draws each size from its own image, and one without from the largest of the closest shape', async () => {
		store.setImages('remote', [image(square), image({ width: 200, height: 200 })])
		await expect(store.getImage('remote', square, true)).resolves.toMatchObject({
			dataUrl: 'data:image/png;base64,72x72',
		})
		await expect(store.getImage('remote', { width: 96, height: 96 }, true)).resolves.toMatchObject({
			dataUrl: 'data:image/png;base64,200x200',
		})
		await expect(store.getImage('remote', wide, true)).resolves.toMatchObject({
			dataUrl: 'data:image/png;base64,200x200',
		})
	})

	test('an older image is drawn only when there is no current one', async () => {
		store.setImages('remote', [image(square), image(wide, false)])
		await expect(store.getImage('remote', { width: 200, height: 100 }, true)).resolves.toMatchObject({
			dataUrl: 'data:image/png;base64,72x72',
		})

		store.setImages('remote', [image(wide, false)])
		await expect(store.getImage('remote', { width: 200, height: 100 }, true)).resolves.toMatchObject({
			dataUrl: 'data:image/png;base64,200x100',
		})
	})
})
