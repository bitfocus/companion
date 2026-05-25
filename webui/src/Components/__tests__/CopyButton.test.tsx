import { act, fireEvent, render, screen } from '@testing-library/react'
import copy from 'copy-to-clipboard'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CopyButton } from '../CopyButton'

vi.mock('copy-to-clipboard', () => ({ default: vi.fn().mockResolvedValue(true) }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderButton(props: Partial<Parameters<typeof CopyButton>[0]> = {}) {
	return render(<CopyButton text="hello" {...props} />)
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('CopyButton rendering', () => {
	it('renders a button', () => {
		renderButton()
		expect(screen.getByRole('button')).toBeInTheDocument()
	})

	it('uses default title', () => {
		renderButton()
		expect(screen.getByRole('button')).toHaveAttribute('title', 'Copy to clipboard')
	})

	it('uses a custom title', () => {
		renderButton({ title: 'Copy variable name' })
		expect(screen.getByRole('button')).toHaveAttribute('title', 'Copy variable name')
	})
})

// ---------------------------------------------------------------------------
// Copy behaviour
// ---------------------------------------------------------------------------

describe('CopyButton copy behaviour', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	it('calls copy with the provided text on mousedown', () => {
		renderButton({ text: 'hello world' })
		fireEvent.mouseDown(screen.getByRole('button'))
		expect(copy).toHaveBeenCalledWith('hello world')
	})

	it('switches title to "Copied!" after click', async () => {
		renderButton()
		await act(async () => {
			fireEvent.mouseDown(screen.getByRole('button'))
		})
		expect(screen.getByRole('button')).toHaveAttribute('title', 'Copied!')
	})

	it('reverts title back after 2 seconds', async () => {
		renderButton({ title: 'My custom title' })
		await act(async () => {
			fireEvent.mouseDown(screen.getByRole('button'))
		})
		expect(screen.getByRole('button')).toHaveAttribute('title', 'Copied!')
		act(() => {
			vi.advanceTimersByTime(2000)
		})
		expect(screen.getByRole('button')).toHaveAttribute('title', 'My custom title')
	})

	it('does not revert title before 2 seconds', async () => {
		renderButton()
		await act(async () => {
			fireEvent.mouseDown(screen.getByRole('button'))
		})
		act(() => {
			vi.advanceTimersByTime(1999)
		})
		expect(screen.getByRole('button')).toHaveAttribute('title', 'Copied!')
	})
})
