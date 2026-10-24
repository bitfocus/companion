import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { EntityRowHeader } from '../EntityCellControls.js'

type Props = ComponentProps<typeof EntityRowHeader>

function renderAction(
	entityType: EntityModelType.Action | EntityModelType.Feedback,
	headline: string | undefined,
	isPanelCollapsed = true
) {
	const setPanelCollapsed = vi.fn()
	const setHeadline = vi.fn()
	render(
		<EntityRowHeader
			service={{ performDuplicate: vi.fn(), performDelete: vi.fn(), setHeadline } as unknown as Props['service']}
			entityTypeLabel="action"
			entity={{
				type: entityType,
				id: 'action',
				connectionId: 'internal',
				definitionId: 'set-value',
				options: {
					location: { isExpression: false, value: '1/2/3' },
					variable: { isExpression: false, value: 'gauge' },
				},
				upgradeIndex: undefined,
				headline,
			}}
			entityDefinition={
				{
					options: [
						{ id: 'location', label: 'Location', type: 'textinput' },
						{ id: 'variable', label: 'Local variable', type: 'textinput' },
					],
				} as Props['entityDefinition']
			}
			connectionLabel="Internal"
			ownerId={null}
			isPanelCollapsed={isPanelCollapsed}
			canCollapse
			setPanelCollapsed={setPanelCollapsed}
			definitionName="Internal: Local Variable: Set value"
			readonly={false}
			localVariablesStore={null}
			localVariablePrefix={null}
		/>
	)
	return { setPanelCollapsed, setHeadline }
}

describe('Collapsed action header', () => {
	it('shows the action name without partial option-value summaries and can expand', async () => {
		const { setPanelCollapsed } = renderAction(EntityModelType.Action, undefined)
		expect(screen.getByText('Local Variable: Set value')).toHaveAttribute('title', 'Local Variable: Set value')
		expect(screen.queryByText('1/2/3')).not.toBeInTheDocument()
		expect(screen.queryByText('gauge')).not.toBeInTheDocument()
		await userEvent.setup().click(screen.getByRole('button', { name: 'Expand action' }))
		expect(setPanelCollapsed).toHaveBeenCalledExactlyOnceWith(false)
	})

	it('hides option-value summaries on collapsed conditions too', () => {
		renderAction(EntityModelType.Feedback, undefined)
		expect(screen.queryByText('1/2/3')).not.toBeInTheDocument()
		expect(screen.queryByText('gauge')).not.toBeInTheDocument()
	})
})

describe('Action header with a note', () => {
	it('leads with the note and follows with the action name', () => {
		renderAction(EntityModelType.Action, 'Fade the house lights')

		const note = screen.getByText('Fade the house lights')
		const name = screen.getByText('Local Variable: Set value')
		expect(note.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(note).toHaveClass('font-semibold')
		expect(name).not.toHaveClass('font-semibold')
	})

	it('leads with the action name when there is no note', () => {
		renderAction(EntityModelType.Action, undefined)

		expect(screen.getByText('Local Variable: Set value')).toHaveClass('font-semibold')
	})

	it('clears the note from the editor in one click', async () => {
		const { setHeadline } = renderAction(EntityModelType.Action, 'Fade the house lights', false)
		const user = userEvent.setup()

		await user.click(screen.getByRole('button', { name: 'Edit note: Fade the house lights' }))
		expect(screen.getByRole('textbox')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Clear note' }))
		expect(setHeadline).toHaveBeenLastCalledWith('')
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
	})
})
