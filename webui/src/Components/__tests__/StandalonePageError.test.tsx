import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StandalonePageError } from '../StandalonePageError'

describe('StandalonePageError error state', () => {
	it('renders the default friendly title and message', () => {
		const { container } = render(<StandalonePageError error="Kaboom" dataReady={false} />)
		expect(screen.getByText('Unable to reach Companion')).toBeInTheDocument()
		expect(screen.getByText('Trying to reconnect…')).toBeInTheDocument()
		expect(container.firstChild).toHaveClass('standalone-overlay')
	})

	it('does not surface the raw technical error text', () => {
		render(<StandalonePageError error="WebSocket closed" dataReady={false} />)
		expect(screen.queryByText('WebSocket closed')).not.toBeInTheDocument()
	})

	it('renders custom title and message', () => {
		render(<StandalonePageError error="Kaboom" dataReady={false} title="Emulator offline" message="Hold on" />)
		expect(screen.getByText('Emulator offline')).toBeInTheDocument()
		expect(screen.getByText('Hold on')).toBeInTheDocument()
	})

	it('renders a Refresh button and calls doRetry on click', () => {
		const doRetry = vi.fn()
		render(<StandalonePageError error="Kaboom" dataReady={false} doRetry={doRetry} />)
		fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
		expect(doRetry).toHaveBeenCalledOnce()
	})

	it('uses a custom retry label', () => {
		render(<StandalonePageError error="Kaboom" dataReady={false} doRetry={vi.fn()} retryLabel="Reload" />)
		expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
	})

	it('does not render a retry button when data is ready', () => {
		render(<StandalonePageError error="Kaboom" dataReady={true} doRetry={vi.fn()} />)
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
	})

	it('does not render a retry button without doRetry', () => {
		render(<StandalonePageError error="Kaboom" dataReady={false} />)
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
	})
})

describe('StandalonePageError loading state', () => {
	it('renders the spinner overlay with no heading or button when there is no error', () => {
		const { container } = render(<StandalonePageError dataReady={false} error={null} />)
		expect(container.firstChild).toHaveClass('standalone-overlay')
		expect(screen.queryByRole('heading')).not.toBeInTheDocument()
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
	})
})
