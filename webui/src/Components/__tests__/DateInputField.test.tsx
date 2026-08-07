import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateInputField } from '../DateInputField.js'
import { toDateInputValue } from '../DateInputValue.js'

function renderField(props: Partial<Parameters<typeof DateInputField>[0]> = {}) {
	const setValue = props.setValue ?? vi.fn()
	const utils = render(<DateInputField id={undefined} value={null} disabled={false} {...props} setValue={setValue} />)
	const input = utils.container.querySelector('input') as HTMLInputElement
	return { ...utils, input, setValue }
}

describe('toDateInputValue', () => {
	it('passes a bare YYYY-MM-DD string through unchanged', () => {
		expect(toDateInputValue('2026-08-07')).toBe('2026-08-07')
	})

	it('normalises a legacy ISO datetime to the local YYYY-MM-DD', () => {
		// Build the ISO from a local Date (mid-afternoon, safely away from midnight) so the
		// round-trip is timezone-independent.
		const local = new Date(2026, 7, 7, 15, 0, 0)
		expect(toDateInputValue(local.toISOString())).toBe('2026-08-07')
	})

	it('returns an empty string for null', () => {
		expect(toDateInputValue(null)).toBe('')
	})

	it('returns an empty string for an empty string', () => {
		expect(toDateInputValue('')).toBe('')
	})

	it('returns an empty string for an unparsable value', () => {
		expect(toDateInputValue('not-a-date')).toBe('')
	})
})

describe('DateInputField', () => {
	describe('Rendering', () => {
		it('renders a native date input', () => {
			const { input } = renderField()
			expect(input).toBeInTheDocument()
			expect(input).toHaveAttribute('type', 'date')
		})

		it('applies the form-input and datetime-input-field classes', () => {
			const { input } = renderField()
			expect(input).toHaveClass('form-input', 'datetime-input-field')
		})

		it('sets min to local today', () => {
			const today = new Date()
			const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
				today.getDate()
			).padStart(2, '0')}`
			const { input } = renderField()
			expect(input).toHaveAttribute('min', expected)
		})

		it('displays a YYYY-MM-DD value', () => {
			const { input } = renderField({ value: '2026-08-07' })
			expect(input).toHaveValue('2026-08-07')
		})

		it('normalises a legacy ISO value for display', () => {
			const local = new Date(2026, 7, 7, 15, 0, 0)
			const { input } = renderField({ value: local.toISOString() })
			expect(input).toHaveValue('2026-08-07')
		})

		it('applies the id to the input', () => {
			const { input } = renderField({ id: 'my-date' })
			expect(input).toHaveAttribute('id', 'my-date')
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
			const { input } = renderField({ value: '2026-08-07' })
			expect(input.validity.valueMissing).toBe(false)
		})
	})

	describe('Value changes', () => {
		it('calls setValue with the YYYY-MM-DD string when a date is entered', () => {
			const setValue = vi.fn()
			const { input } = renderField({ setValue })
			fireEvent.change(input, { target: { value: '2026-12-25' } })
			expect(setValue).toHaveBeenCalledWith('2026-12-25')
		})

		it('calls setValue with null when the field is cleared', () => {
			const setValue = vi.fn()
			const { input } = renderField({ value: '2026-08-07', setValue })
			fireEvent.change(input, { target: { value: '' } })
			expect(setValue).toHaveBeenCalledWith(null)
		})
	})
})
