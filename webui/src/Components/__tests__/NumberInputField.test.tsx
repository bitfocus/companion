import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NumberInputField } from '../NumberInputField.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Props = Parameters<typeof NumberInputField>[0]

/** Controlled wrapper so the component's value updates on setValue calls */
function ControlledNumber({
	initialValue = 5,
	setValue: externalSetValue,
	...rest
}: Omit<Props, 'value' | 'setValue'> & {
	initialValue?: number | undefined
	setValue?: (v: number) => void
}) {
	const [value, setValue] = useState<number | undefined>(initialValue)
	return (
		<NumberInputField
			{...rest}
			value={value}
			setValue={(v) => {
				setValue(v)
				externalSetValue?.(v)
			}}
		/>
	)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NumberInputField', () => {
	describe('Rendering', () => {
		it('renders the numeric input', () => {
			render(<NumberInputField value={42} setValue={vi.fn()} />)
			expect(screen.getByRole('textbox')).toBeInTheDocument()
		})

		it('displays the provided value', () => {
			render(<NumberInputField value={42} setValue={vi.fn()} />)
			expect(screen.getByRole('textbox')).toHaveValue('42')
		})

		it('displays 0 when value is undefined', () => {
			render(<NumberInputField value={undefined} setValue={vi.fn()} />)
			expect(screen.getByRole('textbox')).toHaveValue('0')
		})

		it('does not render a slider when range is not set', () => {
			const { container } = render(<NumberInputField value={5} setValue={vi.fn()} />)
			expect(container.querySelector('input[type="range"]')).toBeNull()
		})

		it('renders a slider when range=true', () => {
			const { container } = render(<NumberInputField value={5} setValue={vi.fn()} min={0} max={100} range />)
			expect(container.querySelector('input[type="range"]')).toBeInTheDocument()
		})

		it('disables the input when disabled=true', () => {
			render(<NumberInputField value={5} setValue={vi.fn()} disabled />)
			expect(screen.getByRole('textbox')).toBeDisabled()
		})

		it('disables the slider when disabled=true', () => {
			const { container } = render(<NumberInputField value={5} setValue={vi.fn()} min={0} max={100} range disabled />)
			expect(container.querySelector('input[type="range"]')).toBeDisabled()
		})
	})

	// -------------------------------------------------------------------------

	describe('checkValid', () => {
		it('applies invalid-value class when checkValid=false', () => {
			render(<NumberInputField value={5} setValue={vi.fn()} checkValid={false} />)
			expect(screen.getByRole('textbox')).toHaveClass('invalid-value')
		})

		it('does not apply invalid-value class when checkValid=true', () => {
			render(<NumberInputField value={5} setValue={vi.fn()} checkValid={true} />)
			expect(screen.getByRole('textbox')).not.toHaveClass('invalid-value')
		})

		it('applies invalid-value class when checkValid function returns false', () => {
			render(<NumberInputField value={5} setValue={vi.fn()} checkValid={() => false} />)
			expect(screen.getByRole('textbox')).toHaveClass('invalid-value')
		})

		it('does not apply invalid-value class when checkValid function returns true', () => {
			render(<NumberInputField value={5} setValue={vi.fn()} checkValid={() => true} />)
			expect(screen.getByRole('textbox')).not.toHaveClass('invalid-value')
		})

		it('passes the current value to checkValid', () => {
			const checkValid = vi.fn(() => true)
			render(<NumberInputField value={42} setValue={vi.fn()} checkValid={checkValid} />)
			// Called at least once during render
			expect(checkValid).toHaveBeenCalledWith(42)
		})

		it('is conditionally invalid based on checkValid function result', () => {
			render(<NumberInputField value={5} setValue={vi.fn()} checkValid={(v) => v > 10} />)
			// 5 is NOT > 10, so checkValid returns false → invalid
			expect(screen.getByRole('textbox')).toHaveClass('invalid-value')
		})

		it('receives 0 (not NaN) when value is undefined', () => {
			const checkValid = vi.fn(() => true)
			render(<NumberInputField value={undefined} setValue={vi.fn()} checkValid={checkValid} />)
			expect(checkValid).toHaveBeenCalledWith(0)
		})
	})

	// -------------------------------------------------------------------------

	describe('showMinAsNegativeInfinity', () => {
		it('shows -∞ overlay when value equals min', () => {
			render(<NumberInputField value={0} setValue={vi.fn()} min={0} showMinAsNegativeInfinity />)
			expect(screen.getByText('-∞')).toBeInTheDocument()
		})

		it('shows -∞ overlay when value is below min', () => {
			render(<NumberInputField value={-5} setValue={vi.fn()} min={0} showMinAsNegativeInfinity />)
			expect(screen.getByText('-∞')).toBeInTheDocument()
		})

		it('does not show -∞ overlay when value is above min', () => {
			render(<NumberInputField value={5} setValue={vi.fn()} min={0} showMinAsNegativeInfinity />)
			expect(screen.queryByText('-∞')).toBeNull()
		})

		it('does not show -∞ overlay when showMinAsNegativeInfinity is not set', () => {
			render(<NumberInputField value={0} setValue={vi.fn()} min={0} />)
			expect(screen.queryByText('-∞')).toBeNull()
		})

		it('does not show -∞ overlay when min is not defined', () => {
			render(<NumberInputField value={0} setValue={vi.fn()} showMinAsNegativeInfinity />)
			expect(screen.queryByText('-∞')).toBeNull()
		})

		it('does not show -∞ overlay when value is undefined and min=0', () => {
			render(<NumberInputField value={undefined} setValue={vi.fn()} min={0} showMinAsNegativeInfinity />)
			expect(screen.queryByText('-∞')).toBeNull()
		})

		it('-∞ overlay also shows invalid-value class when checkValid=false', () => {
			const { container } = render(
				<NumberInputField value={0} setValue={vi.fn()} min={0} showMinAsNegativeInfinity checkValid={false} />
			)
			const overlay = container.querySelector('.number-field-inf-overlay')
			expect(overlay).toHaveClass('invalid-value')
		})
	})

	// -------------------------------------------------------------------------

	describe('showMaxAsPositiveInfinity', () => {
		it('shows ∞ overlay when value equals max', () => {
			render(<NumberInputField value={100} setValue={vi.fn()} max={100} showMaxAsPositiveInfinity />)
			expect(screen.getByText('∞')).toBeInTheDocument()
		})

		it('shows ∞ overlay when value is above max', () => {
			render(<NumberInputField value={150} setValue={vi.fn()} max={100} showMaxAsPositiveInfinity />)
			expect(screen.getByText('∞')).toBeInTheDocument()
		})

		it('does not show ∞ overlay when value is below max', () => {
			render(<NumberInputField value={50} setValue={vi.fn()} max={100} showMaxAsPositiveInfinity />)
			expect(screen.queryByText('∞')).toBeNull()
		})

		it('does not show ∞ overlay when showMaxAsPositiveInfinity is not set', () => {
			render(<NumberInputField value={100} setValue={vi.fn()} max={100} />)
			expect(screen.queryByText('∞')).toBeNull()
		})

		it('does not show ∞ overlay when max is not defined', () => {
			render(<NumberInputField value={100} setValue={vi.fn()} showMaxAsPositiveInfinity />)
			expect(screen.queryByText('∞')).toBeNull()
		})
	})

	// -------------------------------------------------------------------------

	describe('Value changes', () => {
		it('calls setValue when the increment button is clicked', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			const { container } = render(<ControlledNumber initialValue={5} setValue={setValue} min={0} max={100} />)

			const incrementBtn = container.querySelector('.number-field-increment') as HTMLElement
			await user.click(incrementBtn)

			expect(setValue).toHaveBeenCalledWith(6)
		})

		it('calls setValue when the decrement button is clicked', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			const { container } = render(<ControlledNumber initialValue={5} setValue={setValue} min={0} max={100} />)

			const decrementBtn = container.querySelector('.number-field-decrement') as HTMLElement
			await user.click(decrementBtn)

			expect(setValue).toHaveBeenCalledWith(4)
		})

		it('does not call setValue with a value below min', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			const { container } = render(<ControlledNumber initialValue={0} setValue={setValue} min={0} max={100} />)

			const decrementBtn = container.querySelector('.number-field-decrement') as HTMLElement
			await user.click(decrementBtn)

			for (const [v] of setValue.mock.calls) {
				expect(v).toBeGreaterThanOrEqual(0)
			}
		})

		it('does not call setValue with a value above max', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			const { container } = render(<ControlledNumber initialValue={100} setValue={setValue} min={0} max={100} />)

			const incrementBtn = container.querySelector('.number-field-increment') as HTMLElement
			await user.click(incrementBtn)

			for (const [v] of setValue.mock.calls) {
				expect(v).toBeLessThanOrEqual(100)
			}
		})
	})

	// -------------------------------------------------------------------------

	describe('onBlur', () => {
		it('calls onBlur when the input loses focus', async () => {
			const onBlur = vi.fn()
			const user = userEvent.setup()
			render(<NumberInputField value={5} setValue={vi.fn()} onBlur={onBlur} />)

			await user.click(screen.getByRole('textbox'))
			await user.tab()

			expect(onBlur).toHaveBeenCalled()
		})
	})

	// -------------------------------------------------------------------------

	describe('In-progress editing behaviour', () => {
		/**
		 * While the user is typing, external value updates from the parent are
		 * intentionally ignored. Applying them would cause a fight between the
		 * user's input and any value that commits (via setValue) and propagates
		 * back — potentially stomping characters typed after the commit was issued.
		 *
		 * The component achieves this by holding an internal `tmpValue` that
		 * takes precedence over the controlled `value` prop while editing.
		 */
		it('external value updates are ignored while the user is typing', async () => {
			const user = userEvent.setup()
			const { rerender } = render(<NumberInputField value={5} setValue={vi.fn()} />)
			const input = screen.getByRole('textbox')

			await user.clear(input)
			await user.type(input, '10')

			// Parent tries to push a different value mid-edit
			rerender(<NumberInputField value={7} setValue={vi.fn()} />)

			// tmpValue wins — the user's in-progress text is preserved
			expect(input).toHaveValue('10')
		})
	})
})
