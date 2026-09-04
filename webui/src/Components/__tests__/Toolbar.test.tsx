import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from '../Toolbar'

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

describe('Toolbar.Root', () => {
	it('renders a toolbar with the orientation reflected to assistive tech', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Button title="Run" icon={faPlay} onClick={vi.fn()} />
			</Toolbar.Root>
		)
		const toolbar = screen.getByRole('toolbar')
		expect(toolbar).toHaveClass('toolbar', 'toolbar-horizontal')
		expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal')
	})

	it('applies the vertical orientation class', () => {
		render(<Toolbar.Root orientation="vertical">{null}</Toolbar.Root>)
		const toolbar = screen.getByRole('toolbar')
		expect(toolbar).toHaveClass('toolbar-vertical')
		expect(toolbar).toHaveAttribute('aria-orientation', 'vertical')
	})

	it('applies the small size class only when requested', () => {
		const { rerender } = render(<Toolbar.Root orientation="horizontal">{null}</Toolbar.Root>)
		expect(screen.getByRole('toolbar')).not.toHaveClass('toolbar-sm')

		rerender(
			<Toolbar.Root orientation="horizontal" size="sm">
				{null}
			</Toolbar.Root>
		)
		expect(screen.getByRole('toolbar')).toHaveClass('toolbar-sm')
	})

	it('appends a custom className', () => {
		render(
			<Toolbar.Root orientation="horizontal" className="me-2">
				{null}
			</Toolbar.Root>
		)
		expect(screen.getByRole('toolbar')).toHaveClass('toolbar', 'me-2')
	})
})

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

describe('Toolbar.Button', () => {
	it('fires onClick when pressed', async () => {
		const user = userEvent.setup()
		const onClick = vi.fn()
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Button title="Run" icon={faPlay} onClick={onClick} />
			</Toolbar.Root>
		)
		await user.click(screen.getByRole('button', { name: 'Run' }))
		expect(onClick).toHaveBeenCalledOnce()
	})

	it('names the button from ariaLabel when its title is not the label', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Button title="Run" ariaLabel="Run the button" icon={faPlay} onClick={vi.fn()} />
			</Toolbar.Root>
		)
		expect(screen.getByRole('button', { name: 'Run the button' })).toBeInTheDocument()
	})

	it('marks the active class', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Button title="Snap" icon={faPlay} active onClick={vi.fn()} />
			</Toolbar.Root>
		)
		expect(screen.getByRole('button', { name: 'Snap' })).toHaveClass('toolbar-button', 'active')
	})

	it('reflects a toggle state to assistive tech via aria-pressed', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Button title="Snap" icon={faPlay} pressed onClick={vi.fn()} />
			</Toolbar.Root>
		)
		expect(screen.getByRole('button', { name: 'Snap' })).toHaveAttribute('aria-pressed', 'true')
	})

	it('applies the danger tone class', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Button title="Delete" icon={faPlay} tone="danger" onClick={vi.fn()} />
			</Toolbar.Root>
		)
		expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('toolbar-button-danger')
	})

	it('disables the button', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Button title="Run" icon={faPlay} disabled onClick={vi.fn()} />
			</Toolbar.Root>
		)
		expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
	})

	it('sets the title tooltip when there is no disabled reason', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Button title="Run" icon={faPlay} onClick={vi.fn()} />
			</Toolbar.Root>
		)
		expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('title', 'Run')
	})

	it('drops the native title and shows the reason tooltip on hover when disabled with a reason', async () => {
		const user = userEvent.setup()
		const { container } = render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Button
					title="Center"
					icon={faPlay}
					disabled
					disabledReason="Select an element first"
					onClick={vi.fn()}
				/>
			</Toolbar.Root>
		)
		// title is dropped in favour of the tooltip, so the button no longer carries the native hint
		const button = container.querySelector<HTMLButtonElement>('.toolbar-button')!
		expect(button).not.toHaveAttribute('title')

		// The button is pointer-events:none, so the wrapping trigger is what receives the hover
		await user.hover(button.parentElement!)
		expect(await screen.findByRole('tooltip')).toHaveTextContent('Select an element first')
	})
})

// ---------------------------------------------------------------------------
// Structural parts
// ---------------------------------------------------------------------------

describe('Toolbar structural parts', () => {
	it('renders a separator', () => {
		const { container } = render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Separator />
			</Toolbar.Root>
		)
		expect(container.querySelector('.toolbar-separator')).toBeInTheDocument()
	})

	it('groups its children', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Group>
					<Toolbar.Button title="Run" icon={faPlay} onClick={vi.fn()} />
				</Toolbar.Group>
			</Toolbar.Root>
		)
		const group = screen.getByRole('button', { name: 'Run' }).parentElement
		expect(group).toHaveClass('toolbar-group')
	})

	it('keeps the status and trailing buttons together in the tail', () => {
		const { container } = render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Tail>
					<Toolbar.Status>Ready</Toolbar.Status>
				</Toolbar.Tail>
			</Toolbar.Root>
		)
		const tail = container.querySelector('.toolbar-tail')
		expect(tail).toBeInTheDocument()
		expect(tail?.querySelector('.toolbar-status')).toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

describe('Toolbar.Status', () => {
	it('exposes its content as a status region', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Status>Edit mode</Toolbar.Status>
			</Toolbar.Root>
		)
		expect(screen.getByRole('status')).toHaveTextContent('Edit mode')
	})

	it('applies the muted class', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Status muted>Edit mode</Toolbar.Status>
			</Toolbar.Root>
		)
		expect(screen.getByRole('status')).toHaveClass('toolbar-status', 'toolbar-status-muted')
	})

	it('applies the danger tone class', () => {
		render(
			<Toolbar.Root orientation="horizontal">
				<Toolbar.Status tone="danger">Press mode is live</Toolbar.Status>
			</Toolbar.Root>
		)
		expect(screen.getByRole('status')).toHaveClass('toolbar-status-danger')
	})
})
