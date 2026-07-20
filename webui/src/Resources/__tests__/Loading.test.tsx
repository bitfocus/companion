import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoadingRetryOrError } from '../Loading'

describe('LoadingRetryOrError error state', () => {
	it('renders a string error message', () => {
		render(<LoadingRetryOrError error="Boom" dataReady={false} design="pulse" />)
		expect(screen.getByRole('alert')).toHaveTextContent('Boom')
	})

	it('renders the message from an error object', () => {
		render(<LoadingRetryOrError error={{ message: 'Object boom' } as any} dataReady={false} design="pulse" />)
		expect(screen.getByRole('alert')).toHaveTextContent('Object boom')
	})

	it('renders a retry button and calls doRetry on click', () => {
		const doRetry = vi.fn()
		render(<LoadingRetryOrError error="Boom" dataReady={false} doRetry={doRetry} design="pulse" />)
		fireEvent.click(screen.getByRole('button', { name: /retry/i }))
		expect(doRetry).toHaveBeenCalledOnce()
	})

	it('uses a custom retry label', () => {
		render(<LoadingRetryOrError error="Boom" dataReady={false} doRetry={vi.fn()} retryLabel="Reload" design="pulse" />)
		expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
	})

	it('does not render a retry button when data is ready', () => {
		render(<LoadingRetryOrError error="Boom" dataReady={true} doRetry={vi.fn()} design="pulse" />)
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
	})

	it('does not render a retry button when no doRetry is provided', () => {
		render(<LoadingRetryOrError error="Boom" dataReady={false} design="pulse" />)
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
	})
})

describe('LoadingRetryOrError loading state', () => {
	it('renders no alert when there is no error and data is not ready', () => {
		render(<LoadingRetryOrError dataReady={false} design="pulse" />)
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	})

	it('renders nothing when data is ready and there is no error', () => {
		const { container } = render(<LoadingRetryOrError dataReady={true} design="pulse" />)
		expect(container).toBeEmptyDOMElement()
	})
})

describe('LoadingRetryOrError auto retry', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	it('calls doRetry when the countdown reaches zero', () => {
		const doRetry = vi.fn()
		render(<LoadingRetryOrError error="Boom" dataReady={false} doRetry={doRetry} autoRetryAfter={3} design="pulse" />)
		act(() => {
			vi.advanceTimersByTime(3000)
		})
		expect(doRetry).toHaveBeenCalled()
	})
})
