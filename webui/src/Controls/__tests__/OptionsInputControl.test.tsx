import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { CompanionFieldVariablesSupport } from '@companion-app/shared/Model/Options.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { EntityEditorContextProvider } from '../Components/EntityEditorContext.js'
import { EntityListActionContext, LocalVariablesStore } from '../LocalVariablesStore.js'

// Capture the props handed to TextInputField so we can assert which local variables are offered.
const captured: { localVariables?: { value: string }[] }[] = []
vi.mock('~/Components/TextInputField.js', () => ({
	TextInputField: (props: { localVariables?: { value: string }[] }) => {
		captured.push(props)
		return null
	},
	TextInputFieldSimple: () => null,
}))

const { OptionsInputControl } = await import('../OptionsInputControl.js')

const rootStore = { variablesStore: { allVariableDefinitions: { get: () => [] } } } as any

function localVariablesFor(option: any, actionContext: EntityListActionContext): string[] {
	captured.length = 0
	const store = new LocalVariablesStore('bank:1')
	render(
		<RootAppStoreContext.Provider value={rootStore}>
			<EntityEditorContextProvider
				controlId="bank:1"
				location={{ pageNumber: 1, row: 0, column: 0 } as any}
				serviceFactory={{} as any}
				readonly={false}
				localVariablesStore={store}
				localVariablePrefix={null}
				actionContext={actionContext}
			>
				<OptionsInputControl
					inputId="x"
					allowInternalFields={true}
					isLocatedInGrid={true}
					entityType={EntityModelType.Action}
					option={option}
					value={''}
					setValue={() => {}}
					localVariablesStore={store}
					features={{ local: !!option.useVariables, variables: true }}
				/>
			</EntityEditorContextProvider>
		</RootAppStoreContext.Provider>
	)
	return captured[0]?.localVariables?.map((v) => v.value) ?? []
}

const deferParsingValueField = {
	type: 'textinput',
	id: 'value',
	label: 'Value',
	deferParsing: true,
	contextVariableResolution: { type: 'localVariable', locationFieldId: 'location', nameFieldId: 'name' },
}

const internalParserField = {
	type: 'textinput',
	id: 'value',
	label: 'Value',
	useVariables: CompanionFieldVariablesSupport.InternalParser,
}

describe('OptionsInputControl execution-context variables', () => {
	it('offers surface_id for a deferred-parsing action field (e.g. Local Variable: Set value)', () => {
		const vars = localVariablesFor(deferParsingValueField, EntityListActionContext.Actions)
		expect(vars).toContain('this:surface_id')
		expect(vars).toContain('this:current') // the deferred-parsing context var
		expect(vars).not.toContain('this:delta') // not a rotary set
	})

	it('offers delta for a deferred-parsing field in a rotary action set', () => {
		const vars = localVariablesFor(deferParsingValueField, EntityListActionContext.RotaryActions)
		expect(vars).toContain('this:surface_id')
		expect(vars).toContain('this:delta')
	})

	it('still offers surface_id for an InternalParser action field', () => {
		const vars = localVariablesFor(internalParserField, EntityListActionContext.Actions)
		expect(vars).toContain('this:surface_id')
		expect(vars).not.toContain('this:delta')
	})

	it('offers no local variables for a plain textinput (no variable parsing)', () => {
		const vars = localVariablesFor({ type: 'textinput', id: 'value', label: 'Value' }, EntityListActionContext.Actions)
		expect(vars).toEqual([])
	})

	it('offers location vars but NOT execution context for an old-style LocalVariables field', () => {
		const vars = localVariablesFor(
			{ type: 'textinput', id: 'value', label: 'Value', useVariables: CompanionFieldVariablesSupport.LocalVariables },
			EntityListActionContext.Actions
		)
		expect(vars).toContain('this:page')
		expect(vars).not.toContain('this:surface_id')
		expect(vars).not.toContain('this:current')
	})

	it('omits this:current for a deferred-parsing field without contextVariableResolution', () => {
		const vars = localVariablesFor(
			{ type: 'textinput', id: 'value', label: 'Value', deferParsing: true },
			EntityListActionContext.Actions
		)
		expect(vars).toContain('this:surface_id')
		expect(vars).not.toContain('this:current')
	})
})
