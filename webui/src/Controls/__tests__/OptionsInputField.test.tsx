import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { Grid } from '~/Components/Grid.js'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { OptionsInputField } from '../OptionsInputField.js'

const mockStore: Partial<RootAppStore> = {
	variablesStore: {
		allVariableDefinitions: { get: () => [] },
	} as unknown as RootAppStore['variablesStore'],
}

function renderField(option: SomeCompanionInputField, fieldSupportsExpression: boolean) {
	return render(
		<RootAppStoreContext.Provider value={mockStore as RootAppStore}>
			<MenuPortalContext.Provider value={document.body}>
				<Grid.Row>
					<OptionsInputField
						allowInternalFields={false}
						isLocatedInGrid={false}
						entityType={null}
						option={option}
						value={undefined}
						setValue={() => {}}
						visibility={true}
						localVariablesStore={null}
						fieldSupportsExpression={fieldSupportsExpression}
					/>
				</Grid.Row>
			</MenuPortalContext.Provider>
		</RootAppStoreContext.Provider>
	)
}

const toggleName = /expression mode|value mode/i

describe('OptionsInputField', () => {
	it('renders an expression toggle for a value field when expressions are supported', () => {
		renderField({ id: 'text', type: 'textinput', label: 'Text', default: '' }, true)
		expect(screen.getByRole('button', { name: toggleName })).toBeInTheDocument()
	})

	it('does not render an expression toggle for a static-text field', () => {
		renderField({ id: 'note', type: 'static-text', label: 'Attention', value: 'Read me' }, true)
		expect(screen.getByText('Read me')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: toggleName })).toBeNull()
	})
})
