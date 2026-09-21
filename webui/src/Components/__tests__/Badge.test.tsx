import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from '../Badge'

describe('Badge', () => {
	it('renders its label', () => {
		render(<Badge color="warning">Deprecated</Badge>)
		expect(screen.getByText('Deprecated')).toBeInTheDocument()
	})

	it('applies the colour class', () => {
		render(<Badge color="danger">Broken</Badge>)
		expect(screen.getByText('Broken')).toHaveClass('badge-pill', 'badge-pill-danger')
	})

	it('applies a custom className alongside the colour class', () => {
		render(
			<Badge color="info" className="ms-1">
				Beta
			</Badge>
		)
		expect(screen.getByText('Beta')).toHaveClass('badge-pill-info', 'ms-1')
	})

	it('renders no icon by default', () => {
		const { container } = render(<Badge color="warning">Deprecated</Badge>)
		expect(container.querySelector('svg')).toBeNull()
	})

	it('renders the icon when one is given', () => {
		const { container } = render(
			<Badge color="warning" icon={faTriangleExclamation}>
				Deprecated
			</Badge>
		)
		expect(container.querySelector('svg')).toHaveClass('badge-pill-icon')
	})
})
