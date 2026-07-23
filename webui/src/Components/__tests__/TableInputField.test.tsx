import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { JsonValue } from 'type-fest'
import { describe, expect, it, vi } from 'vitest'
import type { InternalInputFieldTable } from '@companion-app/shared/Model/Options.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { MenuPortalContext } from '../MenuPortalContext.js'
import { TableInputField } from '../TableInputField.js'

const mockStore: Partial<RootAppStore> = {
	variablesStore: {
		allVariableDefinitions: { get: () => [] },
	} as unknown as RootAppStore['variablesStore'],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const definition: InternalInputFieldTable = {
	id: 'test',
	type: 'internal:table',
	label: 'Test Table',
	columns: [
		{ id: 'value', type: 'number', label: 'Value', min: 0, max: 100, step: 1, default: 0 },
		{ id: 'color', type: 'colorpicker', label: 'Color', default: 0x00ff00, enableAlpha: false, returnType: 'number' },
	],
	default: [],
}

const textDefinition: InternalInputFieldTable = {
	id: 'test',
	type: 'internal:table',
	label: 'Test Table',
	columns: [
		{ id: 'pos', type: 'number', label: 'Position', min: 0, max: 100, step: 1, default: 0 },
		{ id: 'label', type: 'textinput', label: 'Label', default: '' },
	],
	default: [],
}

function Controlled({
	definition: def,
	initialValue,
	setValue: externalSetValue,
	disabled,
}: {
	definition: InternalInputFieldTable
	initialValue: Record<string, JsonValue>[]
	setValue?: (rows: Record<string, JsonValue>[]) => void
	disabled?: boolean
}) {
	const [value, setValue] = useState(initialValue)
	return (
		<RootAppStoreContext.Provider value={mockStore as RootAppStore}>
			<MenuPortalContext.Provider value={document.body}>
				<TableInputField
					definition={def}
					value={value}
					setValue={(rows) => {
						setValue(rows)
						externalSetValue?.(rows)
					}}
					disabled={disabled}
					localVariablesStore={null}
					entityType={null}
					isLocatedInGrid={false}
				/>
			</MenuPortalContext.Provider>
		</RootAppStoreContext.Provider>
	)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TableInputField', () => {
	describe('Rendering', () => {
		it('renders column headers', () => {
			render(<Controlled definition={definition} initialValue={[]} />)
			// No rows, no table rendered, but after adding a row headers appear
		})

		it('renders column headers when rows are present', () => {
			render(<Controlled definition={definition} initialValue={[{ value: 50, color: 0x00ff00 }]} />)
			expect(screen.getByText('Value')).toBeInTheDocument()
			expect(screen.getByText('Color')).toBeInTheDocument()
		})

		it('renders the add button', () => {
			render(<Controlled definition={definition} initialValue={[]} />)
			expect(screen.getByRole('button', { name: /add row/i })).toBeInTheDocument()
		})

		it('renders a number input for each number column cell', () => {
			render(<Controlled definition={definition} initialValue={[{ value: 42, color: 0x00ff00 }]} />)
			const input = screen.getByRole('textbox')
			expect(input).toHaveValue('42')
		})

		it('renders a text input for textinput column cells', () => {
			render(<Controlled definition={textDefinition} initialValue={[{ pos: 10, label: 'hello' }]} />)
			const inputs = screen.getAllByRole('textbox')
			expect(inputs.some((i) => (i as HTMLInputElement).value === 'hello')).toBe(true)
		})

		it('renders a delete button per row', () => {
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: 0, color: 0 },
						{ value: 50, color: 0 },
					]}
				/>
			)
			expect(screen.getAllByTitle('Remove row')).toHaveLength(2)
		})

		it('shows no table when value is empty', () => {
			const { container } = render(<Controlled definition={definition} initialValue={[]} />)
			expect(container.querySelector('table')).toBeNull()
		})

		it('shows a table when rows are present', () => {
			const { container } = render(<Controlled definition={definition} initialValue={[{ value: 0, color: 0 }]} />)
			expect(container.querySelector('table')).toBeInTheDocument()
		})
	})

	describe('Row sorting', () => {
		it('sorts rows ascending by the first numeric column', () => {
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: 85, color: 0xff0000 },
						{ value: 0, color: 0x00ff00 },
						{ value: 66, color: 0xffff00 },
					]}
				/>
			)
			const inputs = screen.getAllByRole<HTMLInputElement>('textbox')
			expect(inputs.map((i) => i.value)).toEqual(['0', '66', '85'])
		})
	})

	describe('Add row', () => {
		it('calls setValue with a new row appended using column defaults', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(<Controlled definition={definition} initialValue={[]} setValue={setValue} />)

			await user.click(screen.getByRole('button', { name: /add row/i }))

			expect(setValue).toHaveBeenCalledOnce()
			const [rows] = setValue.mock.calls[0]
			expect(rows).toHaveLength(1)
			expect(rows[0]).toMatchObject({ value: 0, color: 0x00ff00 })
		})

		it('appends to existing rows', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(<Controlled definition={definition} initialValue={[{ value: 50, color: 0 }]} setValue={setValue} />)

			await user.click(screen.getByRole('button', { name: /add row/i }))

			const [rows] = setValue.mock.calls[0]
			expect(rows).toHaveLength(2)
		})
	})

	describe('Remove row', () => {
		it('calls setValue with the row removed', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: 0, color: 0x00ff00 },
						{ value: 66, color: 0xffff00 },
					]}
					setValue={setValue}
				/>
			)

			await user.click(screen.getAllByTitle('Remove row')[0])

			const [rows] = setValue.mock.calls[0]
			expect(rows).toHaveLength(1)
		})

		it('removes the correct row (sorted order)', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: 66, color: 0xffff00 },
						{ value: 0, color: 0x00ff00 },
					]}
					setValue={setValue}
				/>
			)

			// After sorting, row[0] is value=0. Delete it.
			await user.click(screen.getAllByTitle('Remove row')[0])

			const [rows] = setValue.mock.calls[0]
			expect(rows).toHaveLength(1)
			expect(rows[0]).toMatchObject({ value: 66, color: 0xffff00 })
		})
	})

	describe('Cell value changes', () => {
		it('calls setValue with updated number cell value', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(
				<Controlled definition={textDefinition} initialValue={[{ pos: 10, label: 'hello' }]} setValue={setValue} />
			)

			const textInput = screen
				.getAllByRole('textbox')
				.find((i) => (i as HTMLInputElement).value === 'hello') as HTMLElement

			await user.clear(textInput)
			await user.type(textInput, 'world')
			await user.tab()

			const [rows] = setValue.mock.lastCall!
			expect(rows[0].label).toBe('world')
		})
	})

	describe('Disabled state', () => {
		it('disables the add row button', () => {
			render(<Controlled definition={definition} initialValue={[]} disabled />)
			expect(screen.getByRole('button', { name: /add row/i })).toBeDisabled()
		})

		it('disables delete buttons', () => {
			render(<Controlled definition={definition} initialValue={[{ value: 0, color: 0 }]} disabled />)
			expect(screen.getByTitle('Remove row')).toBeDisabled()
		})

		it('disables cell number inputs', () => {
			render(<Controlled definition={textDefinition} initialValue={[{ pos: 10, label: 'hi' }]} disabled />)
			for (const input of screen.getAllByRole('textbox')) {
				expect(input).toBeDisabled()
			}
		})
	})
})
