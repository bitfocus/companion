import { faClock } from '@fortawesome/free-solid-svg-icons'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PanelHeader } from '../PanelHeader'

describe('PanelHeader', () => {
	it('renders the shared compact card header with the title and its buttons', () => {
		const { container } = render(
			<PanelHeader icon={faClock} title="Edit Trigger">
				<button type="button">Close</button>
			</PanelHeader>
		)
		expect(container.firstChild).toHaveClass('secondary-panel-simple-header', 'panel-header-compact')
		expect(screen.getByRole('heading', { name: 'Edit Trigger' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Close' }).parentElement).toHaveClass('header-buttons')
	})
})
