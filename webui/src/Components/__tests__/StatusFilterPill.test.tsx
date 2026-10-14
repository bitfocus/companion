import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StatusFilterPill } from '../StatusFilterPill'

describe('StatusFilterPill', () => {
	it('renders as a filter button with its label and count', () => {
		render(<StatusFilterPill label="Errors" count={3} isActive={false} onClick={vi.fn()} />)
		const button = screen.getByRole('button', { name: 'Filter by Errors' })
		expect(button).toHaveClass('button-filter')
		expect(button).toHaveTextContent('Errors')
		expect(button).toHaveTextContent('3')
	})

	it('exposes the active state as aria-pressed', () => {
		const { rerender } = render(<StatusFilterPill label="Errors" count={3} isActive={false} onClick={vi.fn()} />)
		expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed')

		rerender(<StatusFilterPill label="Errors" count={3} isActive onClick={vi.fn()} />)
		expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
	})

	it('calls onClick when clicked', async () => {
		const onClick = vi.fn()
		render(<StatusFilterPill label="Errors" count={3} isActive={false} onClick={onClick} />)
		await userEvent.click(screen.getByRole('button'))
		expect(onClick).toHaveBeenCalledOnce()
	})

	it('is disabled when the count is zero', () => {
		render(<StatusFilterPill label="Errors" count={0} isActive={false} onClick={vi.fn()} />)
		expect(screen.getByRole('button')).toBeDisabled()
	})

	it('renders the status dot only when given a dot class', () => {
		const { container, rerender } = render(
			<StatusFilterPill label="Errors" count={3} isActive={false} onClick={vi.fn()} />
		)
		expect(container.querySelector('.status-filter-pill-dot')).toBeNull()

		rerender(
			<StatusFilterPill label="Errors" count={3} dotClass="bg-tone-error-fill" isActive={false} onClick={vi.fn()} />
		)
		expect(container.querySelector('.status-filter-pill-dot')).toHaveClass('bg-tone-error-fill')
	})
})
