import { faDollarSign, faGlobe, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { JsonValue } from 'type-fest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	CompanionFieldVariablesSupport,
	DEFAULT_COLOR_EXPRESSION_DESCRIPTION,
	type ExpressionableOptionsObject,
	type ExpressionOrValue,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { Grid } from '~/Components/Grid.js'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { EntityEditorContextProvider } from '../Components/EntityEditorContext.js'
import { EntityListActionContext } from '../LocalVariablesStore.js'

// Stub out the heavy children (Monaco editor, tRPC-backed preview, the per-type controls) and capture their props,
// so these tests cover only the wrapping logic of OptionsInputField itself.
const captured = vi.hoisted(() => ({
	control: [] as any[],
	expressionInput: [] as any[],
	preview: [] as any[],
	list: [] as any[],
	table: [] as any[],
}))

vi.mock('../OptionsInputControl.js', () => ({
	OptionsInputControl: (props: any) => {
		captured.control.push(props)
		return (
			<button type="button" data-testid="control" disabled={!!props.readonly} onClick={() => props.setValue('new')}>
				control:{String(props.value)}
			</button>
		)
	},
}))

vi.mock('~/Components/ExpressionInputField.js', () => ({
	ExpressionInputField: (props: any) => {
		captured.expressionInput.push(props)
		return <div data-testid="expression-input">{props.value}</div>
	},
}))

vi.mock('~/Components/ExpressionValuePreview.js', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	ExpressionValuePreview: (props: any) => {
		captured.preview.push(props)
		return <span data-testid="expression-preview" />
	},
}))

vi.mock('~/Components/ListInputField.js', () => ({
	ListInputField: (props: any) => {
		captured.list.push(props)
		return <button type="button" data-testid="list" onClick={() => props.setValue([{ a: 1 }])} />
	},
}))

vi.mock('~/Components/TableInputField.js', () => ({
	TableInputField: (props: any) => {
		captured.table.push(props)
		return <button type="button" data-testid="table" onClick={() => props.setValue([{ b: 2 }])} />
	},
}))

const { OptionsInputField } = await import('../OptionsInputField.js')

const mockStore: Partial<RootAppStore> = {
	variablesStore: {
		allVariableDefinitions: { get: () => [] },
	} as unknown as RootAppStore['variablesStore'],
}

interface RenderOptions {
	value?: ExpressionOrValue<JsonValue | undefined>
	fieldSupportsExpression?: boolean
	visibility?: boolean
	readonly?: boolean
	controlId?: string | null
	allRawOptions?: ExpressionableOptionsObject
	previewStatusOnly?: boolean
}

function renderField(option: SomeCompanionInputField, opts: RenderOptions = {}) {
	const setValue = vi.fn()

	let field = (
		<OptionsInputField
			allowInternalFields={false}
			controlId={opts.controlId}
			isLocatedInGrid={false}
			entityType={null}
			option={option}
			value={opts.value}
			setValue={setValue}
			visibility={opts.visibility ?? true}
			readonly={opts.readonly}
			localVariablesStore={null}
			fieldSupportsExpression={opts.fieldSupportsExpression ?? false}
			allRawOptions={opts.allRawOptions}
		/>
	)
	if (opts.previewStatusOnly !== undefined) {
		field = (
			<EntityEditorContextProvider
				controlId="bank:1"
				location={undefined}
				serviceFactory={{} as any}
				readonly={false}
				localVariablesStore={null}
				localVariablePrefix={null}
				previewStatusOnly={opts.previewStatusOnly}
				actionContext={EntityListActionContext.NotActions}
			>
				{field}
			</EntityEditorContextProvider>
		)
	}

	const result = render(
		<RootAppStoreContext.Provider value={mockStore as RootAppStore}>
			<MenuPortalContext.Provider value={document.body}>
				<Grid.Row>{field}</Grid.Row>
			</MenuPortalContext.Provider>
		</RootAppStoreContext.Provider>
	)
	return { ...result, setValue }
}

const textOption: SomeCompanionInputField = { id: 'text', type: 'textinput', label: 'Text', default: '' }

const val = <T extends JsonValue>(value: T): ExpressionOrValue<T> => ({ isExpression: false, value })
const expr = (value: string): ExpressionOrValue<string> => ({ isExpression: true, value })

const toggleName = /expression mode|value mode/i

function hasIcon(container: HTMLElement, icon: { iconName: string }): boolean {
	return container.querySelector(`svg[data-icon="${icon.iconName}"]`) !== null
}

beforeEach(() => {
	for (const list of Object.values(captured)) list.length = 0
})

describe('OptionsInputField', () => {
	describe('Rendering', () => {
		it('renders the label linked to the control', () => {
			renderField(textOption)
			const label = screen.getByText('Text')
			expect(label.tagName).toBe('LABEL')
			expect(label).toHaveAttribute('for', captured.control[0].inputId)
		})

		it('renders a help icon only when the option has a tooltip', () => {
			const { container, unmount } = renderField(textOption)
			expect(hasIcon(container, faQuestionCircle)).toBe(false)
			unmount()

			const { container: withTooltip } = renderField({ ...textOption, tooltip: 'Some help' })
			expect(hasIcon(withTooltip, faQuestionCircle)).toBe(true)
		})

		it('renders the description below the control', () => {
			renderField({ ...textOption, description: 'Describes the field' })
			expect(screen.getByText('Describes the field')).toHaveClass('form-text')
		})

		it('renders the variable feature icons of a textinput', () => {
			const { container } = renderField({ ...textOption, useVariables: CompanionFieldVariablesSupport.InternalParser })
			expect(hasIcon(container, faDollarSign)).toBe(true)
			expect(hasIcon(container, faGlobe)).toBe(true)
		})

		it('renders no feature icons for a plain field', () => {
			const { container } = renderField(textOption)
			expect(hasIcon(container, faDollarSign)).toBe(false)
			expect(hasIcon(container, faGlobe)).toBe(false)
		})

		it('hides the label and control when not visible', () => {
			renderField(textOption, { visibility: false })
			expect(screen.getByText('Text')).toHaveClass('hidden')
			expect(screen.getByTestId('control').parentElement).toHaveClass('hidden')
		})

		it('does not render an expression preview in value mode', () => {
			renderField(textOption, { value: val('abc'), fieldSupportsExpression: true })
			expect(screen.queryByTestId('expression-preview')).toBeNull()
		})
	})

	describe('Control', () => {
		it('passes the unwrapped value, option, features and readonly to the control', () => {
			const option = { ...textOption, useVariables: CompanionFieldVariablesSupport.InternalParser }
			renderField(option, { value: val('abc'), readonly: true })
			const props = captured.control.at(-1)
			expect(props.value).toBe('abc')
			expect(props.option).toBe(option)
			expect(props.features).toEqual({ variables: true, local: true })
			expect(props.readonly).toBe(true)
		})

		it('wraps a value set by the control as a plain value', async () => {
			const { setValue } = renderField(textOption, { value: val('abc') })
			await userEvent.click(screen.getByTestId('control'))
			expect(setValue).toHaveBeenCalledWith('text', { isExpression: false, value: 'new' })
		})

		it('wraps a value set by an expression-type control as an expression', async () => {
			const { setValue } = renderField(
				{ id: 'calc', type: 'expression', label: 'Calc' },
				{ value: expr('1 + 1'), fieldSupportsExpression: true }
			)
			await userEvent.click(screen.getByTestId('control'))
			expect(setValue).toHaveBeenCalledWith('calc', { isExpression: true, value: 'new' })
		})
	})

	describe('Expression toggle', () => {
		it('does not render a toggle when the field does not support expressions', () => {
			renderField(textOption, { fieldSupportsExpression: false })
			expect(screen.getByTestId('control')).toBeInTheDocument()
			expect(screen.queryByRole('button', { name: toggleName })).toBeNull()
		})

		it('renders a toggle around the control when the field supports expressions', () => {
			renderField(textOption, { fieldSupportsExpression: true })
			expect(screen.getByTestId('control')).toBeInTheDocument()
			expect(screen.getByRole('button', { name: /switch to expression mode/i })).toBeInTheDocument()
		})

		it('does not render a toggle for an expression-type field', () => {
			renderField({ id: 'calc', type: 'expression', label: 'Calc' }, { fieldSupportsExpression: true })
			expect(screen.queryByRole('button', { name: toggleName })).toBeNull()
		})

		it('does not render a toggle for a static-text field', () => {
			renderField(
				{ id: 'note', type: 'static-text', label: 'Attention', value: 'Read me' },
				{ fieldSupportsExpression: true }
			)
			expect(screen.queryByRole('button', { name: toggleName })).toBeNull()
		})

		it('switches to expression mode, keeping the current value as the expression', async () => {
			const { setValue } = renderField(
				{ id: 'num', type: 'number', label: 'Num', default: 0, min: 0, max: 10 },
				{
					value: val(5),
					fieldSupportsExpression: true,
				}
			)
			await userEvent.click(screen.getByRole('button', { name: /switch to expression mode/i }))
			expect(setValue).toHaveBeenCalledWith('num', { isExpression: true, value: '5' })
		})

		it('switches back to value mode, keeping the current value', async () => {
			const { setValue } = renderField(textOption, { value: expr('$(a:b)'), fieldSupportsExpression: true })
			await userEvent.click(screen.getByRole('button', { name: /switch to value mode/i }))
			expect(setValue).toHaveBeenCalledWith('text', { isExpression: false, value: '$(a:b)' })
		})

		it('disables the toggle when readonly', () => {
			renderField(textOption, { fieldSupportsExpression: true, readonly: true })
			expect(screen.getByRole('button', { name: toggleName })).toBeDisabled()
		})

		it('treats a missing value as a plain value', () => {
			renderField(textOption, { value: undefined, fieldSupportsExpression: true })
			expect(screen.getByTestId('control')).toBeInTheDocument()
			expect(screen.getByRole('button', { name: /switch to expression mode/i })).toBeInTheDocument()
		})
	})

	describe('Expression mode', () => {
		it('replaces the control with the expression editor', () => {
			renderField(textOption, { value: expr('$(a:b)'), fieldSupportsExpression: true })
			expect(screen.queryByTestId('control')).toBeNull()
			expect(screen.getByTestId('expression-input')).toHaveTextContent('$(a:b)')
		})

		it('writes edits from the expression editor as an expression', () => {
			const { setValue } = renderField(textOption, { value: expr('$(a:b)'), fieldSupportsExpression: true })
			captured.expressionInput.at(-1).setValue('$(c:d)')
			expect(setValue).toHaveBeenCalledWith('text', { isExpression: true, value: '$(c:d)' })
		})

		it('ignores an expression value when the field does not support expressions', () => {
			renderField(textOption, { value: expr('$(a:b)'), fieldSupportsExpression: false })
			expect(screen.getByTestId('control')).toBeInTheDocument()
			expect(screen.queryByTestId('expression-preview')).toBeNull()
		})

		it('renders a preview of the expression', () => {
			renderField(textOption, { value: expr('$(a:b)'), fieldSupportsExpression: true, controlId: 'bank:1' })
			expect(screen.getByTestId('expression-preview')).toBeInTheDocument()
			const props = captured.preview.at(-1)
			expect(props.expression).toBe('$(a:b)')
			expect(props.controlId).toBe('bank:1')
			expect(props.fieldDefinition).toBe(textOption)
			expect(props.statusOnly).toBe(false)
		})

		it('passes a null controlId to the preview when there is none', () => {
			renderField(textOption, { value: expr('1'), fieldSupportsExpression: true })
			expect(captured.preview.at(-1).controlId).toBeNull()
		})

		it('renders a preview for an expression-type field', () => {
			renderField({ id: 'calc', type: 'expression', label: 'Calc' }, { value: expr('1 + 1') })
			expect(captured.preview.at(-1).expression).toBe('1 + 1')
		})

		it('shows a status-only preview when the editor context asks for it', () => {
			renderField(textOption, { value: expr('1'), fieldSupportsExpression: true, previewStatusOnly: true })
			expect(captured.preview.at(-1).statusOnly).toBe(true)
		})

		it('resolves the preview context from the sibling options', () => {
			const option: SomeCompanionInputField = {
				...textOption,
				contextVariableResolution: { type: 'customVariable', nameFieldId: 'name' },
			}
			renderField(option, {
				value: expr('$(this:current) + 1'),
				fieldSupportsExpression: true,
				allRawOptions: { name: val('my_var') },
			})
			expect(captured.preview.at(-1).contextResolution).toEqual({ type: 'customVariable', nameValue: val('my_var') })
		})

		it('offers the deferred-parsing context variables in the expression editor', () => {
			const option: SomeCompanionInputField = {
				...textOption,
				contextVariableResolution: { type: 'customVariable', nameFieldId: 'name' },
			}
			renderField(option, { value: expr('1'), fieldSupportsExpression: true })
			expect(captured.expressionInput.at(-1).localVariables.map((v: { value: string }) => v.value)).toContain(
				'this:current'
			)
		})

		it('shows the expression feature icons in place of the field features', () => {
			const { container } = renderField(textOption, { value: expr('1'), fieldSupportsExpression: true })
			expect(hasIcon(container, faDollarSign)).toBe(true)
			expect(hasIcon(container, faGlobe)).toBe(true)
		})

		it('prefers the expression description', () => {
			renderField(
				{ ...textOption, description: 'Value help', expressionDescription: 'Expression help' },
				{ value: expr('1'), fieldSupportsExpression: true }
			)
			expect(screen.getByText('Expression help')).toBeInTheDocument()
			expect(screen.queryByText('Value help')).toBeNull()
		})

		it('falls back to the description', () => {
			renderField({ ...textOption, description: 'Value help' }, { value: expr('1'), fieldSupportsExpression: true })
			expect(screen.getByText('Value help')).toBeInTheDocument()
		})

		it('falls back to the colour hint for a colour field', () => {
			renderField(
				{ id: 'color', type: 'colorpicker', label: 'Color', default: 0, enableAlpha: false, returnType: 'number' },
				{ value: expr('0xff0000'), fieldSupportsExpression: true }
			)
			expect(screen.getByText(DEFAULT_COLOR_EXPRESSION_DESCRIPTION)).toBeInTheDocument()
		})

		it('does not show the expression description in value mode', () => {
			renderField(
				{ ...textOption, description: 'Value help', expressionDescription: 'Expression help' },
				{ value: val('a'), fieldSupportsExpression: true }
			)
			expect(screen.getByText('Value help')).toBeInTheDocument()
			expect(screen.queryByText('Expression help')).toBeNull()
		})
	})

	describe('List fields', () => {
		const listOption: SomeCompanionInputField = {
			id: 'items',
			type: 'internal:list',
			label: 'Items',
			fields: [],
			default: [],
		}

		it('renders a list field in place of the control', () => {
			renderField(listOption, { value: val([{ a: 0 }]), readonly: true, visibility: false })
			expect(screen.queryByTestId('control')).toBeNull()
			const props = captured.list.at(-1)
			expect(props.definition).toBe(listOption)
			expect(props.value).toEqual([{ a: 0 }])
			expect(props.disabled).toBe(true)
			expect(props.visibility).toBe(false)
		})

		it('wraps the rows set by the list as a plain value', async () => {
			const { setValue } = renderField(listOption)
			await userEvent.click(screen.getByTestId('list'))
			expect(setValue).toHaveBeenCalledWith('items', { isExpression: false, value: [{ a: 1 }] })
		})

		it('lets the list cells use expressions when the field supports them', () => {
			renderField(listOption, { fieldSupportsExpression: true })
			expect(captured.list.at(-1).fieldSupportsExpression).toBe(true)
		})

		it('does not let the list cells use expressions when auto expressions are disabled', () => {
			renderField({ ...listOption, disableAutoExpression: true }, { fieldSupportsExpression: true })
			expect(captured.list.at(-1).fieldSupportsExpression).toBe(false)
		})

		it('does not wrap the list in an expression toggle', () => {
			renderField(listOption, { fieldSupportsExpression: true })
			expect(screen.queryByRole('button', { name: toggleName })).toBeNull()
		})
	})

	describe('Table fields', () => {
		const tableOption: SomeCompanionInputField = {
			id: 'rows',
			type: 'internal:table',
			label: 'Rows',
			columns: [],
			default: [],
		}

		it('renders a table field in place of the control', () => {
			renderField(tableOption, { value: val([{ b: 0 }]), readonly: true })
			expect(screen.queryByTestId('control')).toBeNull()
			const props = captured.table.at(-1)
			expect(props.definition).toBe(tableOption)
			expect(props.value).toEqual([{ b: 0 }])
			expect(props.disabled).toBe(true)
		})

		it('wraps the rows set by the table as a plain value', async () => {
			const { setValue } = renderField(tableOption)
			await userEvent.click(screen.getByTestId('table'))
			expect(setValue).toHaveBeenCalledWith('rows', { isExpression: false, value: [{ b: 2 }] })
		})

		it('does not wrap the table in an expression toggle', () => {
			renderField(tableOption, { fieldSupportsExpression: true })
			expect(screen.queryByRole('button', { name: toggleName })).toBeNull()
		})
	})
})
