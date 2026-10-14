import { describe, expect, it, vi } from 'vitest'
import { uploadImageFiles } from '../useUploadImageFiles'

function makeFiles(count: number, type = 'image/png'): File[] {
	return Array.from({ length: count }, (_, i) => new File(['x'], `img${i}.png`, { type }))
}

function makeNotifier() {
	return { show: vi.fn((_title: string, _message: string, _duration?: number | null, id?: string) => id ?? 'id') }
}

describe('uploadImageFiles', () => {
	it('rejects a batch with no images without uploading', async () => {
		const notifier = makeNotifier()
		const uploadOne = vi.fn(async () => {})

		await uploadImageFiles(makeFiles(2, 'text/plain'), uploadOne, notifier)

		expect(uploadOne).not.toHaveBeenCalled()
		expect(notifier.show).toHaveBeenCalledExactlyOnceWith('Invalid Files', 'Please choose image files only', 5000)
	})

	it('skips non-image files', async () => {
		const notifier = makeNotifier()
		const uploadOne = vi.fn(async () => {})

		await uploadImageFiles([...makeFiles(1), ...makeFiles(1, 'text/plain')], uploadOne, notifier)

		expect(uploadOne).toHaveBeenCalledTimes(1)
		expect(notifier.show).toHaveBeenLastCalledWith(
			'Upload Complete',
			'Successfully uploaded 1 image',
			5000,
			expect.any(String)
		)
	})

	it('shows no progress for a small batch', async () => {
		const notifier = makeNotifier()

		await uploadImageFiles(
			makeFiles(3),
			vi.fn(async () => {}),
			notifier
		)

		expect(notifier.show).toHaveBeenCalledExactlyOnceWith(
			'Upload Complete',
			'Successfully uploaded 3 images',
			5000,
			expect.any(String)
		)
	})

	it('counts up a single sticky toast for a larger batch', async () => {
		const notifier = makeNotifier()

		await uploadImageFiles(
			makeFiles(4),
			vi.fn(async () => {}),
			notifier
		)

		const calls = notifier.show.mock.calls
		expect(calls.map((c) => c.slice(0, 3))).toEqual([
			['Uploading images...', '0 of 4 done', null],
			['Uploading images...', '1 of 4 done', null],
			['Uploading images...', '2 of 4 done', null],
			['Uploading images...', '3 of 4 done', null],
			['Uploading images...', '4 of 4 done', null],
			['Upload Complete', 'Successfully uploaded 4 images', 5000],
		])
		// All updates replace the same toast
		expect(new Set(calls.map((c) => c[3])).size).toBe(1)
	})

	it('replaces the progress toast with the failure, including how far it got', async () => {
		const notifier = makeNotifier()
		const uploadOne = vi
			.fn(async () => {})
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('boom'))
		vi.spyOn(console, 'error').mockImplementation(() => {})

		await uploadImageFiles(makeFiles(5), uploadOne, notifier)

		expect(uploadOne).toHaveBeenCalledTimes(3)
		const calls = notifier.show.mock.calls
		expect(calls.at(-1)?.slice(0, 3)).toEqual([
			'Upload Failed',
			'Failed to upload one or more images (2 of 5 uploaded)',
			5000,
		])
		expect(new Set(calls.map((c) => c[3])).size).toBe(1)
	})
})
