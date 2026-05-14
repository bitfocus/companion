import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import type { DropdownChoicesOrGroups } from '../DropdownChoices.js'
import { MenuPortalContext } from '../MenuPortalContext.js'
import { MultiDropdownInputField } from '../MultiDropdownInputField.js'

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

interface RenderOptions {
	choices?: DropdownChoicesOrGroups
	initialValue?: DropdownChoiceId[]
	allowCustom?: boolean
	minSelection?: number
	maxSelection?: number
	sortSelection?: boolean
	regex?: string
	disabled?: boolean
	onBlur?: () => void
	checkValid?: (v: DropdownChoiceId[]) => boolean
}

function ControlledMultiDropdown({
	initialValue = ['apple'],
	setValue: externalSetValue,
	...rest
}: RenderOptions & { setValue?: (v: DropdownChoiceId[]) => void }) {
	const [value, setValue] = useState<DropdownChoiceId[]>(initialValue)
	return (
		<MenuPortalContext.Provider value={document.body}>
			<MultiDropdownInputField
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

function renderField(opts: RenderOptions & { setValue?: (v: DropdownChoiceId[]) => void } = {}) {
	const setValue = opts.setValue ?? vi.fn()
	const user = userEvent.setup()
	const utils = render(<ControlledMultiDropdown {...opts} setValue={setValue} />)
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
// Rendering (static)
// ---------------------------------------------------------------------------

describe('Rendering (static)', () => {
	it('shows a pill for each selected value', () => {
		const { container } = renderField({ initialValue: ['apple', 'banana'] })
		const pills = container.querySelectorAll('.dropdown-field-pill-label')
		const labels = Array.from(pills).map((el) => el.textContent)
		expect(labels).toContain('Apple')
		expect(labels).toContain('Banana')
	})

	it('shows no pills when selection is empty', () => {
		const { container } = renderField({ initialValue: [] })
		expect(container.querySelectorAll('.dropdown-field-pill')).toHaveLength(0)
	})

	it('shows a ?? (id) pill for an unknown value when allowCustom is false', () => {
		const { container } = renderField({ initialValue: ['unknown-id'] })
		const pills = container.querySelectorAll('.dropdown-field-pill-label')
		expect(pills[0]?.textContent).toBe('?? (unknown-id)')
	})

	it('shows the raw value pill when allowCustom is true and value not in choices', () => {
		const { container } = renderField({ initialValue: ['my-custom'], allowCustom: true })
		const pills = container.querySelectorAll('.dropdown-field-pill-label')
		expect(pills[0]?.textContent).toBe('my-custom')
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
})

// ---------------------------------------------------------------------------
// Popup open / close
// ---------------------------------------------------------------------------

describe('Popup open / close', () => {
	it('opens the listbox when clicking the chevron trigger', async () => {
		const { user, container } = renderField({ initialValue: [] })
		await user.click(container.querySelector('.dropdown-field-trigger')!)
		expect(getListbox()).toBeInTheDocument()
	})

	it('closes the listbox when pressing Escape', async () => {
		const { user, container } = renderField({ initialValue: [] })
		await user.click(container.querySelector('.dropdown-field-trigger')!)
		expect(getListbox()).toBeInTheDocument()
		await user.keyboard('{Escape}')
		expect(queryListbox()).toBeNull()
	})

	it('shows all flat choices in the open popup', async () => {
		const { user, container } = renderField({ initialValue: [] })
		await user.click(container.querySelector('.dropdown-field-trigger')!)
		const list = getListbox()
		for (const c of CHOICES) {
			expect(within(list).getByText(c.label)).toBeInTheDocument()
		}
	})

	it('renders grouped choices with group labels', async () => {
		const { user, container } = renderField({
			choices: GROUPED,
			initialValue: [],
		})
		await user.click(container.querySelector('.dropdown-field-trigger')!)
		const list = getListbox()
		expect(within(list).getByText('Fruits')).toBeInTheDocument()
		expect(within(list).getByText('Veggies')).toBeInTheDocument()
		expect(within(list).getByText('Apple')).toBeInTheDocument()
		expect(within(list).getByText('Carrot')).toBeInTheDocument()
	})

	it('renders object-shaped (Record) choices', async () => {
		const { user, container } = renderField({
			choices: {
				a: { id: 'a', label: 'Alpha' },
				b: { id: 'b', label: 'Beta' },
			},
			initialValue: [],
		})
		await user.click(container.querySelector('.dropdown-field-trigger')!)
		const list = getListbox()
		expect(within(list).getByText('Alpha')).toBeInTheDocument()
		expect(within(list).getByText('Beta')).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('Selection', () => {
	it('calls setValue with the newly added id appended to the existing selection', async () => {
		const setValue = vi.fn()
		const { user, container } = renderField({ initialValue: ['apple'], setValue })
		await user.click(container.querySelector('.dropdown-field-trigger')!)
		await user.click(within(getListbox()).getByText('Banana'))
		expect(setValue).toHaveBeenCalledWith(expect.arrayContaining(['apple', 'banana']))
		expect(setValue).toHaveBeenCalledWith(expect.not.arrayContaining(['cherry']))
	})

	it('calls setValue without the id when clicking an already-selected option (toggle off)', async () => {
		const setValue = vi.fn()
		const { user, container } = renderField({ initialValue: ['apple', 'banana'], setValue })
		await user.click(container.querySelector('.dropdown-field-trigger')!)
		await user.click(within(getListbox()).getByText('Apple'))
		expect(setValue).toHaveBeenCalledWith(['banana'])
	})

	it('removes a value by clicking its pill remove button', async () => {
		const setValue = vi.fn()
		const { user } = renderField({ initialValue: ['apple', 'banana'], setValue })
		await user.click(screen.getByRole('button', { name: 'Remove Apple' }))
		expect(setValue).toHaveBeenCalledWith(['banana'])
	})

	it('adds multiple values building up the selection', async () => {
		const { user, container } = renderField({ initialValue: [] })
		await user.click(container.querySelector('.dropdown-field-trigger')!)
		await user.click(within(getListbox()).getByText('Cherry'))
		await user.click(within(getListbox()).getByText('Date'))
		expect(container.querySelectorAll('.dropdown-field-pill')).toHaveLength(2)
	})
})

// ---------------------------------------------------------------------------
// Fuzzy filtering
// ---------------------------------------------------------------------------

describe('Fuzzy filtering', () => {
	it('hides non-matching options when typing', async () => {
		const { user, input } = renderField({ initialValue: [] })
		await user.click(input)
		await user.type(input, 'ban')
		const list = getListbox()
		expect(within(list).getByText('Banana')).toBeInTheDocument()
		expect(within(list).queryByText('Apple')).toBeNull()
	})

	it('shows empty message when no options match', async () => {
		const { user, input } = renderField({ initialValue: [] })
		await user.click(input)
		await user.type(input, 'zzzzz')
		expect(screen.getByText('No options found.')).toBeInTheDocument()
	})

	it('shows custom noOptionsMessage when allowCustom=true and nothing matches regex', async () => {
		const { user, input } = renderField({ allowCustom: true, regex: '/^\\d+$/', initialValue: [] })
		await user.click(input)
		await user.type(input, 'zzzzz')
		expect(screen.getAllByText('Begin typing to use a custom value').length).toBeGreaterThan(0)
	})
})

// ---------------------------------------------------------------------------
// allowCustom — Create "X" synthetic item
// ---------------------------------------------------------------------------

describe('allowCustom', () => {
	it('shows a Create "X" synthetic item when typing a value not in choices', async () => {
		const { user, input } = renderField({ allowCustom: true, initialValue: [] })
		await user.click(input)
		await user.type(input, 'my-custom-val')
		expect(screen.getByText(/Create "my-custom-val"/)).toBeInTheDocument()
	})

	it('does not show Create "X" when input exactly matches an existing id', async () => {
		const { user, input } = renderField({ allowCustom: true, initialValue: [] })
		await user.click(input)
		await user.type(input, 'apple')
		expect(screen.queryByText(/Create "apple"/)).toBeNull()
	})

	it('adds the custom value to the selection when clicking the Create item', async () => {
		const setValue = vi.fn()
		const { user, input } = renderField({ allowCustom: true, initialValue: [], setValue })
		await user.click(input)
		await user.type(input, 'custom-value')
		await user.click(screen.getByText(/Create "custom-value"/))
		expect(setValue).toHaveBeenCalledWith(expect.arrayContaining(['custom-value']))
	})

	it('hides synthetic item when typed value fails regex', async () => {
		const { user, input } = renderField({ allowCustom: true, regex: '/^\\d+$/', initialValue: [] })
		await user.click(input)
		await user.type(input, 'notanumber')
		expect(screen.queryByText(/Create "notanumber"/)).toBeNull()
	})

	it('shows synthetic item when typed value passes regex', async () => {
		const { user, input } = renderField({ allowCustom: true, regex: '/^\\d+$/', initialValue: [] })
		await user.click(input)
		await user.type(input, '12345')
		expect(screen.getByText(/Create "12345"/)).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// minSelection / maxSelection constraints
// ---------------------------------------------------------------------------

describe('minSelection / maxSelection', () => {
	it('disables pill remove buttons when at minSelection', () => {
		renderField({ minSelection: 1, initialValue: ['apple'] })
		expect(screen.getByRole('button', { name: 'Remove Apple' })).toBeDisabled()
	})

	it('enables pill remove buttons when above minSelection', () => {
		renderField({ minSelection: 1, initialValue: ['apple', 'banana'] })
		expect(screen.getByRole('button', { name: 'Remove Apple' })).not.toBeDisabled()
	})

	it('does not call setValue when removing via the pill would go below minSelection', async () => {
		const setValue = vi.fn()
		const { user } = renderField({ minSelection: 1, initialValue: ['apple'], setValue })
		await user.click(screen.getByRole('button', { name: 'Remove Apple' }))
		expect(setValue).not.toHaveBeenCalled()
	})

	it('does not add items beyond maxSelection via the listbox', async () => {
		const setValue = vi.fn()
		const { user, container } = renderField({ maxSelection: 2, initialValue: ['apple', 'banana'], setValue })
		await user.click(container.querySelector('.dropdown-field-trigger')!)
		await user.click(within(getListbox()).getByText('Cherry'))
		expect(setValue).not.toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// onBlur callback
// ---------------------------------------------------------------------------

describe('onBlur callback', () => {
	it('calls onBlur when the input loses focus', async () => {
		const onBlur = vi.fn()
		const { user, input } = renderField({ onBlur })
		await user.click(input)
		await user.tab()
		expect(onBlur).toHaveBeenCalledTimes(1)
	})
})

// ---------------------------------------------------------------------------
// Grouped choices — interactions
// ---------------------------------------------------------------------------

describe('Grouped choices — interactions', () => {
	it('calls setValue with the correct id when selecting an item from inside a group', async () => {
		const setValue = vi.fn()
		const { user, container } = renderField({ choices: GROUPED, setValue, initialValue: [] })
		await user.click(container.querySelector('.dropdown-field-trigger')!)
		await user.click(within(getListbox()).getByText('Carrot'))
		expect(setValue).toHaveBeenCalledWith(['carrot'])
	})

	it('displays pills for values that live inside groups', () => {
		const { container } = renderField({ choices: GROUPED, initialValue: ['carrot', 'apple'] })
		const pillLabels = Array.from(container.querySelectorAll('.dropdown-field-pill-label')).map((el) => el.textContent)
		expect(pillLabels).toContain('Carrot')
		expect(pillLabels).toContain('Apple')
	})

	it('removes an entire group from the popup when none of its items match the filter', async () => {
		const { user, input } = renderField({ choices: GROUPED, initialValue: [] })
		await user.click(input)
		await user.type(input, 'appl')
		const list = getListbox()
		expect(within(list).queryByText('Veggies')).toBeNull()
	})

	it('keeps a group in the popup but hides non-matching items within it', async () => {
		const { user, input } = renderField({ choices: GROUPED, initialValue: [] })
		await user.click(input)
		await user.type(input, 'cel')
		const list = getListbox()
		expect(within(list).getByText('Celery')).toBeInTheDocument()
		expect(within(list).queryByText('Carrot')).toBeNull()
	})

	it('shows the Create "X" item when allowCustom=true and choices are all grouped', async () => {
		const { user, input } = renderField({
			choices: GROUPED,
			allowCustom: true,
			initialValue: [],
		})
		await user.click(input)
		await user.type(input, 'custom-grouped')
		expect(screen.getByText(/Create "custom-grouped"/)).toBeInTheDocument()
	})
})
