import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tooltip } from '../Tooltip'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTooltip(delay = 0) {
	render(
		<Tooltip.Root>
			<Tooltip.Trigger delay={delay} closeDelay={0}>
				Hover me
			</Tooltip.Trigger>
			<Tooltip.Popup>Tooltip text</Tooltip.Popup>
		</Tooltip.Root>
	)
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

describe('Tooltip.Trigger', () => {
	it('renders a button by default', () => {
		renderTooltip()
		expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument()
	})

	it('renders a custom element via render prop', () => {
		render(
			<Tooltip.Root>
				<Tooltip.Trigger delay={0} closeDelay={0} render={<span />}>
					Hover me
				</Tooltip.Trigger>
				<Tooltip.Popup>Tooltip text</Tooltip.Popup>
			</Tooltip.Root>
		)
		expect(screen.getByText('Hover me').tagName).toBe('SPAN')
	})
})

// ---------------------------------------------------------------------------
// Show / hide behaviour
// ---------------------------------------------------------------------------

describe('Tooltip show/hide', () => {
	it('tooltip is not visible initially', () => {
		renderTooltip()
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
	})

	it('shows the tooltip on hover', async () => {
		const user = userEvent.setup()
		renderTooltip()
		await user.hover(screen.getByRole('button', { name: 'Hover me' }))
		expect(screen.getByRole('tooltip')).toBeInTheDocument()
		expect(screen.getByRole('tooltip')).toHaveTextContent('Tooltip text')
	})

	it('hides the tooltip when pointer leaves', async () => {
		const user = userEvent.setup()
		renderTooltip()
		await user.hover(screen.getByRole('button', { name: 'Hover me' }))
		expect(screen.getByRole('tooltip')).toBeInTheDocument()
		await user.unhover(screen.getByRole('button', { name: 'Hover me' }))
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
	})

	it('is open when defaultOpen is true', () => {
		render(
			<Tooltip.Root defaultOpen>
				<Tooltip.Trigger>Hover me</Tooltip.Trigger>
				<Tooltip.Popup>Tooltip text</Tooltip.Popup>
			</Tooltip.Root>
		)
		expect(screen.getByRole('tooltip')).toHaveTextContent('Tooltip text')
	})
})

// ---------------------------------------------------------------------------
// Popup class names
// ---------------------------------------------------------------------------

describe('Tooltip.Popup class names', () => {
	it('has the tooltip2-popup class', () => {
		render(
			<Tooltip.Root defaultOpen>
				<Tooltip.Trigger>Hover me</Tooltip.Trigger>
				<Tooltip.Popup>Content</Tooltip.Popup>
			</Tooltip.Root>
		)
		expect(screen.getByRole('tooltip')).toHaveClass('tooltip2-popup')
	})

	it('applies noPadding class', () => {
		render(
			<Tooltip.Root defaultOpen>
				<Tooltip.Trigger>Hover me</Tooltip.Trigger>
				<Tooltip.Popup noPadding>Content</Tooltip.Popup>
			</Tooltip.Root>
		)
		expect(screen.getByRole('tooltip')).toHaveClass('tooltip2-popup--no-padding')
	})

	it('applies size md class', () => {
		render(
			<Tooltip.Root defaultOpen>
				<Tooltip.Trigger>Hover me</Tooltip.Trigger>
				<Tooltip.Popup size="md">Content</Tooltip.Popup>
			</Tooltip.Root>
		)
		expect(screen.getByRole('tooltip')).toHaveClass('tooltip2-popup--md')
	})

	it('applies size lg class', () => {
		render(
			<Tooltip.Root defaultOpen>
				<Tooltip.Trigger>Hover me</Tooltip.Trigger>
				<Tooltip.Popup size="lg">Content</Tooltip.Popup>
			</Tooltip.Root>
		)
		expect(screen.getByRole('tooltip')).toHaveClass('tooltip2-popup--lg')
	})

	it('applies a custom className', () => {
		render(
			<Tooltip.Root defaultOpen>
				<Tooltip.Trigger>Hover me</Tooltip.Trigger>
				<Tooltip.Popup className="my-tooltip">Content</Tooltip.Popup>
			</Tooltip.Root>
		)
		expect(screen.getByRole('tooltip')).toHaveClass('my-tooltip')
	})
})
