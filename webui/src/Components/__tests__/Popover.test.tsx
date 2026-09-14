import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, ButtonGroup } from '../Button'
import { Popover } from '../Popover'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RenderMenuOptions {
	disableDelete?: boolean
}

function renderMenu({ disableDelete = false }: RenderMenuOptions = {}) {
	const onCopy = vi.fn()
	const onDelete = vi.fn()
	render(
		<Popover.Root>
			<Popover.Trigger color="secondary">Options</Popover.Trigger>
			<Popover.Popup>
				<Popover.Item onClick={onCopy}>Copy</Popover.Item>
				<Popover.Item onClick={onDelete} disabled={disableDelete}>
					Delete
				</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	)
	return { onCopy, onDelete }
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

describe('Popover.Trigger', () => {
	it('renders a button', () => {
		renderMenu()
		expect(screen.getByRole('button', { name: 'Options' })).toBeInTheDocument()
	})

	it('applies the btn class', () => {
		renderMenu()
		expect(screen.getByRole('button', { name: 'Options' })).toHaveClass('btn')
	})

	it('applies the color class', () => {
		renderMenu()
		expect(screen.getByRole('button', { name: 'Options' })).toHaveClass('button-secondary')
	})

	it('applies a custom color class', () => {
		render(
			<Popover.Root>
				<Popover.Trigger color="danger">Danger</Popover.Trigger>
				<Popover.Popup>
					<Popover.Item onClick={() => {}}>Item</Popover.Item>
				</Popover.Popup>
			</Popover.Root>
		)
		expect(screen.getByRole('button', { name: 'Danger' })).toHaveClass('button-danger')
	})

	it('applies size class when size prop is set', () => {
		render(
			<Popover.Root>
				<Popover.Trigger color="secondary" size="sm">
					Trigger
				</Popover.Trigger>
				<Popover.Popup>
					<Popover.Item onClick={() => {}}>Item</Popover.Item>
				</Popover.Popup>
			</Popover.Root>
		)
		expect(screen.getByRole('button', { name: 'Trigger' })).toHaveClass('button-sm')
	})

	it('applies caret class when caret prop is set', () => {
		render(
			<Popover.Root>
				<Popover.Trigger color="secondary" caret>
					Trigger
				</Popover.Trigger>
				<Popover.Popup>
					<Popover.Item onClick={() => {}}>Item</Popover.Item>
				</Popover.Popup>
			</Popover.Root>
		)
		expect(screen.getByRole('button', { name: 'Trigger' })).toHaveClass('popover2-trigger-caret')
	})

	it('applies a custom className', () => {
		render(
			<Popover.Root>
				<Popover.Trigger color="secondary" className="my-custom">
					Trigger
				</Popover.Trigger>
				<Popover.Popup>
					<Popover.Item onClick={() => {}}>Item</Popover.Item>
				</Popover.Popup>
			</Popover.Root>
		)
		expect(screen.getByRole('button', { name: 'Trigger' })).toHaveClass('my-custom')
	})
})

// ---------------------------------------------------------------------------
// Open / close behaviour
// ---------------------------------------------------------------------------

describe('Popover open/close', () => {
	it('popup is not in the DOM when closed', () => {
		renderMenu()
		expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
	})

	it('opens the popup when trigger is clicked', async () => {
		const user = userEvent.setup()
		renderMenu()
		await user.click(screen.getByRole('button', { name: 'Options' }))
		expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
	})

	it('closes the popup when trigger is clicked again', async () => {
		const user = userEvent.setup()
		renderMenu()
		const trigger = screen.getByRole('button', { name: 'Options' })
		await user.click(trigger)
		await user.click(trigger)
		expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
	})

	it('closes the popup when an item is clicked', async () => {
		const user = userEvent.setup()
		renderMenu()
		await user.click(screen.getByRole('button', { name: 'Options' }))
		await user.click(screen.getByRole('button', { name: 'Copy' }))
		expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
	})

	it('fires the item onClick handler when clicked', async () => {
		const user = userEvent.setup()
		const { onCopy } = renderMenu()
		await user.click(screen.getByRole('button', { name: 'Options' }))
		await user.click(screen.getByRole('button', { name: 'Copy' }))
		expect(onCopy).toHaveBeenCalledOnce()
	})

	it('closes the popup when Escape is pressed', async () => {
		const user = userEvent.setup()
		renderMenu()
		await user.click(screen.getByRole('button', { name: 'Options' }))
		expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
		await user.keyboard('{Escape}')
		expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Disabled items
// ---------------------------------------------------------------------------

describe('Disabled items', () => {
	it('disabled item does not close the popup', async () => {
		const user = userEvent.setup()
		renderMenu({ disableDelete: true })
		await user.click(screen.getByRole('button', { name: 'Options' }))
		await user.click(screen.getByRole('button', { name: 'Delete' }))
		expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
	})

	it('disabled item does not call its onClick handler', async () => {
		const user = userEvent.setup()
		const { onDelete } = renderMenu({ disableDelete: true })
		await user.click(screen.getByRole('button', { name: 'Options' }))
		await user.click(screen.getByRole('button', { name: 'Delete' }))
		expect(onDelete).not.toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// Popover.Item
// ---------------------------------------------------------------------------

describe('Popover.Item', () => {
	it('has the popover2-item class', async () => {
		const user = userEvent.setup()
		renderMenu()
		await user.click(screen.getByRole('button', { name: 'Options' }))
		expect(screen.getByRole('button', { name: 'Copy' })).toHaveClass('popover2-item')
	})

	it('accepts a custom className', async () => {
		const user = userEvent.setup()
		render(
			<Popover.Root>
				<Popover.Trigger color="secondary">Trigger</Popover.Trigger>
				<Popover.Popup>
					<Popover.Item onClick={() => {}} className="my-item">
						Item
					</Popover.Item>
				</Popover.Popup>
			</Popover.Root>
		)
		await user.click(screen.getByRole('button', { name: 'Trigger' }))
		const item = screen.getByRole('button', { name: 'Item' })
		expect(item).toHaveClass('popover2-item')
		expect(item).toHaveClass('my-item')
	})
})

// ---------------------------------------------------------------------------
// Arrow
// ---------------------------------------------------------------------------

describe('Arrow', () => {
	it('renders the arrow element when arrow=true', async () => {
		const user = userEvent.setup()
		render(
			<Popover.Root>
				<Popover.Trigger color="secondary">Trigger</Popover.Trigger>
				<Popover.Popup arrow>
					<Popover.Item onClick={() => {}}>Item</Popover.Item>
				</Popover.Popup>
			</Popover.Root>
		)
		await user.click(screen.getByRole('button', { name: 'Trigger' }))
		expect(document.querySelector('.popover2-arrow')).toBeInTheDocument()
	})

	it('does not render the arrow element when arrow is not set', async () => {
		const user = userEvent.setup()
		render(
			<Popover.Root>
				<Popover.Trigger color="secondary">Trigger</Popover.Trigger>
				<Popover.Popup>
					<Popover.Item onClick={() => {}}>Item</Popover.Item>
				</Popover.Popup>
			</Popover.Root>
		)
		await user.click(screen.getByRole('button', { name: 'Trigger' }))
		expect(document.querySelector('.popover2-arrow')).not.toBeInTheDocument()
	})
})

// ---------------------------------------------------------------------------
// Split-button caret in a ButtonGroup
// ---------------------------------------------------------------------------

describe('Split-button caret', () => {
	function renderSplitButton() {
		return render(
			<ButtonGroup>
				<Button color="primary">Save</Button>
				<Popover.Root open={true}>
					<Popover.Trigger color="primary" caret aria-label="More" />
					<Popover.Popup>
						<Popover.Item onClick={() => {}}>Save as…</Popover.Item>
					</Popover.Popup>
				</Popover.Root>
			</ButtonGroup>
		)
	}

	// An open trigger injects focus guards and an anchor span after the caret, so it is no longer the
	// group's last child - which is why the caret needs its own rule to keep its trailing corners.
	it('the caret is not the last child of the group when open', () => {
		const { container } = renderSplitButton()
		const group = container.querySelector('.button-group')!
		const caret = group.querySelector('.popover2-trigger-caret')!
		expect(group.lastElementChild).not.toBe(caret)
		expect(caret.matches(':nth-last-child(1 of :not([data-base-ui-focus-guard]))')).toBe(false)
	})

	// The override that holds its trailing edge regardless of those injected siblings
	it('the caret matches the split-button override selector', () => {
		const { container } = renderSplitButton()
		const caret = container.querySelector('.popover2-trigger-caret')!
		expect(caret.matches('.button-group > .popover2-trigger-caret')).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Controlled open state
// ---------------------------------------------------------------------------

describe('Controlled open state', () => {
	it('renders the popup when open=true', () => {
		render(
			<Popover.Root open={true}>
				<Popover.Trigger color="secondary">Trigger</Popover.Trigger>
				<Popover.Popup>
					<Popover.Item onClick={() => {}}>Item</Popover.Item>
				</Popover.Popup>
			</Popover.Root>
		)
		expect(screen.getByRole('button', { name: 'Item' })).toBeInTheDocument()
	})

	it('does not render the popup when open=false', () => {
		render(
			<Popover.Root open={false}>
				<Popover.Trigger color="secondary">Trigger</Popover.Trigger>
				<Popover.Popup>
					<Popover.Item onClick={() => {}}>Item</Popover.Item>
				</Popover.Popup>
			</Popover.Root>
		)
		expect(screen.queryByRole('button', { name: 'Item' })).not.toBeInTheDocument()
	})
})
