import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImageInputField } from '../ImageInputField'

// ---------------------------------------------------------------------------
// Hoist the modal show spy so it is reachable both inside vi.mock and in tests
// ---------------------------------------------------------------------------

const mockShow = vi.hoisted(() => vi.fn<(arg0: string, arg1?: string | null) => void>())

vi.mock('../ImagePickerModal.js', async () => {
	const { forwardRef, useImperativeHandle } = await import('react')
	return {
		ImagePickerModal: forwardRef(function MockImagePickerModal(
			_props: Record<string, unknown>,
			ref: React.Ref<{ show: typeof mockShow }>
		) {
			useImperativeHandle(ref, () => ({ show: mockShow }), [])
			return null
		}),
	}
})

vi.mock('~/Resources/TRPC.js', () => ({
	trpc: {
		imageLibrary: {
			getData: {
				queryOptions: (input: unknown) => ({
					queryKey: ['imageLibrary.getData', input],
					queryFn: async () => null,
				}),
			},
		},
	},
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

// Minimal 1×1 red PNG data URL
const SAMPLE_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='

const LIBRARY_VALUE = '$(image:my-image-id)'

function makeLibraryInfo(overrides: Partial<ImageLibraryInfo> = {}): ImageLibraryInfo {
	return {
		name: 'my-image-id',
		description: 'My test image',
		originalSize: 1024,
		previewSize: 512,
		createdAt: 0,
		modifiedAt: 0,
		checksum: 'abc123',
		mimeType: 'image/png',
		sortOrder: 0,
		...overrides,
	}
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function makeQueryClient(): QueryClient {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderField(
	props: Partial<React.ComponentProps<typeof ImageInputField>> = {},
	getImage: (id: string) => ImageLibraryInfo | undefined = () => undefined
) {
	const setValue = vi.fn()
	const store = { imageLibrary: { getImage } } as never
	render(
		<RootAppStoreContext.Provider value={store}>
			<QueryClientProvider client={makeQueryClient()}>
				<ImageInputField id={undefined} value={null} setValue={setValue} {...props} />
			</QueryClientProvider>
		</RootAppStoreContext.Provider>
	)
	return { setValue }
}

beforeEach(() => {
	mockShow.mockClear()
})

// ---------------------------------------------------------------------------
// Button presence
// ---------------------------------------------------------------------------

describe('button presence', () => {
	it('shows the Select and Clear buttons when value is null', () => {
		renderField()
		expect(screen.getByRole('button', { name: 'Select image' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Clear image' })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Download image' })).not.toBeInTheDocument()
	})

	it('shows the Download button only for inline images', () => {
		renderField({ value: SAMPLE_PNG })
		expect(screen.getByRole('button', { name: 'Download image' })).toBeInTheDocument()
	})

	it('does not show the Download button for library images', () => {
		renderField({ value: LIBRARY_VALUE }, () => makeLibraryInfo())
		expect(screen.queryByRole('button', { name: 'Download image' })).not.toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Label display
// ---------------------------------------------------------------------------

describe('label display', () => {
	it('shows "No image selected" when value is null', () => {
		renderField()
		expect(screen.getByText('No image selected')).toBeInTheDocument()
	})

	it('shows "Custom image" for an inline data URL', () => {
		renderField({ value: SAMPLE_PNG })
		expect(screen.getByText('Custom image')).toBeInTheDocument()
	})

	it('shows the image description for a known library image', () => {
		renderField({ value: LIBRARY_VALUE }, () => makeLibraryInfo({ description: 'My test image' }))
		expect(screen.getByText('My test image')).toBeInTheDocument()
	})

	it('falls back to the image name when description is empty', () => {
		renderField({ value: LIBRARY_VALUE }, () => makeLibraryInfo({ name: 'my-image-id', description: '' }))
		expect(screen.getByText('my-image-id')).toBeInTheDocument()
	})

	it('shows "Unknown library image" for an unresolved library reference', () => {
		renderField({ value: LIBRARY_VALUE }, () => undefined)
		expect(screen.getByText('Unknown library image')).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Clear button
// ---------------------------------------------------------------------------

describe('clear button', () => {
	it('is disabled when value is null', () => {
		renderField()
		expect(screen.getByRole('button', { name: 'Clear image' })).toBeDisabled()
	})

	it('is enabled for an inline image', () => {
		renderField({ value: SAMPLE_PNG })
		expect(screen.getByRole('button', { name: 'Clear image' })).toBeEnabled()
	})

	it('is enabled for a library image', () => {
		renderField({ value: LIBRARY_VALUE }, () => makeLibraryInfo())
		expect(screen.getByRole('button', { name: 'Clear image' })).toBeEnabled()
	})

	it('calls setValue(null) when clicked', async () => {
		const user = userEvent.setup()
		const { setValue } = renderField({ value: SAMPLE_PNG })
		await user.click(screen.getByRole('button', { name: 'Clear image' }))
		expect(setValue).toHaveBeenCalledWith(null)
	})
})

// ---------------------------------------------------------------------------
// Disabled prop
// ---------------------------------------------------------------------------

describe('disabled prop', () => {
	it('disables all buttons when disabled=true with no value', () => {
		renderField({ disabled: true })
		expect(screen.getByRole('button', { name: 'Select image' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Clear image' })).toBeDisabled()
	})

	it('disables all buttons when disabled=true with an inline value', () => {
		renderField({ disabled: true, value: SAMPLE_PNG })
		expect(screen.getByRole('button', { name: 'Select image' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Download image' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Clear image' })).toBeDisabled()
	})
})

// ---------------------------------------------------------------------------
// Select button opens modal
// ---------------------------------------------------------------------------

describe('Select button opens modal', () => {
	it('opens the modal on the library tab when no value is set', async () => {
		const user = userEvent.setup()
		renderField()
		await user.click(screen.getByRole('button', { name: 'Select image' }))
		expect(mockShow).toHaveBeenCalledWith('library')
	})

	it('opens the modal on the library tab for a library value', async () => {
		const user = userEvent.setup()
		renderField({ value: LIBRARY_VALUE }, () => makeLibraryInfo())
		await user.click(screen.getByRole('button', { name: 'Select image' }))
		expect(mockShow).toHaveBeenCalledWith('library')
	})

	it('opens the modal on the custom tab pre-populated with the data URL for an inline value', async () => {
		const user = userEvent.setup()
		renderField({ value: SAMPLE_PNG })
		await user.click(screen.getByRole('button', { name: 'Select image' }))
		expect(mockShow).toHaveBeenCalledWith('custom', SAMPLE_PNG)
	})
})

// ---------------------------------------------------------------------------
// Download button
// ---------------------------------------------------------------------------

describe('Download button', () => {
	it('triggers a download with the correct filename for a PNG', async () => {
		const user = userEvent.setup()
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

		renderField({ value: SAMPLE_PNG })
		await user.click(screen.getByRole('button', { name: 'Download image' }))

		expect(clickSpy).toHaveBeenCalledTimes(1)

		clickSpy.mockRestore()
	})

	it('uses .jpg extension for jpeg images', async () => {
		const user = userEvent.setup()
		const createdAnchors: HTMLAnchorElement[] = []
		const origCreate = document.createElement.bind(document)
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = origCreate(tag)
			if (tag === 'a') createdAnchors.push(el as HTMLAnchorElement)
			return el
		})
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

		const jpegUrl = 'data:image/jpeg;base64,/9j/fake'
		renderField({ value: jpegUrl })
		await user.click(screen.getByRole('button', { name: 'Download image' }))

		const anchor = createdAnchors.find((a) => a.download)
		expect(anchor?.download).toBe('custom-image.jpg')

		vi.restoreAllMocks()
	})
})
