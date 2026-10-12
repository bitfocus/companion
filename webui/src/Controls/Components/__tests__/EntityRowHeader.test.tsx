import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { EntityRowHeader } from '../EntityCellControls.js'

type Props = ComponentProps<typeof EntityRowHeader>

function renderAction(
	delay = 0,
	entityType: EntityModelType.Action | EntityModelType.Feedback = EntityModelType.Action
) {
	const setPanelCollapsed = vi.fn()
	render(
		<EntityRowHeader
			service={{ performDuplicate: vi.fn(), performDelete: vi.fn() } as unknown as Props['service']}
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
				// Legacy actions can still carry a delay field even though the current model uses duration groups.
				...(delay > 0 ? { delay } : {}),
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
			isPanelCollapsed
			hasDetails
			setPanelCollapsed={setPanelCollapsed}
			definitionName="Internal: Local Variable: Set value"
			canSetHeadline={false}
			noteEditing={false}
			setNoteEditing={vi.fn()}
			readonly={false}
			localVariablesStore={null}
			localVariablePrefix={null}
		/>
	)
	return { setPanelCollapsed }
}

describe('Collapsed action header', () => {
	it('shows the action name without partial option-value summaries and can expand', async () => {
		const { setPanelCollapsed } = renderAction()
		expect(screen.getByText('Local Variable: Set value')).toHaveAttribute('title', 'Local Variable: Set value')
		expect(screen.queryByText('1/2/3')).not.toBeInTheDocument()
		expect(screen.queryByText('gauge')).not.toBeInTheDocument()
		await userEvent.setup().click(screen.getByRole('button', { name: 'Expand action' }))
		expect(setPanelCollapsed).toHaveBeenCalledExactlyOnceWith(false)
	})

	it('hides option-value summaries on collapsed conditions too', () => {
		renderAction(0, EntityModelType.Feedback)
		expect(screen.queryByText('1/2/3')).not.toBeInTheDocument()
		expect(screen.queryByText('gauge')).not.toBeInTheDocument()
	})

	it('retains the action delay indicator', () => {
		renderAction(500)
		expect(screen.getByText('⏱️ 500ms')).toBeInTheDocument()
		expect(screen.queryByText('gauge')).not.toBeInTheDocument()
	})
})
