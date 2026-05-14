import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { DropdownChoicesOrGroups } from '../DropdownChoices.js'
import { MenuPortalContext } from '../MenuPortalContext.js'
import { VariablePickerField } from '../VariablePickerField.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHOICES = [
	{ id: 'connection:var_a', label: 'Variable A' },
	{ id: 'connection:var_b', label: 'Variable B' },
	{ id: 'connection:var_c', label: 'Variable C' },
	{ id: 'other:var_d', label: 'Variable D' },
	{ id: 'other:var_e', label: 'Variable E' },
]

interface RenderOptions {
	choices?: DropdownChoicesOrGroups
	allowCustom?: boolean
	regex?: string
	disabled?: boolean
}

function ControlledPicker({
	initialValue = 'connection:var_a',
	setValue: externalSetValue,
	...rest
}: RenderOptions & { initialValue?: string; setValue?: (v: string) => void }) {
	const [value, setValue] = useState<string>(initialValue)
	return (
		<MenuPortalContext.Provider value={document.body}>
			<VariablePickerField
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

function renderPicker(opts: RenderOptions & { initialValue?: string; setValue?: (v: string) => void } = {}) {
	const setValue = opts.setValue ?? vi.fn()
	const user = userEvent.setup()
	const utils = render(
		<ControlledPicker {...opts} setValue={setValue} initialValue={opts.initialValue ?? 'connection:var_a'} />
	)
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
	it('has a disabled input when disabled=true', () => {
		const { input } = renderPicker({ disabled: true })
		expect(input).toBeDisabled()
	})
})

// ---------------------------------------------------------------------------
// Popup open / close
// ---------------------------------------------------------------------------

describe('Popup open / close', () => {
	it('opens the listbox when clicking the chevron trigger', async () => {
		const { user } = renderPicker()
		await user.click(screen.getByRole('button'))
		expect(getListbox()).toBeInTheDocument()
	})

	it('closes the listbox when clicking the trigger a second time', async () => {
		const { user } = renderPicker()
		const trigger = screen.getByRole('button')
		await user.click(trigger)
		await user.click(trigger)
		expect(queryListbox()).toBeNull()
	})

	it('closes the listbox when pressing Escape', async () => {
		const { user } = renderPicker()
		await user.click(screen.getByRole('button'))
		expect(getListbox()).toBeInTheDocument()
		await user.keyboard('{Escape}')
		expect(queryListbox()).toBeNull()
	})

	it('shows all flat choices in the open popup', async () => {
		const { user } = renderPicker()
		await user.click(screen.getByRole('button'))
		const list = getListbox()
		for (const c of CHOICES) {
			expect(within(list).getByText(c.label)).toBeInTheDocument()
		}
	})

	it('renders grouped choices with group labels', async () => {
		const { user } = renderPicker({
			choices: [
				{ label: 'Group A', options: [{ id: 'ga:one', label: 'One' }] },
				{ label: 'Group B', options: [{ id: 'gb:two', label: 'Two' }] },
			],
			initialValue: 'ga:one',
		})
		await user.click(screen.getByRole('button'))
		const list = getListbox()
		expect(within(list).getByText('Group A')).toBeInTheDocument()
		expect(within(list).getByText('Group B')).toBeInTheDocument()
		expect(within(list).getByText('One')).toBeInTheDocument()
		expect(within(list).getByText('Two')).toBeInTheDocument()
	})

	it('renders object-shaped (Record) choices', async () => {
		const { user } = renderPicker({
			choices: {
				alpha: { id: 'ns:alpha', label: 'Alpha variable' },
				beta: { id: 'ns:beta', label: 'Beta variable' },
			},
			initialValue: 'ns:alpha',
		})
		await user.click(screen.getByRole('button'))
		const list = getListbox()
		expect(within(list).getByText('Alpha variable')).toBeInTheDocument()
		expect(within(list).getByText('Beta variable')).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('Selection', () => {
	it('calls setValue with the item id when clicking an option', async () => {
		const setValue = vi.fn()
		const { user } = renderPicker({ setValue })
		await user.click(screen.getByRole('button'))
		await user.click(within(getListbox()).getByText('Variable B'))
		expect(setValue).toHaveBeenCalledWith('connection:var_b')
	})

	it('selects an item via keyboard Arrow + Enter', async () => {
		const setValue = vi.fn()
		const { user, input } = renderPicker({ setValue })
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
		const { user, input } = renderPicker()
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'Variable B')
		const list = getListbox()
		expect(within(list).getByText('Variable B')).toBeInTheDocument()
		expect(within(list).queryByText('Variable A')).toBeNull()
	})

	it('searches by id (not just label)', async () => {
		// VPF always uses searchLabelsOnly=false, so typing an id fragment must work
		const { user, input } = renderPicker()
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'other:var_d')
		const list = getListbox()
		expect(within(list).getByText('Variable D')).toBeInTheDocument()
		expect(within(list).queryByText('Variable A')).toBeNull()
	})

	it('shows empty message when no options match', async () => {
		const { user, input } = renderPicker()
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'zzzzz')
		expect(screen.getByText('No options found.')).toBeInTheDocument()
	})

	it('shows custom noOptionsMessage when allowCustom + regex fails', async () => {
		const { user, input } = renderPicker({ allowCustom: true, regex: '/^\\d+$/' })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'zzzzz')
		expect(screen.getAllByText('Begin typing to use a custom value').length).toBeGreaterThan(0)
	})
})

// ---------------------------------------------------------------------------
// allowCustom=true (editing mode — isEditingMode is always true when allowCustom)
// ---------------------------------------------------------------------------

describe('allowCustom=true', () => {
	it('pre-fills the input with the raw id on focus', async () => {
		const { user, input } = renderPicker({ allowCustom: true, initialValue: 'connection:var_a' })
		await user.click(input)
		expect(input).toHaveValue('connection:var_a')
	})

	it('shows the Use "X" synthetic item when typing a value not in choices', async () => {
		const { user, input } = renderPicker({ allowCustom: true })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'my:custom-var')
		expect(screen.getByText(/Use "my:custom-var"/)).toBeInTheDocument()
	})

	it('does not show Use "X" when input exactly matches an existing id', async () => {
		const { user, input } = renderPicker({ allowCustom: true })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'connection:var_a')
		expect(screen.queryByText(/Use "connection:var_a"/)).toBeNull()
	})

	it('calls setValue with the typed text when selecting the synthetic item', async () => {
		const setValue = vi.fn()
		const { user, input } = renderPicker({ allowCustom: true, setValue })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'custom:value')
		await user.click(screen.getByText(/Use "custom:value"/))
		expect(setValue).toHaveBeenCalledWith('custom:value')
	})

	it('commits the typed text via setValue on blur (no selection made)', async () => {
		const setValue = vi.fn()
		const { user, input } = renderPicker({ allowCustom: true, setValue })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'blur:value')
		await user.tab()
		expect(setValue).toHaveBeenCalledWith('blur:value')
	})

	it('hides synthetic item when typed value fails regex', async () => {
		const { user, input } = renderPicker({ allowCustom: true, regex: '/^[\\w-]+:[\\w-]+$/' })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'not-valid-format')
		expect(screen.queryByText(/Use "not-valid-format"/)).toBeNull()
	})

	it('shows synthetic item when typed value passes regex', async () => {
		const { user, input } = renderPicker({ allowCustom: true, regex: '/^[\\w-]+:[\\w-]+$/' })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'ns:varname')
		expect(screen.getByText(/Use "ns:varname"/)).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Grouped choices — interactions
// ---------------------------------------------------------------------------

describe('Grouped choices — interactions', () => {
	const GROUPED = [
		{
			label: 'Group One',
			options: [
				{ id: 'g1:alpha', label: 'Alpha' },
				{ id: 'g1:apricot', label: 'Apricot' },
			],
		},
		{
			label: 'Group Two',
			options: [
				{ id: 'g2:carrot', label: 'Carrot' },
				{ id: 'g2:celery', label: 'Celery' },
			],
		},
	]

	it('calls setValue with the correct id when selecting an item from inside a group', async () => {
		const setValue = vi.fn()
		const { user } = renderPicker({ choices: GROUPED, setValue, initialValue: 'g1:alpha' })
		await user.click(screen.getByRole('button'))
		await user.click(within(getListbox()).getByText('Carrot'))
		expect(setValue).toHaveBeenCalledWith('g2:carrot')
	})

	it('removes an entire group from the popup when none of its items match the filter', async () => {
		const { user, input } = renderPicker({ choices: GROUPED, initialValue: 'g1:alpha' })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'Alph')
		const list = getListbox()
		expect(within(list).queryByText('Group Two')).toBeNull()
	})

	it('keeps a group in the popup but hides non-matching items within it', async () => {
		const { user, input } = renderPicker({ choices: GROUPED, initialValue: 'g1:alpha' })
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'Celery')
		const list = getListbox()
		expect(within(list).getByText('Celery')).toBeInTheDocument()
		expect(within(list).queryByText('Carrot')).toBeNull()
	})

	it('still shows the synthetic "Use X" item when allowCustom=true and choices are all grouped', async () => {
		const { user, input } = renderPicker({
			choices: GROUPED,
			allowCustom: true,
			initialValue: 'g1:alpha',
		})
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'custom:grouped')
		expect(screen.getByText(/Use "custom:grouped"/)).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// onPasteIntercept
// ---------------------------------------------------------------------------

describe('onPasteIntercept', () => {
	it('transforms pasted text using onPasteIntercept', async () => {
		const setValue = vi.fn()
		const user = userEvent.setup()
		render(
			<MenuPortalContext.Provider value={document.body}>
				<VariablePickerField
					choices={CHOICES}
					value="connection:var_a"
					setValue={setValue}
					allowCustom
					onPasteIntercept={(v) => v.toUpperCase()}
				/>
			</MenuPortalContext.Provider>
		)
		const input = screen.getByRole('combobox')
		await user.click(input)
		await user.clear(input)
		await user.paste('hello')
		// The intercept uppercases the value, so the synthetic item should show the transformed string
		expect(screen.getByText(/Use "HELLO"/)).toBeInTheDocument()
	})

	it('does not double-fire when onPasteIntercept returns unchanged value', async () => {
		const onPasteIntercept = vi.fn((v: string) => v)
		const user = userEvent.setup()
		render(
			<MenuPortalContext.Provider value={document.body}>
				<VariablePickerField
					choices={CHOICES}
					value="connection:var_a"
					setValue={vi.fn()}
					allowCustom
					onPasteIntercept={onPasteIntercept}
				/>
			</MenuPortalContext.Provider>
		)
		const input = screen.getByRole('combobox')
		await user.click(input)
		await user.clear(input)
		await user.paste('connection:var_a')
		expect(onPasteIntercept).toHaveBeenCalledTimes(1)
	})
})

// ---------------------------------------------------------------------------
// Fancy two-line format
// ---------------------------------------------------------------------------

describe('VariablePickerField — fancy format', () => {
	const fancyChoices: DropdownChoicesOrGroups = [
		{ id: 'internal:time_hms', label: 'Current time (HH:MM:SS)' },
		{ id: 'internal:date_y', label: 'Current year' },
	]

	it('renders two lines per item: var-name (id) and var-label (label)', async () => {
		const user = userEvent.setup()
		render(
			<MenuPortalContext.Provider value={document.body}>
				<VariablePickerField choices={fancyChoices} value="internal:time_hms" setValue={vi.fn()} />
			</MenuPortalContext.Provider>
		)
		await user.click(screen.getByRole('button'))
		const list = getListbox()
		expect(list.querySelector('.var-name')).toBeInTheDocument()
		expect(list.querySelector('.var-label')).toBeInTheDocument()
	})

	it('searches both id and label', async () => {
		const user = userEvent.setup()
		render(
			<MenuPortalContext.Provider value={document.body}>
				<VariablePickerField choices={fancyChoices} value="internal:time_hms" setValue={vi.fn()} />
			</MenuPortalContext.Provider>
		)
		const input = screen.getByRole('combobox')
		await user.click(input)
		await user.clear(input)
		await user.type(input, 'internal:date')
		const list = getListbox()
		expect(within(list).getByText('Current year')).toBeInTheDocument()
		expect(within(list).queryByText('Current time (HH:MM:SS)')).toBeNull()
	})
})
