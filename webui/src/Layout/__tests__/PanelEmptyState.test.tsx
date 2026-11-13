import { faPlug } from '@fortawesome/free-solid-svg-icons'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PanelEmptyState } from '../PanelEmptyState'

describe('PanelEmptyState', () => {
	it('renders the title as a heading and the description inside the panel body', () => {
		const { container } = render(
			<PanelEmptyState icon={faPlug} title="Select a connection" description="Choose one from the list." />
		)
		expect(screen.getByRole('heading', { name: 'Select a connection' })).toBeInTheDocument()
		expect(screen.getByText('Choose one from the list.')).toBeInTheDocument()
		expect(screen.queryByRole('button')).toBeNull()
		expect(container.firstChild).toHaveClass('secondary-panel-simple-body', 'panel-empty-state')
	})
})
