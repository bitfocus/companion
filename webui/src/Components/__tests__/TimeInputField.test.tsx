import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimeInputField } from '../TimeInputField.js'

function renderField(props: Partial<Parameters<typeof TimeInputField>[0]> = {}) {
	const setValue = props.setValue ?? vi.fn()
	const utils = render(<TimeInputField id={undefined} value={null} disabled={false} {...props} setValue={setValue} />)
	const input = utils.container.querySelector('input') as HTMLInputElement
	return { ...utils, input, setValue }
}

describe('TimeInputField', () => {
	describe('Rendering', () => {
		it('renders a native time input with step="1"', () => {
			const { input } = renderField()
			expect(input).toBeInTheDocument()
			expect(input).toHaveAttribute('type', 'time')
			expect(input).toHaveAttribute('step', '1')
		})

		it('applies the form-input and datetime-input-field classes', () => {
			const { input } = renderField()
			expect(input).toHaveClass('form-input', 'datetime-input-field')
		})

		it('displays the provided value', () => {
			const { input } = renderField({ value: '12:30:00' })
			expect(input).toHaveValue('12:30:00')
		})

		it('renders empty when value is null', () => {
			const { input } = renderField({ value: null })
			expect(input).toHaveValue('')
		})

		it('applies the id to the input', () => {
			const { input } = renderField({ id: 'my-time' })
			expect(input).toHaveAttribute('id', 'my-time')
		})

		it('disables the input when disabled=true', () => {
			const { input } = renderField({ disabled: true })
			expect(input).toBeDisabled()
		})

		it('is required and reports invalid when empty', () => {
			const { input } = renderField({ value: null })
			expect(input).toBeRequired()
			expect(input.validity.valueMissing).toBe(true)
		})

		it('is valid when a value is provided', () => {
			const { input } = renderField({ value: '12:30:00' })
			expect(input.validity.valueMissing).toBe(false)
		})
	})

	describe('Value changes', () => {
		it('calls setValue with the "HH:mm:ss" string when a time is entered', () => {
			const setValue = vi.fn()
			const { input } = renderField({ setValue })
			fireEvent.change(input, { target: { value: '13:45:30' } })
			expect(setValue).toHaveBeenCalledWith('13:45:30')
		})

		it('calls setValue with null when the field is cleared', () => {
			const setValue = vi.fn()
			const { input } = renderField({ value: '13:45:30', setValue })
			fireEvent.change(input, { target: { value: '' } })
			expect(setValue).toHaveBeenCalledWith(null)
		})
	})
})
