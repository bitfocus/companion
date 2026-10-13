import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FileInputButton, type FileInputButtonProps } from '../FileInputButton'

function renderButton(props: Partial<FileInputButtonProps> = {}) {
	const onFileSelected = vi.fn()
	const result = render(
		<FileInputButton accept=".txt" onFileSelected={onFileSelected} {...props}>
			Choose file
		</FileInputButton>
	)

	const input = result.container.querySelector<HTMLInputElement>('input[type="file"]')!
	return { ...result, input, onFileSelected }
}

describe('FileInputButton', () => {
	it('renders a button with the children', () => {
		renderButton()
		expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument()
	})

	it('passes accept to a hidden file input', () => {
		const { input } = renderButton()
		expect(input).toHaveAttribute('accept', '.txt')
		expect(input).toHaveClass('hidden')
	})

	it('opens the file picker on click', () => {
		const { input } = renderButton()
		const clickSpy = vi.spyOn(input, 'click')

		fireEvent.click(screen.getByRole('button'))

		expect(clickSpy).toHaveBeenCalledOnce()
	})

	it('calls onClick before opening the picker', () => {
		const onClick = vi.fn()
		const { input } = renderButton({ onClick })
		const clickSpy = vi.spyOn(input, 'click')

		fireEvent.click(screen.getByRole('button'))

		expect(onClick).toHaveBeenCalledOnce()
		expect(onClick.mock.invocationCallOrder[0]).toBeLessThan(clickSpy.mock.invocationCallOrder[0])
	})

	it('calls onFileSelected with the picked file', async () => {
		const { input, onFileSelected } = renderButton()
		const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })

		await userEvent.upload(input, file)

		expect(onFileSelected).toHaveBeenCalledExactlyOnceWith(file)
	})

	it('resets the input so the same file can be picked again', async () => {
		const { input, onFileSelected } = renderButton()
		const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })

		await userEvent.upload(input, file)
		expect(input.value).toBe('')

		await userEvent.upload(input, file)
		expect(onFileSelected).toHaveBeenCalledTimes(2)
	})

	it('does not call onFileSelected when no file was picked', () => {
		const { input, onFileSelected } = renderButton()

		fireEvent.change(input, { target: { files: [] } })

		expect(onFileSelected).not.toHaveBeenCalled()
	})

	it('disables both the button and the input', () => {
		const { input } = renderButton({ disabled: true })
		expect(screen.getByRole('button')).toBeDisabled()
		expect(input).toBeDisabled()
	})
})
