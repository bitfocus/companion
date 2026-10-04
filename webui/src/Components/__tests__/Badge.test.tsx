import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from '../Badge.js'

describe('Badge', () => {
	it('renders its label', () => {
		render(<Badge color="warning">Deprecated</Badge>)

		expect(screen.getByText('Deprecated')).toBeInTheDocument()
	})

	it('carries the colour class, and the solid fill by default', () => {
		render(<Badge color="danger">Broken</Badge>)

		const badge = screen.getByText('Broken')
		expect(badge).toHaveClass('badge-element', 'badge-danger')
		expect(badge).not.toHaveClass('badge-tonal')
	})

	it('marks the tonal variant so it picks the tinted fill', () => {
		render(
			<Badge color="danger" variant="tonal">
				Broken
			</Badge>
		)

		expect(screen.getByText('Broken')).toHaveClass('badge-tonal')
	})

	it('keeps any className passed by the caller', () => {
		render(
			<Badge color="info" className="me-1">
				Beta
			</Badge>
		)

		expect(screen.getByText('Beta')).toHaveClass('me-1', 'badge-info')
	})
})
