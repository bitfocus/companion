import { DragDropProvider } from '@dnd-kit/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AuthorableInputField } from '@companion-app/shared/Model/Options.js'
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

function renderEditor(fields: AuthorableInputField[], service: InputFieldDefinitionsService, readonly: boolean) {
	return render(
		<RootAppStoreContext.Provider value={mockStore as RootAppStore}>
			<MenuPortalContext.Provider value={document.body}>
				<DragDropProvider>
					<InputFieldDefinitionsEditor
						heading="Inputs"
						subheading={null}
						headingActions={null}
						fields={fields}
						service={service}
						readonly={readonly}
						localVariablesStore={null}
						collapseStorageId="test_input_fields"
					/>
				</DragDropProvider>
			</MenuPortalContext.Provider>
		</RootAppStoreContext.Provider>
	)
}

const fields: AuthorableInputField[] = [
	{ type: 'number', id: 'input', label: 'Input', default: 1, min: 1, max: 20 },
	{ type: 'checkbox', id: 'auto', label: 'Auto', default: true },
]

describe('InputFieldDefinitionsEditor', () => {
	it('adds a field of the chosen type', async () => {
		const service = makeService()
		renderEditor(fields, service, false)

		await userEvent.click(screen.getByPlaceholderText('+ Add input'))
		await userEvent.click(await screen.findByRole('option', { name: 'Checkbox' }))

		expect(service.addField).toHaveBeenCalledWith({
			type: 'checkbox',
			id: 'checkbox',
			label: 'Checkbox',
			default: false,
		})
	})

	it('shows each field with its type, and removes a field once confirmed', async () => {
		const service = makeService()
		renderEditor(fields, service, false)

		expect(screen.getByText('Auto')).toBeTruthy()
		expect(screen.getAllByText('Checkbox').length).toBeGreaterThan(0)

		const removeButtons = screen.getAllByTitle('Remove input')
		await userEvent.click(removeButtons[1])

		// Like the actions of a control, removing one is confirmed first
		expect(service.removeField).not.toHaveBeenCalled()
		expect(await screen.findByText('Delete input "Auto"?')).toBeTruthy()
		await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
		expect(service.removeField).toHaveBeenCalledWith('auto')
	})

	it('shows how to use a field with its label, and its id only in the more options', async () => {
		renderEditor(fields.slice(0, 1), makeService(), false)

		expect(screen.getByText('Use as $(options:input)')).toBeTruthy()
		expect(screen.queryByText('Id')).toBeNull()

		await userEvent.click(screen.getByTitle('Show more options'))
		expect(screen.getByText('Id')).toBeTruthy()
	})

	it('shows an id used by another field as invalid, rather than using it', async () => {
		const service = makeService()
		renderEditor(fields, service, false)

		await userEvent.click(screen.getAllByTitle('Show more options')[0])
		const idInput = screen.getByLabelText('Id')
		await userEvent.clear(idInput)
		await userEvent.type(idInput, 'auto')

		expect(idInput.getAttribute('aria-invalid')).toBe('true')
		expect(service.updateField).toHaveBeenCalledWith('input', expect.objectContaining({ id: 'aut' }))
		expect(service.updateField).not.toHaveBeenCalledWith('input', expect.objectContaining({ id: 'auto' }))
	})

	it('hides the editing controls when readonly', () => {
		renderEditor(fields, makeService(), true)
		expect(screen.queryByPlaceholderText('+ Add input')).toBeNull()
		expect(screen.queryAllByTitle('Remove input')).toHaveLength(0)
	})
})
