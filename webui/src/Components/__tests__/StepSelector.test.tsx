import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StepSelector, type StepSelectorItem } from '../StepSelector'

const ITEMS: StepSelectorItem[] = [
	{ index: 1, title: 'Surfaces' },
	{ index: 2, title: 'Services' },
	{ index: 3, title: 'Usage Stats', isNew: true },
	{ index: 4, title: 'Review' },
]

describe('StepSelector', () => {
	it('renders one entry per item with sequential numbers', () => {
		render(<StepSelector items={ITEMS} currentIndex={1} onJump={() => {}} />)

		for (const item of ITEMS) {
			expect(screen.getByRole('button', { name: item.title })).toBeInTheDocument()
		}
		// First (active) step shows its number rather than a check
		expect(screen.getByRole('button', { name: 'Surfaces' })).toHaveTextContent('1')
	})

	it('marks the active step with aria-current and the active class', () => {
		const { container } = render(<StepSelector items={ITEMS} currentIndex={2} onJump={() => {}} />)

		expect(screen.getByRole('button', { name: 'Services' })).toHaveAttribute('aria-current', 'step')
		expect(container.querySelector('.step-selector-step-active')).toHaveTextContent('Services')
	})

	it('marks earlier steps as complete and later steps as upcoming', () => {
		const { container } = render(<StepSelector items={ITEMS} currentIndex={3} onJump={() => {}} />)

		const complete = container.querySelectorAll('.step-selector-step-complete')
		expect(complete).toHaveLength(2) // Surfaces + Services
		const upcoming = container.querySelectorAll('.step-selector-step-upcoming')
		expect(upcoming).toHaveLength(1) // Review
	})

	it('renders a New badge for upgrade-flagged steps', () => {
		render(<StepSelector items={ITEMS} currentIndex={1} onJump={() => {}} />)
		expect(screen.getByText('New')).toBeInTheDocument()
	})

	it('calls onJump with the item index when a step is clicked', async () => {
		const user = userEvent.setup()
		const onJump = vi.fn()
		render(<StepSelector items={ITEMS} currentIndex={1} onJump={onJump} />)

		await user.click(screen.getByRole('button', { name: 'Review' }))
		expect(onJump).toHaveBeenCalledOnce()
		expect(onJump).toHaveBeenLastCalledWith(4)
	})
})
