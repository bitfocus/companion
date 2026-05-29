import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Accordion } from '../Accordion'

describe('Accordion.Root', () => {
	it('renders without crashing', () => {
		const { container } = render(
			<Accordion.Root>
				<Accordion.Item value="a">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)
		expect(container.firstChild).toBeInTheDocument()
	})

	it('applies accordion2 class', () => {
		const { container } = render(
			<Accordion.Root>
				<Accordion.Item value="a">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)
		expect(container.firstChild).toHaveClass('accordion2')
	})
})

describe('Accordion.Panel visibility', () => {
	it('panel content is not in the DOM when closed by default', () => {
		render(
			<Accordion.Root>
				<Accordion.Item value="a">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)
		expect(screen.queryByText('Panel A content')).not.toBeInTheDocument()
	})

	it('panel content is visible when defaultValue includes item', () => {
		render(
			<Accordion.Root defaultValue={['a']}>
				<Accordion.Item value="a">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)
		expect(screen.getByText('Panel A content')).toBeInTheDocument()
	})

	it('panel content is visible when controlled value includes item', () => {
		render(
			<Accordion.Root value={['a']}>
				<Accordion.Item value="a">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)
		expect(screen.getByText('Panel A content')).toBeInTheDocument()
	})
})

describe('Accordion.Trigger', () => {
	it('trigger button renders', () => {
		render(
			<Accordion.Root>
				<Accordion.Item value="a">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)
		expect(screen.getByRole('button', { name: 'Section A' })).toBeInTheDocument()
	})

	it('trigger applies accordion2-trigger class', () => {
		render(
			<Accordion.Root>
				<Accordion.Item value="a">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)
		expect(screen.getByRole('button', { name: 'Section A' })).toHaveClass('accordion2-trigger')
	})

	it('clicking trigger opens the panel', async () => {
		const user = userEvent.setup()
		render(
			<Accordion.Root>
				<Accordion.Item value="a">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)
		expect(screen.queryByText('Panel A content')).not.toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Section A' }))
		expect(screen.getByText('Panel A content')).toBeInTheDocument()
	})

	it('clicking trigger twice closes the panel again', async () => {
		const user = userEvent.setup()
		render(
			<Accordion.Root>
				<Accordion.Item value="a">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)
		await user.click(screen.getByRole('button', { name: 'Section A' }))
		expect(screen.getByText('Panel A content')).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Section A' }))
		expect(screen.queryByText('Panel A content')).not.toBeInTheDocument()
	})
})

describe('Accordion callbacks and classes', () => {
	it('calls onValueChange when an item is toggled', async () => {
		const user = userEvent.setup()
		const onValueChange = vi.fn()

		render(
			<Accordion.Root onValueChange={onValueChange}>
				<Accordion.Item value="a">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)

		await user.click(screen.getByRole('button', { name: 'Section A' }))
		expect(onValueChange).toHaveBeenCalledOnce()
		expect(onValueChange).toHaveBeenLastCalledWith(['a'], expect.anything())
	})

	it('applies custom className to item and panel', () => {
		const { container } = render(
			<Accordion.Root defaultValue={['a']}>
				<Accordion.Item value="a" className="my-item">
					<Accordion.Header>
						<Accordion.Trigger>Section A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel className="my-panel">Panel A content</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		)

		const item = container.querySelector('.accordion2-item')
		expect(item).toHaveClass('accordion2-item', 'my-item')

		const panel = container.querySelector('.accordion2-panel')
		expect(panel).toHaveClass('accordion2-panel', 'my-panel')
	})
})
