import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import type { DropdownChoicesOrGroups } from '../DropdownChoices.js'
import { DropdownInputField } from '../DropdownInputField.js'
import { MenuPortalContext } from '../MenuPortalContext.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHOICES = [
	{ id: 'apple', label: 'Apple' },
	{ id: 'banana', label: 'Banana' },
	{ id: 'cherry', label: 'Cherry' },
	{ id: 'date', label: 'Date' },
	{ id: 'elderberry', label: 'Elderberry' },
]

interface RenderOptions {
	choices?: DropdownChoicesOrGroups
	value?: DropdownChoiceId
	allowCustom?: boolean
	disableEditingCustom?: boolean
	regex?: string
	disabled?: boolean
	onBlur?: () => void
	checkValid?: (v: DropdownChoiceId) => boolean
	searchLabelsOnly?: boolean
}

/** Controlled wrapper so the component's value updates on setValue calls */
function ControlledDropdown({
	initialValue = 'apple',
	setValue: externalSetValue,
	...rest
}: RenderOptions & { initialValue?: DropdownChoiceId; setValue?: (v: DropdownChoiceId) => void }) {
	const [value, setValue] = useState<DropdownChoiceId>(initialValue)
	return (
		<MenuPortalContext.Provider value={document.body}>
			<DropdownInputField
				choices={CHOICES}
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
	const utils = render(<ControlledDropdown {...opts} setValue={setValue} initialValue={opts.initialValue ?? 'apple'} />)
	const input = utils.getByRole('combobox')
	return { ...utils, input, setValue, user }
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
	it('shows the label of the current value in the input', () => {
		const { input } = renderField({ initialValue: 'banana' })
		expect(input).toHaveValue('Banana')
	})

	it('shows ?? (id) label for a value not in choices list when allowCustom is false', () => {
		const { input } = renderField({ initialValue: 'unknown-id' as DropdownChoiceId })
		expect(input).toHaveValue('?? (unknown-id)')
	})

	it('shows the raw value when allowCustom is true and value is not in choices', () => {
		const { input } = renderField({ initialValue: 'my-custom' as DropdownChoiceId, allowCustom: true })
		expect(input).toHaveValue('my-custom')
	})

	it('has a disabled input when disabled=true', () => {
		const { input } = renderField({ disabled: true })
		expect(input).toBeDisabled()
	})

	it('applies dropdown-field-invalid class when checkValid returns false', () => {
		const { container } = renderField({ checkValid: () => false })
		expect(container.querySelector('.dropdown-field-invalid')).toBeTruthy()
	})

	it('does not apply dropdown-field-invalid class when checkValid returns true', () => {
		const { container } = renderField({ checkValid: () => true })
		expect(container.querySelector('.dropdown-field-invalid')).toBeNull()
	})

	it('does not apply dropdown-field-invalid class when no checkValid is provided', () => {
		const { container } = renderField()
		expect(container.querySelector('.dropdown-field-invalid')).toBeNull()
	})

	it('applies dropdown-field-invalid when value is not in choices and no checkValid', () => {
		const { container } = renderField({ initialValue: 'unknown-id' as DropdownChoiceId })
		expect(container.querySelector('.dropdown-field-invalid')).toBeTruthy()
	})

	it('applies dropdown-field-invalid for unknown value even when checkValid returns true', () => {
		const { container } = renderField({
			initialValue: 'unknown-id' as DropdownChoiceId,
			checkValid: () => true,
		})
		expect(container.querySelector('.dropdown-field-invalid')).toBeTruthy()
	})

	it('does not apply dropdown-field-invalid for unknown value when there are no options', () => {
		const { container } = renderField({
			choices: [],
			initialValue: 'unknown-id' as DropdownChoiceId,
		})
		expect(container.querySelector('.dropdown-field-invalid')).toBeNull()
	})

	it('does not apply dropdown-field-invalid for a custom value not in choices when allowCustom=true', () => {
		const { container } = renderField({
			initialValue: 'my-custom' as DropdownChoiceId,
			allowCustom: true,
		})
		expect(container.querySelector('.dropdown-field-invalid')).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// Popup open / close
// ---------------------------------------------------------------------------

describe('Popup open / close', () => {
	it('opens the listbox when clicking the chevron trigger', async () => {
		const { user } = renderField()
		const trigger = screen.getByRole('button')
		await user.click(trigger)
		expect(getListbox()).toBeInTheDocument()
	})

	it('closes the listbox when clicking the trigger a second time', async () => {
		const { user } = renderField()
		const trigger = screen.getByRole('button')
		await user.click(trigger)
		await user.click(trigger)
		expect(queryListbox()).toBeNull()
	})

	it('closes the listbox when pressing Escape', async () => {
		const { user } = renderField()
		const trigger = screen.getByRole('button')
		await user.click(trigger)
		expect(getListbox()).toBeInTheDocument()
		await user.keyboard('{Escape}')
		expect(queryListbox()).toBeNull()
	})

	it('shows all flat choices in the open popup', async () => {
		const { user } = renderField()
		await user.click(screen.getByRole('button'))
		const list = getListbox()
		for (const c of CHOICES) {
			expect(within(list).getByText(c.label)).toBeInTheDocument()
		}
	})

	it('renders grouped choices with group labels', async () => {
		const { user } = renderField({
			choices: [
				{ label: 'Fruits', options: [{ id: 'apple', label: 'Apple' }] },
				{ label: 'Veggies', options: [{ id: 'carrot', label: 'Carrot' }] },
			],
			initialValue: 'apple',
		})
		await user.click(screen.getByRole('button'))
		const list = getListbox()
		expect(within(list).getByText('Fruits')).toBeInTheDocument()
		expect(within(list).getByText('Veggies')).toBeInTheDocument()
		expect(within(list).getByText('Apple')).toBeInTheDocument()
		expect(within(list).getByText('Carrot')).toBeInTheDocument()
	})

	it('renders object-shaped (Record) choices', async () => {
		const { user } = renderField({
			choices: {
				a: { id: 'a', label: 'Alpha' },
				b: { id: 'b', label: 'Beta' },
			},
			initialValue: 'a',
		})
		await user.click(screen.getByRole('button'))
		const list = getListbox()
		expect(within(list).getByText('Alpha')).toBeInTheDocument()
		expect(within(list).getByText('Beta')).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('Selection', () => {
	it('calls setValue with the item id when clicking an option', async () => {
		const setValue = vi.fn()
		const { user } = renderField({ setValue })
		await user.click(screen.getByRole('button'))
		await user.click(within(getListbox()).getByText('Banana'))
		expect(setValue).toHaveBeenCalledWith('banana')
	})

	it('updates the input display after mouse selection', async () => {
		const { user, input } = renderField()
		await user.click(screen.getByRole('button'))
		await user.click(within(getListbox()).getByText('Cherry'))
		expect(input).toHaveValue('Cherry')
	})

	it('selects an item via keyboard Arrow + Enter', async () => {
		const setValue = vi.fn()
		const { user, input } = renderField({ setValue })
		await user.click(input)
		await user.keyboard('{ArrowDown}')
		await user.keyboard('{Enter}')
		expect(setValue).toHaveBeenCalledTimes(1)
	})
})

// ---------------------------------------------------------------------------
// Fuzzy filtering
// ---------------------------------------------------------------------------

describe('Fuzzy filtering', () => {
	it('hides non-matching options when typing', async () => {
		const { user, input } = renderField()
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'ban')
		const list = getListbox()
		expect(within(list).getByText('Banana')).toBeInTheDocument()
		expect(within(list).queryByText('Apple')).toBeNull()
	})

	it('shows empty message when no options match', async () => {
		const { user, input } = renderField()
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'zzzzz')
		expect(screen.getByText('No options found.')).toBeInTheDocument()
	})

	it('shows custom noOptionsMessage when provided', async () => {
		// regex ensures 'zzzzz' fails validation → no synthetic item → filteredItems empty → Empty renders
		const { user, input } = renderField({ allowCustom: true, regex: '/^\\d+$/' })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'zzzzz')
		expect(screen.getAllByText('Begin typing to use a custom value').length).toBeGreaterThan(0)
	})

	it('matches by id when searchLabelsOnly=false', async () => {
		const { user, input } = renderField({ searchLabelsOnly: false })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'apple')
		const list = getListbox()
		expect(within(list).getByText('Apple')).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// allowCustom=true, disableEditingCustom=false (editing mode)
// ---------------------------------------------------------------------------

describe('allowCustom=true, disableEditingCustom=false (editing mode)', () => {
	it('pre-fills the input with the raw value id on focus', async () => {
		const { user, input } = renderField({
			allowCustom: true,
			disableEditingCustom: false,
			initialValue: 'apple',
		})
		await user.click(input)
		expect(input).toHaveValue('apple')
	})

	it('shows the Use "X" synthetic item when typing a value not in choices', async () => {
		const { user, input } = renderField({ allowCustom: true, disableEditingCustom: false })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'my-custom-val')
		expect(screen.getByText(/Use "my-custom-val"/)).toBeInTheDocument()
	})

	it('does not show Use "X" when input exactly matches an existing id', async () => {
		const { user, input } = renderField({ allowCustom: true, disableEditingCustom: false })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'apple')
		expect(screen.queryByText(/Use "apple"/)).toBeNull()
	})

	it('calls setValue with the typed text when selecting the synthetic item', async () => {
		const setValue = vi.fn()
		const { user, input } = renderField({ allowCustom: true, disableEditingCustom: false, setValue })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'custom-value')
		await user.click(screen.getByText(/Use "custom-value"/))
		expect(setValue).toHaveBeenCalledWith('custom-value')
	})

	it('commits the typed text via setValue on blur (no selection made)', async () => {
		const setValue = vi.fn()
		const { user, input } = renderField({ allowCustom: true, disableEditingCustom: false, setValue })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'blur-value')
		await user.tab()
		expect(setValue).toHaveBeenCalledWith('blur-value')
	})

	it('hides synthetic item when typed value fails regex', async () => {
		const { user, input } = renderField({
			allowCustom: true,
			disableEditingCustom: false,
			regex: '/^\\d+$/',
		})
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'notanumber')
		expect(screen.queryByText(/Use "notanumber"/)).toBeNull()
	})

	it('shows synthetic item when typed value passes regex', async () => {
		const { user, input } = renderField({
			allowCustom: true,
			disableEditingCustom: false,
			regex: '/^\\d+$/',
		})
		await user.click(input)
		await user.clear(input)
		await user.type(input, '12345')
		expect(screen.getByText(/Use "12345"/)).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// allowCustom=true, disableEditingCustom=true (search-only custom mode)
// ---------------------------------------------------------------------------

describe('allowCustom=true, disableEditingCustom=true (search-only custom mode)', () => {
	it('shows the current label as placeholder when focused', async () => {
		const { user, input } = renderField({
			allowCustom: true,
			disableEditingCustom: true,
			initialValue: 'banana',
		})
		await user.click(input)
		expect(input).toHaveAttribute('placeholder', 'Banana')
	})

	it('does not call setValue on blur without a selection', async () => {
		const setValue = vi.fn()
		const { user, input } = renderField({
			allowCustom: true,
			disableEditingCustom: true,
			setValue,
		})
		await user.click(input)
		await user.type(input, 'some text')
		await user.tab()
		expect(setValue).not.toHaveBeenCalled()
	})

	it('calls setValue when selecting an option from the list', async () => {
		const setValue = vi.fn()
		const { user, input } = renderField({
			allowCustom: true,
			disableEditingCustom: true,
			setValue,
		})
		await user.click(input)
		await user.click(within(getListbox()).getByText('Cherry'))
		expect(setValue).toHaveBeenCalledWith('cherry')
	})
})

// ---------------------------------------------------------------------------
// onBlur callback
// ---------------------------------------------------------------------------

describe('onBlur callback', () => {
	it('calls onBlur when the input loses focus (standard mode)', async () => {
		const onBlur = vi.fn()
		const { user, input } = renderField({ onBlur })
		await user.click(input)
		await user.tab()
		expect(onBlur).toHaveBeenCalledTimes(1)
	})

	it('calls onBlur when the input loses focus (editing mode)', async () => {
		const onBlur = vi.fn()
		const { user, input } = renderField({ allowCustom: true, disableEditingCustom: false, onBlur })
		await user.click(input)
		await user.tab()
		expect(onBlur).toHaveBeenCalledTimes(1)
	})
})

// ---------------------------------------------------------------------------
// Grouped choices — interactions
// ---------------------------------------------------------------------------

describe('Grouped choices — interactions', () => {
	const GROUPED = [
		{
			label: 'Fruits',
			options: [
				{ id: 'apple', label: 'Apple' },
				{ id: 'apricot', label: 'Apricot' },
			],
		},
		{
			label: 'Veggies',
			options: [
				{ id: 'carrot', label: 'Carrot' },
				{ id: 'celery', label: 'Celery' },
			],
		},
	]

	it('calls setValue with the correct id when selecting an item from inside a group', async () => {
		const setValue = vi.fn()
		const { user } = renderField({ choices: GROUPED, setValue, initialValue: 'apple' })
		await user.click(screen.getByRole('button'))
		await user.click(within(getListbox()).getByText('Carrot'))
		expect(setValue).toHaveBeenCalledWith('carrot')
	})

	it('displays the label of a value that lives inside a group', () => {
		const { input } = renderField({ choices: GROUPED, initialValue: 'carrot' })
		expect(input).toHaveValue('Carrot')
	})

	it('removes an entire group from the popup when none of its items match the filter', async () => {
		const { user, input } = renderField({ choices: GROUPED, initialValue: 'apple' })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'appl')
		const list = getListbox()
		expect(within(list).queryByText('Veggies')).toBeNull()
	})

	it('keeps a group in the popup but hides non-matching items within it', async () => {
		const { user, input } = renderField({ choices: GROUPED, initialValue: 'apple' })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'cel')
		const list = getListbox()
		expect(within(list).getByText('Celery')).toBeInTheDocument()
		expect(within(list).queryByText('Carrot')).toBeNull()
	})

	it('still shows the synthetic "Use X" item when allowCustom=true and choices are all grouped', async () => {
		const { user, input } = renderField({
			choices: GROUPED,
			allowCustom: true,
			disableEditingCustom: false,
			initialValue: 'apple',
		})
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'custom-grouped')
		expect(screen.getByText(/Use "custom-grouped"/)).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Type preservation (numeric DropdownChoiceId must not become a string)
// ---------------------------------------------------------------------------

describe('Type preservation on focus/blur (editing mode)', () => {
	const NUMERIC_CHOICES = [
		{ id: 1, label: 'One' },
		{ id: 2, label: 'Two' },
		{ id: 3, label: 'Three' },
	]

	it('preserves a numeric id when the user focuses and blurs without typing', async () => {
		const setValue = vi.fn()
		const user = userEvent.setup()
		render(
			<MenuPortalContext.Provider value={document.body}>
				<DropdownInputField
					choices={NUMERIC_CHOICES}
					allowCustom={true}
					disableEditingCustom={false}
					value={1}
					setValue={setValue}
				/>
			</MenuPortalContext.Provider>
		)
		const input = screen.getByRole('combobox')
		await user.click(input)
		await user.tab()
		expect(setValue).toHaveBeenCalledTimes(1)
		const committed = setValue.mock.calls[0][0]
		expect(committed).toBe(1)
		expect(typeof committed).toBe('number')
	})

	it('preserves a string id when the user focuses and blurs without typing', async () => {
		const setValue = vi.fn()
		const { user, input } = renderField({
			allowCustom: true,
			disableEditingCustom: false,
			setValue,
			initialValue: 'apple',
		})
		await user.click(input)
		await user.tab()
		expect(setValue).toHaveBeenCalledTimes(1)
		const committed = setValue.mock.calls[0][0]
		expect(committed).toBe('apple')
		expect(typeof committed).toBe('string')
	})

	it('passes a string when the user actually edits the value', async () => {
		const setValue = vi.fn()
		const user = userEvent.setup()
		render(
			<MenuPortalContext.Provider value={document.body}>
				<DropdownInputField
					choices={NUMERIC_CHOICES}
					allowCustom={true}
					disableEditingCustom={false}
					value={1}
					setValue={setValue}
				/>
			</MenuPortalContext.Provider>
		)
		const input = screen.getByRole('combobox')
		await user.click(input)
		await user.clear(input)
		await user.type(input, '99')
		await user.tab()
		expect(setValue).toHaveBeenCalledWith('99')
	})
})
