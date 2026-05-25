import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PngImageInputField } from '../PngImageInputField'

// Minimal 1×1 red PNG data URL
const SAMPLE_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='

function renderField(props: Partial<React.ComponentProps<typeof PngImageInputField>> = {}) {
	const setValue = vi.fn()
	render(<PngImageInputField id={undefined} value={null} setValue={setValue} {...props} />)
	return { setValue }
}

function getFileInput(): HTMLInputElement {
	return document.querySelector('input[type="file"]') as HTMLInputElement
}

/** Simulate selecting a file on the hidden file input without pointer interactions */
function changeFile(input: HTMLInputElement, file: File): void {
	Object.defineProperty(input, 'files', { value: [file], writable: true, configurable: true })
	fireEvent.change(input)
}

// ---------------------------------------------------------------------------
// File-picker accept attribute (the allowNonPng feature)
// ---------------------------------------------------------------------------

describe('file input accept attribute', () => {
	it('accepts all image types when allowNonPng is true', () => {
		renderField({ allowNonPng: true })
		expect(getFileInput()).toHaveAttribute('accept', 'image/*')
	})

	it('accepts only PNG when allowNonPng is false', () => {
		renderField({ allowNonPng: false })
		expect(getFileInput()).toHaveAttribute('accept', 'image/png')
	})

	it('defaults to accepting all image types', () => {
		renderField()
		expect(getFileInput()).toHaveAttribute('accept', 'image/*')
	})
})

// ---------------------------------------------------------------------------
// Clear button state
// ---------------------------------------------------------------------------

describe('clear button', () => {
	it('is disabled when value is null', () => {
		renderField({ value: null })
		expect(screen.getByRole('button', { name: 'Clear image' })).toBeDisabled()
	})

	it('is enabled when a value is set', () => {
		renderField({ value: SAMPLE_PNG })
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
// Disabled state
// ---------------------------------------------------------------------------

describe('disabled prop', () => {
	it('disables the clear button when disabled=true and value is set', () => {
		renderField({ disabled: true, value: SAMPLE_PNG })
		expect(screen.getByRole('button', { name: 'Clear image' })).toBeDisabled()
	})

	it('disables the file input when disabled=true', () => {
		renderField({ disabled: true })
		expect(getFileInput()).toBeDisabled()
	})
})

// ---------------------------------------------------------------------------
// Error display on unsupported file type
// ---------------------------------------------------------------------------

describe('file type validation errors', () => {
	it('shows an error when a non-PNG file is selected with allowNonPng=false', () => {
		renderField({ allowNonPng: false })
		const bmpFile = new File(['data'], 'image.bmp', { type: 'image/bmp' })
		changeFile(getFileInput(), bmpFile)
		expect(screen.getByRole('alert')).toHaveTextContent('Only proper PNG files are supported')
	})

	it('shows an error when an unsupported type is selected with allowNonPng=true', () => {
		renderField({ allowNonPng: true })
		const bmpFile = new File(['data'], 'image.bmp', { type: 'image/bmp' })
		changeFile(getFileInput(), bmpFile)
		expect(screen.getByRole('alert')).toHaveTextContent('PNG, JPEG, GIF, WebP or SVG')
	})

	it('does not show an error initially', () => {
		renderField()
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	})

	it('dismisses the error when the close button is clicked', async () => {
		const user = userEvent.setup()
		renderField({ allowNonPng: false })
		changeFile(getFileInput(), new File(['data'], 'image.bmp', { type: 'image/bmp' }))
		expect(screen.getByRole('alert')).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: /close/i }))
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument(), { timeout: 500 })
	})
})
