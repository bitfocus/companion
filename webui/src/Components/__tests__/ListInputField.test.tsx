import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { JsonValue } from 'type-fest'
import { describe, expect, it, vi } from 'vitest'
import type { ExpressionOrValue, InternalInputFieldList } from '@companion-app/shared/Model/Options.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { ListInputField, type ListInputFieldProps } from '../ListInputField.js'
import { MenuPortalContext } from '../MenuPortalContext.js'

const mockStore: Partial<RootAppStore> = {
	variablesStore: {
		allVariableDefinitions: { get: () => [] },
	} as unknown as RootAppStore['variablesStore'],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const definition: InternalInputFieldList = {
	id: 'test',
	type: 'internal:list',
	label: 'Colour thresholds',
	tooltip: 'Define colour stops.',
	addLabel: 'Add threshold',
	fields: [
		{ id: 'value', type: 'number', label: 'Value', min: 0, max: 100, step: 1, default: 0 },
		{ id: 'color', type: 'colorpicker', label: 'Colour', default: 0x00ff00, enableAlpha: false, returnType: 'number' },
	],
	default: [],
}

const textDefinition: InternalInputFieldList = {
	id: 'test',
	type: 'internal:list',
	label: 'Labels',
	addLabel: 'Add label',
	fields: [
		{ id: 'pos', type: 'number', label: 'Position', min: 0, max: 100, step: 1, default: 0 },
		{ id: 'label', type: 'textinput', label: 'Text', default: '' },
	],
	default: [],
}

const val = <T extends JsonValue>(v: T): ExpressionOrValue<T> => ({ isExpression: false, value: v })

type Rows = Record<string, ExpressionOrValue<JsonValue>>[]

const defaultProps: Omit<ListInputFieldProps, 'definition' | 'value' | 'setValue'> = {
	disabled: false,
	localVariablesStore: null,
	entityType: null,
	isLocatedInGrid: false,
	fieldSupportsExpression: false,
}

function Controlled({
	definition: def,
	initialValue,
	setValue: externalSetValue,
	...rest
}: {
	definition: InternalInputFieldList
	initialValue: Rows
	setValue?: (rows: Rows) => void
} & Partial<Omit<ListInputFieldProps, 'definition' | 'value' | 'setValue'>>) {
	const [value, setValue] = useState(initialValue)
	return (
		<RootAppStoreContext.Provider value={mockStore as RootAppStore}>
			<MenuPortalContext.Provider value={document.body}>
				<div className="row g-2">
					<ListInputField
						{...defaultProps}
						{...rest}
						definition={def}
						value={value}
						setValue={(rows) => {
							setValue(rows)
							externalSetValue?.(rows)
						}}
					/>
				</div>
			</MenuPortalContext.Provider>
		</RootAppStoreContext.Provider>
	)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListInputField', () => {
	describe('Rendering', () => {
		it('renders the field label', () => {
			render(<Controlled definition={definition} initialValue={[]} />)
			expect(screen.getByText('Colour thresholds')).toBeInTheDocument()
		})

		it('renders a custom add label', () => {
			render(<Controlled definition={definition} initialValue={[]} />)
			expect(screen.getByRole('button', { name: /add threshold/i })).toBeInTheDocument()
		})

		it('renders "Add item" when no addLabel is set', () => {
			const def: InternalInputFieldList = { ...definition, addLabel: undefined }
			render(<Controlled definition={def} initialValue={[]} />)
			expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument()
		})

		it('renders an item separator for each row', () => {
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: val(0), color: val(0x00ff00) },
						{ value: val(66), color: val(0xffff00) },
					]}
				/>
			)
			expect(screen.getByText('Item 1')).toBeInTheDocument()
			expect(screen.getByText('Item 2')).toBeInTheDocument()
		})

		it('renders the field labels for each item', () => {
			render(<Controlled definition={definition} initialValue={[{ value: val(50), color: val(0x00ff00) }]} />)
			expect(screen.getByText('Value')).toBeInTheDocument()
			expect(screen.getByText('Colour')).toBeInTheDocument()
		})

		it('renders up/down/delete buttons per item', () => {
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: val(0), color: val(0) },
						{ value: val(50), color: val(0) },
					]}
				/>
			)
			expect(screen.getAllByTitle('Move up')).toHaveLength(2)
			expect(screen.getAllByTitle('Move down')).toHaveLength(2)
			expect(screen.getAllByTitle('Remove item')).toHaveLength(2)
		})

		it('renders number inputs for number fields', () => {
			render(<Controlled definition={textDefinition} initialValue={[{ pos: val(42), label: val('hello') }]} />)
			const inputs = screen.getAllByRole<HTMLInputElement>('textbox')
			expect(inputs.some((i) => i.value === '42')).toBe(true)
			expect(inputs.some((i) => i.value === 'hello')).toBe(true)
		})
	})

	describe('Add item', () => {
		it('calls setValue with a new row appended using field defaults', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(<Controlled definition={definition} initialValue={[]} setValue={setValue} />)

			await user.click(screen.getByRole('button', { name: /add threshold/i }))

			expect(setValue).toHaveBeenCalledOnce()
			const [rows] = setValue.mock.calls[0]
			expect(rows).toHaveLength(1)
			expect(rows[0]).toMatchObject({
				value: val(0),
				color: val(0x00ff00),
			})
		})

		it('appends to existing rows', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(
				<Controlled definition={definition} initialValue={[{ value: val(50), color: val(0) }]} setValue={setValue} />
			)

			await user.click(screen.getByRole('button', { name: /add threshold/i }))

			const [rows] = setValue.mock.calls[0]
			expect(rows).toHaveLength(2)
			expect(rows[0]).toMatchObject({ value: val(50) })
		})
	})

	describe('Remove item', () => {
		it('calls setValue with the item removed', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: val(0), color: val(0x00ff00) },
						{ value: val(66), color: val(0xffff00) },
					]}
					setValue={setValue}
				/>
			)

			await user.click(screen.getAllByTitle('Remove item')[0])

			const [rows] = setValue.mock.calls[0]
			expect(rows).toHaveLength(1)
			expect(rows[0]).toMatchObject({ value: val(66) })
		})

		it('removes the second item when the second delete is clicked', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: val(0), color: val(0x00ff00) },
						{ value: val(66), color: val(0xffff00) },
					]}
					setValue={setValue}
				/>
			)

			await user.click(screen.getAllByTitle('Remove item')[1])

			const [rows] = setValue.mock.calls[0]
			expect(rows).toHaveLength(1)
			expect(rows[0]).toMatchObject({ value: val(0) })
		})
	})

	describe('Reordering', () => {
		it('move up swaps the item with the one above it', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: val(0), color: val(0) },
						{ value: val(66), color: val(0) },
						{ value: val(85), color: val(0) },
					]}
					setValue={setValue}
				/>
			)

			// Click "Move up" on Item 2 (index 1)
			await user.click(screen.getAllByTitle('Move up')[1])

			const [rows] = setValue.mock.calls[0]
			expect(rows[0]).toMatchObject({ value: val(66) })
			expect(rows[1]).toMatchObject({ value: val(0) })
			expect(rows[2]).toMatchObject({ value: val(85) })
		})

		it('move down swaps the item with the one below it', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: val(0), color: val(0) },
						{ value: val(66), color: val(0) },
						{ value: val(85), color: val(0) },
					]}
					setValue={setValue}
				/>
			)

			// Click "Move down" on Item 2 (index 1)
			await user.click(screen.getAllByTitle('Move down')[1])

			const [rows] = setValue.mock.calls[0]
			expect(rows[0]).toMatchObject({ value: val(0) })
			expect(rows[1]).toMatchObject({ value: val(85) })
			expect(rows[2]).toMatchObject({ value: val(66) })
		})

		it('move up is disabled for the first item', () => {
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: val(0), color: val(0) },
						{ value: val(66), color: val(0) },
					]}
				/>
			)
			const moveUpButtons = screen.getAllByTitle('Move up')
			expect(moveUpButtons[0]).toBeDisabled()
			expect(moveUpButtons[1]).not.toBeDisabled()
		})

		it('move down is disabled for the last item', () => {
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: val(0), color: val(0) },
						{ value: val(66), color: val(0) },
					]}
				/>
			)
			const moveDownButtons = screen.getAllByTitle('Move down')
			expect(moveDownButtons[0]).not.toBeDisabled()
			expect(moveDownButtons[1]).toBeDisabled()
		})
	})

	describe('minItems', () => {
		it('disables remove button when at the minimum item count', () => {
			const def: InternalInputFieldList = { ...definition, minItems: 1 }
			render(<Controlled definition={def} initialValue={[{ value: val(0), color: val(0) }]} />)
			expect(screen.getByTitle('Remove item')).toBeDisabled()
		})

		it('enables remove button when above the minimum item count', () => {
			const def: InternalInputFieldList = { ...definition, minItems: 1 }
			render(
				<Controlled
					definition={def}
					initialValue={[
						{ value: val(0), color: val(0) },
						{ value: val(50), color: val(0) },
					]}
				/>
			)
			for (const btn of screen.getAllByTitle('Remove item')) {
				expect(btn).not.toBeDisabled()
			}
		})

		it('disables remove button when below the minimum item count', () => {
			const def: InternalInputFieldList = { ...definition, minItems: 2 }
			render(<Controlled definition={def} initialValue={[{ value: val(0), color: val(0) }]} />)
			expect(screen.getByTitle('Remove item')).toBeDisabled()
		})
	})

	describe('Disabled state', () => {
		it('disables the add button', () => {
			render(<Controlled definition={definition} initialValue={[]} disabled />)
			expect(screen.getByRole('button', { name: /add threshold/i })).toBeDisabled()
		})

		it('disables all item control buttons', () => {
			render(
				<Controlled
					definition={definition}
					initialValue={[
						{ value: val(0), color: val(0) },
						{ value: val(50), color: val(0) },
					]}
					disabled
				/>
			)
			for (const btn of screen.getAllByTitle(/Move up|Move down|Remove item/)) {
				expect(btn).toBeDisabled()
			}
		})

		it('disables cell inputs', () => {
			render(<Controlled definition={textDefinition} initialValue={[{ pos: val(10), label: val('hi') }]} disabled />)
			for (const input of screen.getAllByRole('textbox')) {
				expect(input).toBeDisabled()
			}
		})
	})

	describe('Expression toggle', () => {
		it('does not render expression toggle buttons when fieldSupportsExpression is false', () => {
			render(
				<Controlled
					definition={definition}
					initialValue={[{ value: val(50), color: val(0x00ff00) }]}
					fieldSupportsExpression={false}
				/>
			)
			expect(screen.queryByRole('button', { name: /expression mode|value mode/i })).toBeNull()
		})

		it('renders expression toggle buttons for each field when fieldSupportsExpression is true', () => {
			render(
				<Controlled
					definition={definition}
					initialValue={[{ value: val(50), color: val(0x00ff00) }]}
					fieldSupportsExpression={true}
				/>
			)
			// Two fields per item, so two toggle buttons
			expect(screen.getAllByRole('button', { name: /expression mode|value mode/i })).toHaveLength(2)
		})

		it('calls setValue with an expression cell when the toggle is activated', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(
				<Controlled
					definition={textDefinition}
					initialValue={[{ pos: val(10), label: val('hi') }]}
					setValue={setValue}
					fieldSupportsExpression={true}
				/>
			)

			// Toggle the first field (Position) to expression mode
			await user.click(screen.getAllByRole('button', { name: /switch to expression mode/i })[0])

			const [rows] = setValue.mock.lastCall!
			expect(rows[0].pos).toMatchObject({ isExpression: true })
		})
	})

	describe('Visibility', () => {
		it('hides content with displayNone class when visibility is false', () => {
			const { container } = render(<Controlled definition={definition} initialValue={[]} visibility={false} />)
			const hidden = container.querySelectorAll('.displayNone')
			expect(hidden.length).toBeGreaterThan(0)
		})

		it('shows content normally when visibility is true', () => {
			const { container } = render(<Controlled definition={definition} initialValue={[]} visibility={true} />)
			expect(container.querySelectorAll('.displayNone')).toHaveLength(0)
		})
	})

	describe('Cell value updates', () => {
		it('calls setValue with updated cell wrapped in ExpressionOrValue when a text cell changes', async () => {
			const setValue = vi.fn()
			const user = userEvent.setup()
			render(
				<Controlled
					definition={textDefinition}
					initialValue={[{ pos: val(10), label: val('hello') }]}
					setValue={setValue}
				/>
			)

			const textInput = screen
				.getAllByRole('textbox')
				.find((i) => (i as HTMLInputElement).value === 'hello') as HTMLElement

			await user.clear(textInput)
			await user.type(textInput, 'world')
			await user.tab()

			const [rows] = setValue.mock.lastCall!
			expect(rows[0].label).toEqual(val('world'))
		})
	})
})
