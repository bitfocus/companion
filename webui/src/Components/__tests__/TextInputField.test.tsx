import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { MenuPortalContext } from '../MenuPortalContext.js'
import { TextInputField } from '../TextInputField.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(variables: Array<{ connectionLabel: string; name: string; description: string }> = []) {
	return {
		variablesStore: {
			allVariableDefinitions: { get: () => variables },
		},
	} as unknown as RootAppStore
}

type Props = Parameters<typeof TextInputField>[0]

function ControlledField({
	initialValue = '',
	setValue: externalSetValue,
	store = makeStore(),
	...rest
}: Omit<Props, 'id' | 'value' | 'setValue'> & {
	initialValue?: string
	setValue?: (v: string) => void
	store?: RootAppStore
}) {
	const [value, setValue] = useState(initialValue)
	return (
		<MenuPortalContext.Provider value={document.body}>
			<RootAppStoreContext.Provider value={store}>
				<TextInputField
					{...rest}
					id={undefined}
					value={value}
					setValue={(v) => {
						setValue(v)
						externalSetValue?.(v)
					}}
				/>
			</RootAppStoreContext.Provider>
		</MenuPortalContext.Provider>
	)
}

function renderField(
	props: Omit<Props, 'id' | 'value' | 'setValue'> & {
		initialValue?: string
		setValue?: (v: string) => void
		store?: RootAppStore
	} = {}
) {
	const setValue = props.setValue ?? vi.fn()
	const user = userEvent.setup()
	const utils = render(<ControlledField {...props} setValue={setValue} />)
	return { ...utils, setValue, user }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('TextInputField', () => {
	describe('Rendering', () => {
		it('renders an input', () => {
			renderField()
			expect(screen.getByRole('textbox')).toBeInTheDocument()
		})

		it('displays the provided value', () => {
			renderField({ initialValue: 'hello world' })
			expect(screen.getByRole('textbox')).toHaveValue('hello world')
		})

		it('renders a textarea when multiline=true', () => {
			const { container } = renderField({ multiline: true })
			expect(container.querySelector('textarea')).toBeInTheDocument()
		})

		it('disables the input when disabled=true', () => {
			renderField({ disabled: true })
			expect(screen.getByRole('textbox')).toBeDisabled()
		})

		it('renders with placeholder', () => {
			renderField({ placeholder: 'Enter text...' })
			expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Enter text...')
		})

		it('applies invalid-value class when checkValid returns false', () => {
			const { container } = renderField({ initialValue: 'bad', checkValid: () => false })
			expect(container.querySelector('.invalid-value')).toBeInTheDocument()
		})

		it('does not apply invalid-value class when checkValid returns true', () => {
			const { container } = renderField({ initialValue: 'good', checkValid: () => true })
			expect(container.querySelector('.invalid-value')).toBeNull()
		})

		it('does not apply invalid-value class without checkValid', () => {
			const { container } = renderField({ initialValue: 'anything' })
			expect(container.querySelector('.invalid-value')).toBeNull()
		})
	})

	// ---------------------------------------------------------------------------
	// Value changes
	// ---------------------------------------------------------------------------

	describe('Value changes', () => {
		it('calls setValue when the user types', async () => {
			const setValue = vi.fn()
			const { user } = renderField({ setValue })
			await user.type(screen.getByRole('textbox'), 'abc')
			expect(setValue).toHaveBeenCalledWith('a')
			expect(setValue).toHaveBeenCalledWith('ab')
			expect(setValue).toHaveBeenCalledWith('abc')
		})

		it('reflects updated value after typing', async () => {
			const { user } = renderField({ initialValue: 'foo' })
			const input = screen.getByRole('textbox')
			await user.clear(input)
			await user.type(input, 'bar')
			expect(input).toHaveValue('bar')
		})
	})

	// ---------------------------------------------------------------------------
	// Callbacks
	// ---------------------------------------------------------------------------

	describe('Callbacks', () => {
		it('calls onBlur when the input loses focus', async () => {
			const onBlur = vi.fn()
			const { user } = renderField({ onBlur })
			await user.click(screen.getByRole('textbox'))
			await user.tab()
			expect(onBlur).toHaveBeenCalledOnce()
		})

		it('calls onKeyDown for non-picker keys', async () => {
			const onKeyDown = vi.fn()
			const { user } = renderField({ onKeyDown })
			await user.type(screen.getByRole('textbox'), 'a')
			// 'a' key should reach the passthrough handler
			expect(onKeyDown).toHaveBeenCalled()
		})

		it('does not call onKeyDown for Escape when picker would handle it', async () => {
			const onKeyDown = vi.fn()
			const store = makeStore([{ connectionLabel: 'internal', name: 'time_hms', description: 'Time HMS' }])
			const { user } = renderField({ useVariables: true, store, onKeyDown })
			const input = screen.getByRole('textbox')
			// open the picker
			await user.type(input, '$(')
			// Escape — should be consumed by the picker, not forwarded
			await user.keyboard('{Escape}')
			const escCalls = onKeyDown.mock.calls.filter((c) => c[0].code === 'Escape')
			expect(escCalls).toHaveLength(0)
		})
	})

	// ---------------------------------------------------------------------------
	// Variable picker
	// ---------------------------------------------------------------------------

	describe('Variable picker', () => {
		const VARS = [
			{ connectionLabel: 'internal', name: 'time_hms', description: 'Time HMS' },
			{ connectionLabel: 'internal', name: 'time_s', description: 'Time seconds' },
			{ connectionLabel: 'other', name: 'foo', description: 'Foo variable' },
		]

		it('does not show the picker without useVariables', async () => {
			const { user } = renderField({ initialValue: '' })
			await user.type(screen.getByRole('textbox'), '$(')
			expect(screen.queryByRole('option')).toBeNull()
		})

		it('shows the picker when $( is typed with useVariables=true', async () => {
			const store = makeStore(VARS)
			const { user } = renderField({ useVariables: true, store })
			await user.type(screen.getByRole('textbox'), '$(')
			expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
		})

		it('lists all variables initially', async () => {
			const store = makeStore(VARS)
			const { user } = renderField({ useVariables: true, store })
			await user.type(screen.getByRole('textbox'), '$(')
			const items = screen.getAllByRole('option')
			expect(items).toHaveLength(VARS.length)
		})

		it('filters variables by search text', async () => {
			const store = makeStore(VARS)
			const { user } = renderField({ useVariables: true, store })
			await user.type(screen.getByRole('textbox'), '$(time')
			const items = screen.getAllByRole('option')
			expect(items).toHaveLength(2) // time_hms and time_s
		})

		it('closes the picker on Escape', async () => {
			const store = makeStore(VARS)
			const { user } = renderField({ useVariables: true, store })
			await user.type(screen.getByRole('textbox'), '$(')
			expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
			await user.keyboard('{Escape}')
			await act(async () => {})
			expect(screen.queryByRole('option')).toBeNull()
		})

		it('ArrowDown moves focus to the next item', async () => {
			const store = makeStore(VARS)
			const { user } = renderField({ useVariables: true, store })
			await user.type(screen.getByRole('textbox'), '$(')
			await user.keyboard('{ArrowDown}')
			const items = screen.getAllByRole('option')
			// first item no longer highlighted, second item now highlighted
			expect(items[0]).not.toHaveAttribute('data-highlighted')
			expect(items[1]).toHaveAttribute('data-highlighted')
		})

		it('ArrowUp does not go below index 0', async () => {
			const store = makeStore(VARS)
			const { user } = renderField({ useVariables: true, store })
			await user.type(screen.getByRole('textbox'), '$(')
			await user.keyboard('{ArrowUp}')
			const items = screen.getAllByRole('option')
			expect(items[0]).toHaveAttribute('data-highlighted')
		})

		it('Enter selects the focused variable and inserts it', async () => {
			const setValue = vi.fn()
			const store = makeStore(VARS)
			const { user } = renderField({ useVariables: true, store, setValue })
			await user.type(screen.getByRole('textbox'), '$(')
			// first item is focused by default — press Enter
			await user.keyboard('{Enter}')
			expect(setValue).toHaveBeenLastCalledWith('$(internal:time_hms)')
		})

		it('clicking an option inserts the variable', async () => {
			const setValue = vi.fn()
			const store = makeStore(VARS)
			const { user } = renderField({ useVariables: true, store, setValue })
			await user.type(screen.getByRole('textbox'), '$(')
			const [firstOption] = screen.getAllByRole('option')
			await user.click(firstOption)
			expect(setValue).toHaveBeenLastCalledWith('$(internal:time_hms)')
		})

		it('includes localVariables in the suggestion list', async () => {
			const store = makeStore([])
			const localVariables = [{ value: 'local_val', label: 'Local Var' }]
			const { user } = renderField({ useVariables: true, store, localVariables })
			await user.type(screen.getByRole('textbox'), '$(')
			const items = screen.getAllByRole('option')
			expect(items).toHaveLength(1)
			expect(items[0]).toHaveTextContent('Local Var')
		})

		it('does not navigate ArrowDown when the list is empty', async () => {
			const store = makeStore([])
			const { user } = renderField({ useVariables: true, store })
			// type something that matches nothing
			await user.type(screen.getByRole('textbox'), '$(zzz_no_match')
			// should not throw
			await user.keyboard('{ArrowDown}')
		})

		it('ArrowDown does not go past the last item', async () => {
			const store = makeStore(VARS)
			const { user } = renderField({ useVariables: true, store })
			await user.type(screen.getByRole('textbox'), '$(')
			// VARS has 3 items; press down 4 times to overshoot
			await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')
			const items = screen.getAllByRole('option')
			expect(items[2]).toHaveAttribute('data-highlighted')
			expect(items[1]).not.toHaveAttribute('data-highlighted')
		})

		it('picker re-opens after being dismissed if $( is re-typed', async () => {
			const store = makeStore(VARS)
			const { user } = renderField({ useVariables: true, store })
			const input = screen.getByRole('textbox')
			await user.type(input, '$(')
			await user.keyboard('{Escape}')
			await act(async () => {})
			// remove the trigger text, then re-type it
			await user.clear(input)
			await user.type(input, '$(')
			expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
		})

		it('inserts a second variable after an existing one', async () => {
			const setValue = vi.fn()
			const store = makeStore(VARS)
			// pre-populate with a closed variable followed by a space
			const { user } = renderField({ useVariables: true, store, setValue, initialValue: '$(internal:time_hms) ' })
			const input = screen.getByRole('textbox')
			await user.click(input)
			await user.type(input, '$(')
			// picker should open for the second variable
			expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
			await user.keyboard('{Enter}')
			expect(setValue).toHaveBeenLastCalledWith('$(internal:time_hms) $(internal:time_hms)')
		})

		it('picker does not open when cursor is after a closed variable', async () => {
			const store = makeStore(VARS)
			// value is a fully closed variable — cursor lands after the ')' on click
			const { user } = renderField({ useVariables: true, store, initialValue: '$(internal:time_hms)' })
			await user.click(screen.getByRole('textbox'))
			expect(screen.queryByRole('option')).toBeNull()
		})
	})
})
