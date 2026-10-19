import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { MenuPortalContext } from '../../MenuPortalContext.js'
import { InputFieldDefinitionsEditor, type InputFieldDefinitionsService } from '../InputFieldDefinitionsEditor.js'

const mockStore: Partial<RootAppStore> = {
	variablesStore: {
		allVariableDefinitions: { get: () => [] },
	} as unknown as RootAppStore['variablesStore'],
}

function makeService(): InputFieldDefinitionsService {
	return {
		addField: vi.fn(),
		removeField: vi.fn(),
		moveField: vi.fn(),
		updateField: vi.fn(),
	}
}

function renderEditor(fields: SomeCompanionInputField[], service: InputFieldDefinitionsService, readonly = false) {
	return render(
		<RootAppStoreContext.Provider value={mockStore as RootAppStore}>
			<MenuPortalContext.Provider value={document.body}>
				<InputFieldDefinitionsEditor fields={fields} service={service} readonly={readonly} localVariablesStore={null} />
			</MenuPortalContext.Provider>
		</RootAppStoreContext.Provider>
	)
}

const fields: SomeCompanionInputField[] = [
	{ type: 'number', id: 'input', label: 'Input', default: 1, min: 1, max: 20 },
	{ type: 'checkbox', id: 'auto', label: 'Auto', default: true },
]

describe('InputFieldDefinitionsEditor', () => {
	it('shows an empty state', () => {
		renderEditor([], makeService())
		expect(screen.getByText('There are no inputs')).toBeTruthy()
	})

	it('adds a field', async () => {
		const service = makeService()
		renderEditor(fields, service)

		await userEvent.click(screen.getByRole('button', { name: /Add input/ }))

		expect(service.addField).toHaveBeenCalledWith({ type: 'textinput', id: 'input_2', label: 'Input 2', default: '' })
	})

	it('removes and moves fields', async () => {
		const service = makeService()
		renderEditor(fields, service)

		const removeButtons = screen.getAllByTitle('Remove input')
		await userEvent.click(removeButtons[1])
		expect(service.removeField).toHaveBeenCalledWith('auto')

		const downButtons = screen.getAllByTitle('Move down')
		expect((downButtons[1] as HTMLButtonElement).disabled).toBe(true)
		await userEvent.click(downButtons[0])
		expect(service.moveField).toHaveBeenCalledWith('input', 1)
	})

	it('hides the editing controls when readonly', () => {
		renderEditor(fields, makeService(), true)
		expect(screen.queryByRole('button', { name: /Add input/ })).toBeNull()
		expect(screen.queryAllByTitle('Remove input')).toHaveLength(0)
	})
})
