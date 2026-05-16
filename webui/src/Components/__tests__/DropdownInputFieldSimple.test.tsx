import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import type { DropdownChoicesOrGroups } from '../DropdownChoices.js'
import { SimpleDropdownInputField } from '../DropdownInputFieldSimple.js'
import { MenuPortalContext } from '../MenuPortalContext.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHOICES: DropdownChoicesOrGroups = [
	{ id: 'apple', label: 'Apple' },
	{ id: 'banana', label: 'Banana' },
	{ id: 'cherry', label: 'Cherry' },
	{ id: 'date', label: 'Date' },
]

const NUMERIC_CHOICES: DropdownChoicesOrGroups = [
	{ id: 1, label: 'One' },
	{ id: 2, label: 'Two' },
	{ id: 3, label: 'Three' },
]

// Choices that contain both numeric 1 and string '1' as distinct IDs.
const AMBIGUOUS_CHOICES: DropdownChoicesOrGroups = [
	{ id: 1, label: 'One (number)' },
	{ id: '1', label: 'One (string)' },
	{ id: 2, label: 'Two' },
]

const GROUPED_CHOICES: DropdownChoicesOrGroups = [
	{
		label: 'Fruits',
		options: [
			{ id: 'apple', label: 'Apple' },
			{ id: 'banana', label: 'Banana' },
		],
	},
	{
		label: 'Veggies',
		options: [
			{ id: 'carrot', label: 'Carrot' },
			{ id: 'daikon', label: 'Daikon' },
		],
	},
]

interface RenderOptions {
	choices?: DropdownChoicesOrGroups
	value?: DropdownChoiceId
	disabled?: boolean
	checkValid?: (v: DropdownChoiceId) => boolean
	noOptionsMessage?: string
	badOptionPrefix?: string
	onBlur?: () => void
}

/** Controlled wrapper so the component's value updates on setValue calls. */
function ControlledSimple({
	initialValue = 'apple',
	setValue: externalSetValue,
	choices = CHOICES,
	...rest
}: RenderOptions & { initialValue?: DropdownChoiceId; setValue?: (v: DropdownChoiceId) => void }) {
	const [value, setValue] = useState<DropdownChoiceId>(initialValue)
	return (
		<MenuPortalContext.Provider value={document.body}>
			<SimpleDropdownInputField
				choices={choices}
				{...rest}
				value={value}
				setValue={(v) => {
					setValue(v)
					externalSetValue?.(v)
				}}
			/>
		</MenuPortalContext.Provider>
	)
}

function renderField(
	opts: RenderOptions & { initialValue?: DropdownChoiceId; setValue?: (v: DropdownChoiceId) => void } = {}
) {
	const setValue = opts.setValue ?? vi.fn()
	const user = userEvent.setup()
	const utils = render(<ControlledSimple {...opts} setValue={setValue} />)
	const trigger = utils.container.querySelector<HTMLButtonElement>('.dropdown-field-select-trigger')!
	return { ...utils, trigger, setValue, user }
}

function getListbox() {
	return screen.getByRole('listbox')
}

function queryListbox() {
	return screen.queryByRole('listbox')
}

// ---------------------------------------------------------------------------
// Rendering — static
// ---------------------------------------------------------------------------

describe('Rendering (static)', () => {
	it('renders the trigger button', () => {
		const { trigger } = renderField()
		expect(trigger).toBeInTheDocument()
	})

	it('shows the label for the current value', () => {
		const { trigger } = renderField({ initialValue: 'banana' })
		expect(trigger).toHaveTextContent('Banana')
	})

	it('does not render a listbox initially', () => {
		renderField()
		expect(queryListbox()).toBeNull()
	})

	it('renders a listbox when trigger is clicked', async () => {
		const { trigger, user } = renderField()
		await user.click(trigger)
		expect(getListbox()).toBeInTheDocument()
	})

	it('listbox contains all choices as options', async () => {
		const { trigger, user } = renderField()
		await user.click(trigger)
		const listbox = getListbox()
		const options = within(listbox).getAllByRole('option')
		expect(options).toHaveLength(CHOICES.length)
	})

	it('labels all options correctly', async () => {
		const { trigger, user } = renderField()
		await user.click(trigger)
		const listbox = getListbox()
		expect(within(listbox).getByRole('option', { name: 'Apple' })).toBeInTheDocument()
		expect(within(listbox).getByRole('option', { name: 'Banana' })).toBeInTheDocument()
		expect(within(listbox).getByRole('option', { name: 'Cherry' })).toBeInTheDocument()
		expect(within(listbox).getByRole('option', { name: 'Date' })).toBeInTheDocument()
	})

	it('disables the trigger when disabled=true', () => {
		const { trigger } = renderField({ disabled: true })
		expect(trigger).toBeDisabled()
	})
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('Selection', () => {
	it('calls setValue when an option is selected', async () => {
		const setValue = vi.fn()
		const { trigger, user } = renderField({ setValue })
		await user.click(trigger)
		const listbox = getListbox()
		await user.click(within(listbox).getByRole('option', { name: 'Cherry' }))
		expect(setValue).toHaveBeenCalledWith('cherry')
	})

	it('updates the displayed label after selection', async () => {
		const { trigger, user } = renderField({ initialValue: 'apple' })
		await user.click(trigger)
		const listbox = getListbox()
		await user.click(within(listbox).getByRole('option', { name: 'Banana' }))
		// Re-query the trigger because the listbox closed
		const updatedTrigger = document.querySelector('.dropdown-field-select-trigger')!
		expect(updatedTrigger).toHaveTextContent('Banana')
	})

	it('does not call setValue with null (no-op guard in onChange)', async () => {
		// Base-UI has been observed calling onValueChange(null) in edge cases —
		// e.g. re-clicking the selected option (deselect) or when the component
		// receives value={null} after choices become empty. The guard
		// `if (v !== null) setValue(v)` is the safety net against those paths.
		const setValue = vi.fn()
		const { trigger, user, rerender } = renderField({ initialValue: 'apple', setValue })

		// Re-clicking the currently-selected option can produce onValueChange(null)
		// in some Base-UI versions.
		await user.click(trigger)
		const listbox = screen.getByRole('listbox')
		await user.click(within(listbox).getByRole('option', { name: 'Apple' }))
		expect(setValue).not.toHaveBeenCalledWith(null)

		// Transitioning to no choices makes Select.Root receive value={null}, which
		// is another known trigger for the null path.
		rerender(<ControlledSimple choices={[]} setValue={setValue} />)
		expect(setValue).not.toHaveBeenCalledWith(null)
	})
})

// ---------------------------------------------------------------------------
// Bad option (unknown value)
// ---------------------------------------------------------------------------

describe('Bad option injection', () => {
	it('shows default ?? (value) label when value is not in choices', () => {
		const { trigger } = renderField({ initialValue: 'unknown-id' })
		expect(trigger).toHaveTextContent('?? (unknown-id)')
	})

	it('shows badOptionPrefix label when value is unknown and badOptionPrefix is set', () => {
		const { trigger } = renderField({ initialValue: 'unknown-id', badOptionPrefix: 'Invalid' })
		expect(trigger).toHaveTextContent('Invalid: unknown-id')
	})

	it('injects the bad option into the listbox so it is visible as an option', async () => {
		const { trigger, user } = renderField({ initialValue: 'unknown-id' })
		await user.click(trigger)
		const listbox = getListbox()
		expect(within(listbox).getByRole('option', { name: '?? (unknown-id)' })).toBeInTheDocument()
	})

	it('does not inject a bad option when value is known', async () => {
		const { trigger, user } = renderField({ initialValue: 'apple' })
		await user.click(trigger)
		const listbox = getListbox()
		// Only the 4 real choices should be present, no extra ?? option
		expect(within(listbox).getAllByRole('option')).toHaveLength(CHOICES.length)
	})
})

// ---------------------------------------------------------------------------
// Validity (checkValid + isKnownValue)
// ---------------------------------------------------------------------------

describe('Validity (checkValid and isKnownValue)', () => {
	it('applies dropdown-field-invalid when value is not in choices', () => {
		const { container } = renderField({ initialValue: 'unknown-id' })
		expect(container.querySelector('.dropdown-field')).toHaveClass('dropdown-field-invalid')
	})

	it('does not apply dropdown-field-invalid when value is in choices', () => {
		const { container } = renderField({ initialValue: 'apple' })
		expect(container.querySelector('.dropdown-field')).not.toHaveClass('dropdown-field-invalid')
	})

	it('applies dropdown-field-invalid when checkValid returns false for a known value', () => {
		const { container } = renderField({ initialValue: 'apple', checkValid: () => false })
		expect(container.querySelector('.dropdown-field')).toHaveClass('dropdown-field-invalid')
	})

	it('does not apply dropdown-field-invalid when checkValid returns true for a known value', () => {
		const { container } = renderField({ initialValue: 'apple', checkValid: () => true })
		expect(container.querySelector('.dropdown-field')).not.toHaveClass('dropdown-field-invalid')
	})

	it('passes the original value to checkValid (not the string-coerced version)', () => {
		const checkValid = vi.fn(() => true)
		render(
			<MenuPortalContext.Provider value={document.body}>
				<SimpleDropdownInputField choices={NUMERIC_CHOICES} value={1} setValue={vi.fn()} checkValid={checkValid} />
			</MenuPortalContext.Provider>
		)
		// The value prop is the number 1; checkValid should receive 1, not '1'
		expect(checkValid).toHaveBeenCalledWith(1)
	})

	it('applies dropdown-field-invalid for unknown value even when checkValid returns true', () => {
		const { container } = renderField({ initialValue: 'unknown-id', checkValid: () => true })
		// isKnownValue=false → always invalid, regardless of checkValid
		expect(container.querySelector('.dropdown-field')).toHaveClass('dropdown-field-invalid')
	})
})

// ---------------------------------------------------------------------------
// No options
// ---------------------------------------------------------------------------

describe('No options', () => {
	it('shows the noOptionsMessage inside the listbox', async () => {
		const user = userEvent.setup()
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<SimpleDropdownInputField choices={[]} value="" setValue={vi.fn()} noOptionsMessage="Nothing here" />
			</MenuPortalContext.Provider>
		)
		const trigger = container.querySelector<HTMLButtonElement>('.dropdown-field-select-trigger')!
		await user.click(trigger)
		const listbox = getListbox()
		expect(within(listbox).getByText('Nothing here')).toBeInTheDocument()
	})

	it('shows the default no-options message when noOptionsMessage is omitted', async () => {
		const user = userEvent.setup()
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<SimpleDropdownInputField choices={[]} value="" setValue={vi.fn()} />
			</MenuPortalContext.Provider>
		)
		const trigger = container.querySelector<HTMLButtonElement>('.dropdown-field-select-trigger')!
		await user.click(trigger)
		const listbox = getListbox()
		expect(within(listbox).getByText('No options available')).toBeInTheDocument()
	})

	it('does not apply dropdown-field-invalid for unknown value when there are no options', () => {
		// isKnownValue = true when options.length === 0 (guard in the source)
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<SimpleDropdownInputField choices={[]} value="anything" setValue={vi.fn()} />
			</MenuPortalContext.Provider>
		)
		expect(container.querySelector('.dropdown-field')).not.toHaveClass('dropdown-field-invalid')
	})
})

// ---------------------------------------------------------------------------
// Grouped choices
// ---------------------------------------------------------------------------

describe('Grouped choices', () => {
	it('renders options from all groups', async () => {
		const user = userEvent.setup()
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<ControlledSimple choices={GROUPED_CHOICES} initialValue="apple" />
			</MenuPortalContext.Provider>
		)
		const trigger = container.querySelector<HTMLButtonElement>('.dropdown-field-select-trigger')!
		await user.click(trigger)
		const listbox = getListbox()
		expect(within(listbox).getByRole('option', { name: 'Apple' })).toBeInTheDocument()
		expect(within(listbox).getByRole('option', { name: 'Carrot' })).toBeInTheDocument()
	})

	it('calls setValue when a grouped option is selected', async () => {
		const setValue = vi.fn()
		const user = userEvent.setup()
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<ControlledSimple choices={GROUPED_CHOICES} initialValue="apple" setValue={setValue} />
			</MenuPortalContext.Provider>
		)
		const trigger = container.querySelector<HTMLButtonElement>('.dropdown-field-select-trigger')!
		await user.click(trigger)
		const listbox = getListbox()
		await user.click(within(listbox).getByRole('option', { name: 'Daikon' }))
		expect(setValue).toHaveBeenCalledWith('daikon')
	})
})

// ---------------------------------------------------------------------------
// onBlur
// ---------------------------------------------------------------------------

describe('onBlur', () => {
	it('calls onBlur when the trigger loses focus', async () => {
		const onBlur = vi.fn()
		const { trigger, user } = renderField({ onBlur })
		await user.click(trigger)
		await user.tab()
		expect(onBlur).toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// Numeric vs string ID disambiguation
// ---------------------------------------------------------------------------

describe('Numeric vs string ID disambiguation', () => {
	// Base UI Select stores values by identity (Object.is), so numeric 1 and
	// string '1' are kept as separate items with no coercion.

	it('shows the numeric-ID label when value={1}', () => {
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<SimpleDropdownInputField choices={AMBIGUOUS_CHOICES} value={1} setValue={vi.fn()} />
			</MenuPortalContext.Provider>
		)
		const trigger = container.querySelector('.dropdown-field-select-trigger')!
		expect(trigger).toHaveTextContent('One (number)')
	})

	it('shows the string-ID label when value={"1"}', () => {
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<SimpleDropdownInputField choices={AMBIGUOUS_CHOICES} value="1" setValue={vi.fn()} />
			</MenuPortalContext.Provider>
		)
		const trigger = container.querySelector('.dropdown-field-select-trigger')!
		expect(trigger).toHaveTextContent('One (string)')
	})

	it('selecting the numeric-ID option calls setValue with number 1, not string "1"', async () => {
		const setValue = vi.fn()
		const user = userEvent.setup()
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<ControlledSimple choices={AMBIGUOUS_CHOICES} initialValue={1} setValue={setValue} />
			</MenuPortalContext.Provider>
		)
		const trigger = container.querySelector<HTMLButtonElement>('.dropdown-field-select-trigger')!
		await user.click(trigger)
		const listbox = getListbox()
		await user.click(within(listbox).getByRole('option', { name: 'Two' }))
		await user.click(trigger)
		await user.click(within(getListbox()).getByRole('option', { name: 'One (number)' }))
		expect(setValue).toHaveBeenLastCalledWith(1)
		expect(setValue).not.toHaveBeenLastCalledWith('1')
	})

	it('selecting the string-ID option calls setValue with string "1", not number 1', async () => {
		const setValue = vi.fn()
		const user = userEvent.setup()
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<ControlledSimple choices={AMBIGUOUS_CHOICES} initialValue={1} setValue={setValue} />
			</MenuPortalContext.Provider>
		)
		const trigger = container.querySelector<HTMLButtonElement>('.dropdown-field-select-trigger')!
		await user.click(trigger)
		const listbox = getListbox()
		await user.click(within(listbox).getByRole('option', { name: 'One (string)' }))
		expect(setValue).toHaveBeenLastCalledWith('1')
		expect(setValue).not.toHaveBeenLastCalledWith(1)
	})

	it('value={1} is known (not treated as unknown just because "1" also exists)', () => {
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<SimpleDropdownInputField choices={AMBIGUOUS_CHOICES} value={1} setValue={vi.fn()} />
			</MenuPortalContext.Provider>
		)
		expect(container.querySelector('.dropdown-field')).not.toHaveClass('dropdown-field-invalid')
	})

	it('value={"1"} is known (not treated as unknown just because 1 also exists)', () => {
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<SimpleDropdownInputField choices={AMBIGUOUS_CHOICES} value="1" setValue={vi.fn()} />
			</MenuPortalContext.Provider>
		)
		expect(container.querySelector('.dropdown-field')).not.toHaveClass('dropdown-field-invalid')
	})
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
	it('selecting a numeric-ID choice calls setValue with the original number, not a string', async () => {
		const setValue = vi.fn()
		const user = userEvent.setup()
		const { container } = render(
			<MenuPortalContext.Provider value={document.body}>
				<ControlledSimple choices={NUMERIC_CHOICES} initialValue={1} setValue={setValue} />
			</MenuPortalContext.Provider>
		)
		const trigger = container.querySelector<HTMLButtonElement>('.dropdown-field-select-trigger')!
		await user.click(trigger)
		const listbox = getListbox()
		await user.click(within(listbox).getByRole('option', { name: 'Two' }))

		expect(setValue).toHaveBeenLastCalledWith(2)
	})
})
