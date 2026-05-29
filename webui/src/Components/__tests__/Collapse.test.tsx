import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Collapse } from '../Collapse'

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

describe('Collapse.Root', () => {
	it('renders without crashing', () => {
		const { container } = render(
			<Collapse.Root>
				<Collapse.Panel>Content</Collapse.Panel>
			</Collapse.Root>
		)
		expect(container.firstChild).toBeInTheDocument()
	})

	it('applies collapse2-root class', () => {
		const { container } = render(
			<Collapse.Root>
				<Collapse.Panel>Content</Collapse.Panel>
			</Collapse.Root>
		)
		expect(container.firstChild).toHaveClass('collapse2-root')
	})
})

// ---------------------------------------------------------------------------
// Panel visibility
// ---------------------------------------------------------------------------

describe('Collapse.Panel visibility', () => {
	it('panel content is not in the DOM when closed by default', () => {
		render(
			<Collapse.Root>
				<Collapse.Panel>Hidden content</Collapse.Panel>
			</Collapse.Root>
		)
		expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
	})

	it('panel content is visible when defaultOpen', () => {
		render(
			<Collapse.Root defaultOpen>
				<Collapse.Panel>Visible content</Collapse.Panel>
			</Collapse.Root>
		)
		expect(screen.getByText('Visible content')).toBeInTheDocument()
	})

	it('panel content is visible when open is true (controlled)', () => {
		render(
			<Collapse.Root open>
				<Collapse.Panel>Controlled content</Collapse.Panel>
			</Collapse.Root>
		)
		expect(screen.getByText('Controlled content')).toBeInTheDocument()
	})

	it('panel content is not in DOM when open is false (controlled)', () => {
		render(
			<Collapse.Root open={false}>
				<Collapse.Panel>Hidden controlled</Collapse.Panel>
			</Collapse.Root>
		)
		expect(screen.queryByText('Hidden controlled')).not.toBeInTheDocument()
	})

	it('panel stays in DOM with keepMounted when closed', () => {
		render(
			<Collapse.Root>
				<Collapse.Panel keepMounted>Mounted content</Collapse.Panel>
			</Collapse.Root>
		)
		// With keepMounted, the panel stays in the DOM but is hidden
		const panel = screen.getByText('Mounted content')
		expect(panel).toBeInTheDocument()
		expect(panel.closest('[hidden]')).toBeTruthy()
	})
})

// ---------------------------------------------------------------------------
// Panel class names
// ---------------------------------------------------------------------------

describe('Collapse.Panel class names', () => {
	it('applies collapse2-panel class', () => {
		const { container } = render(
			<Collapse.Root defaultOpen>
				<Collapse.Panel>Content</Collapse.Panel>
			</Collapse.Root>
		)
		expect(container.querySelector('.collapse2-panel')).toBeInTheDocument()
	})

	it('applies additional className', () => {
		const { container } = render(
			<Collapse.Root defaultOpen>
				<Collapse.Panel className="row g-sm-2 p-0">Content</Collapse.Panel>
			</Collapse.Root>
		)
		const panel = container.querySelector('.collapse2-panel')
		expect(panel).toHaveClass('collapse2-panel', 'row', 'g-sm-2', 'p-0')
	})
})

// ---------------------------------------------------------------------------
// Trigger interaction
// ---------------------------------------------------------------------------

describe('Collapse.Trigger', () => {
	it('trigger button renders', () => {
		render(
			<Collapse.Root>
				<Collapse.Trigger>Toggle</Collapse.Trigger>
				<Collapse.Panel>Panel content</Collapse.Panel>
			</Collapse.Root>
		)
		expect(screen.getByRole('button', { name: 'Toggle' })).toBeInTheDocument()
	})

	it('trigger applies collapse2-trigger class', () => {
		render(
			<Collapse.Root>
				<Collapse.Trigger>Toggle</Collapse.Trigger>
				<Collapse.Panel>Panel content</Collapse.Panel>
			</Collapse.Root>
		)
		expect(screen.getByRole('button', { name: 'Toggle' })).toHaveClass('collapse2-trigger')
	})

	it('clicking trigger opens the panel', async () => {
		const user = userEvent.setup()
		render(
			<Collapse.Root>
				<Collapse.Trigger>Toggle</Collapse.Trigger>
				<Collapse.Panel>Panel content</Collapse.Panel>
			</Collapse.Root>
		)
		expect(screen.queryByText('Panel content')).not.toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Toggle' }))
		expect(screen.getByText('Panel content')).toBeInTheDocument()
	})

	it('clicking trigger twice closes the panel again', async () => {
		const user = userEvent.setup()
		render(
			<Collapse.Root>
				<Collapse.Trigger>Toggle</Collapse.Trigger>
				<Collapse.Panel>Panel content</Collapse.Panel>
			</Collapse.Root>
		)
		await user.click(screen.getByRole('button', { name: 'Toggle' }))
		expect(screen.getByText('Panel content')).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Toggle' }))
		expect(screen.queryByText('Panel content')).not.toBeInTheDocument()
	})
})
