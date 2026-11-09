import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RowButton } from '../RowButton'

describe('RowButton', () => {
	it('is a button named by its title and description, which calls onClick', () => {
		const onClick = vi.fn()
		render(<RowButton title="Direct" description="By address" onClick={onClick} />)

		const button = screen.getByRole('button', { name: 'Direct By address' })
		fireEvent.click(button)
		expect(onClick).toHaveBeenCalledTimes(1)
	})
})
