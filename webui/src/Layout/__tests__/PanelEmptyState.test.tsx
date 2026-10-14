import { faPlug } from '@fortawesome/free-solid-svg-icons'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PanelEmptyListProvider, PanelEmptyState, type PanelEmptyListState } from '../PanelEmptyState'

function renderEmptyState(emptyList: PanelEmptyListState | null) {
	return render(
		<PanelEmptyListProvider value={emptyList}>
			<PanelEmptyState icon={faPlug} title="Select a connection" description="Choose one from the list." />
		</PanelEmptyListProvider>
	)
}

describe('PanelEmptyState', () => {
	it('renders the title as a heading and the description inside the panel body', () => {
		const { container } = renderEmptyState(null)
		expect(screen.getByRole('heading', { name: 'Select a connection' })).toBeInTheDocument()
		expect(screen.getByText('Choose one from the list.')).toBeInTheDocument()
		expect(screen.queryByRole('button')).toBeNull()
		expect(container.firstChild).toHaveClass('secondary-panel-simple-body', 'panel-empty-state')
	})

	it('renders the select prompt when used outside a provider', () => {
		render(<PanelEmptyState icon={faPlug} title="Select a connection" description="Choose one from the list." />)
		expect(screen.getByRole('heading', { name: 'Select a connection' })).toBeInTheDocument()
	})

	it('swaps to the empty-list copy and action while the list is empty', () => {
		const onAction = vi.fn()
		renderEmptyState({
			title: 'No connections yet',
			description: 'Add one to get started.',
			actionLabel: 'Add connection',
			onAction,
		})

		expect(screen.getByRole('heading', { name: 'No connections yet' })).toBeInTheDocument()
		expect(screen.getByText('Add one to get started.')).toBeInTheDocument()
		expect(screen.queryByText('Select a connection')).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: 'Add connection' }))
		expect(onAction).toHaveBeenCalledOnce()
	})
})
