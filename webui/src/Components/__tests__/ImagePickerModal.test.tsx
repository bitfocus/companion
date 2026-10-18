import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImagePickerModal, type ImagePickerModalRef } from '../ImagePickerModal'

vi.mock('~/ImageLibrary/ImageLibrarySelector.js', () => ({
	ImageLibrarySelector: () => null,
}))

vi.mock('~/ImageLibrary/useImageLibraryUpload.js', () => ({
	useImageLibraryUpload: () => ({ uploadImageFile: vi.fn(), uploadDataUrl: vi.fn() }),
}))

vi.mock('~/Resources/TRPC.js', () => ({
	trpc: { imageLibrary: { create: { mutationOptions: () => ({}) } } },
	useMutationExt: () => ({ mutateAsync: vi.fn() }),
}))

// jsdom does not decode images, so report a fixed size for anything loaded
class MockImage {
	width = 64
	height = 64
	onload: (() => void) | null = null
	onerror: (() => void) | null = null
	set src(_value: string) {
		setTimeout(() => this.onload?.(), 0)
	}
}

const SMALL_SVG =
	'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>')
// Comfortably over the size limit for custom images
const LARGE_GIF = 'data:image/gif;base64,' + btoa('G'.repeat(1024 * 1024))

function renderModal() {
	const setValue = vi.fn()
	const ref = createRef<ImagePickerModalRef>()
	const store = { notifier: { show: vi.fn() } } as never
	render(
		<RootAppStoreContext.Provider value={store}>
			<ImagePickerModal ref={ref} setValue={setValue} min={undefined} />
		</RootAppStoreContext.Provider>
	)
	return { setValue, ref }
}

describe('ImagePickerModal custom image tab', () => {
	beforeEach(() => {
		vi.stubGlobal('Image', MockImage)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('keeps the original data url of a chosen file', async () => {
		const { setValue, ref } = renderModal()
		act(() => ref.current?.show('custom'))

		const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>'
		const file = new File([svgText], 'icon.svg', { type: 'image/svg+xml' })
		const input = document.querySelector<HTMLInputElement>('input[type="file"]')
		expect(input).toBeTruthy()
		await userEvent.upload(input!, file)

		const useButton = await screen.findByRole('button', { name: 'Use This Image' })
		await waitFor(() => expect(useButton).toBeEnabled())
		await userEvent.click(useButton)

		expect(setValue).toHaveBeenCalledWith(SMALL_SVG)
	})

	it('allows a small image', async () => {
		const { setValue, ref } = renderModal()
		act(() => ref.current?.show('custom', SMALL_SVG))

		await userEvent.click(await screen.findByRole('button', { name: 'Use This Image' }))
		expect(setValue).toHaveBeenCalledWith(SMALL_SVG)
		expect(screen.queryByText(/too large to store in a button/)).toBeNull()
	})

	it('rejects a large image and offers the image library instead', async () => {
		const { setValue, ref } = renderModal()
		act(() => ref.current?.show('custom', LARGE_GIF))

		expect(await screen.findByText(/too large to store in a button/)).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Use This Image' })).toBeDisabled()

		await userEvent.click(screen.getByRole('button', { name: 'Upload to Library' }))
		expect(await screen.findByRole('button', { name: 'Upload to Library' })).toBeInTheDocument()
		expect(screen.getByRole('tab', { name: 'Upload to Library', selected: true })).toBeInTheDocument()
		expect(setValue).not.toHaveBeenCalled()
	})
})
