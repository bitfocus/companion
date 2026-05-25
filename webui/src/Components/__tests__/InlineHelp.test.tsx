import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { InlineHelpCustom, InlineHelpIcon } from '../InlineHelp'

// ---------------------------------------------------------------------------
// InlineHelpCustom
// ---------------------------------------------------------------------------

describe('InlineHelpCustom', () => {
	it('renders children inside the trigger span', () => {
		render(<InlineHelpCustom help="Help text">Label text</InlineHelpCustom>)
		expect(screen.getByText('Label text')).toBeInTheDocument()
	})

	it('trigger is a span with tabIndex=0', () => {
		render(<InlineHelpCustom help="Help text">Label</InlineHelpCustom>)
		const trigger = screen.getByText('Label').closest('span')
		expect(trigger).toHaveAttribute('tabindex', '0')
	})

	it('trigger has inline-help-outer class', () => {
		render(<InlineHelpCustom help="Help text">Label</InlineHelpCustom>)
		const trigger = screen.getByText('Label').closest('span')
		expect(trigger).toHaveClass('inline-help-outer')
	})

	it('applies a custom className to the trigger span', () => {
		render(
			<InlineHelpCustom help="Help text" className="my-custom-class">
				Label
			</InlineHelpCustom>
		)
		const trigger = screen.getByText('Label').closest('span')
		expect(trigger).toHaveClass('my-custom-class')
	})

	it('tooltip is not visible initially', () => {
		render(<InlineHelpCustom help="Help text">Label</InlineHelpCustom>)
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
	})

	describe('hover behaviour', () => {
		it('shows the tooltip after hovering (delay=300ms)', async () => {
			const user = userEvent.setup()
			render(<InlineHelpCustom help="Help text">Label</InlineHelpCustom>)
			await user.hover(screen.getByText('Label'))
			await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument(), { timeout: 1000 })
			expect(screen.getByRole('tooltip')).toHaveTextContent('Help text')
		})

		it('renders ReactNode help content inside the tooltip', async () => {
			const user = userEvent.setup()
			render(<InlineHelpCustom help={<span data-testid="rich">Rich content</span>}>Label</InlineHelpCustom>)
			await user.hover(screen.getByText('Label'))
			await waitFor(() => expect(screen.getByTestId('rich')).toBeInTheDocument(), { timeout: 1000 })
		})

		it('hides the tooltip after pointer leaves (closeDelay=100ms)', async () => {
			const user = userEvent.setup()
			render(<InlineHelpCustom help="Help text">Label</InlineHelpCustom>)
			await user.hover(screen.getByText('Label'))
			await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument(), { timeout: 1000 })
			await user.unhover(screen.getByText('Label'))
			await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(), { timeout: 1000 })
		})
	})
})

// ---------------------------------------------------------------------------
// InlineHelpIcon
// ---------------------------------------------------------------------------

describe('InlineHelpIcon', () => {
	it('renders an svg icon as the trigger', () => {
		render(<InlineHelpIcon>Help text</InlineHelpIcon>)
		expect(document.querySelector('svg')).toBeInTheDocument()
	})

	it('trigger span has inline-help-outer class', () => {
		render(<InlineHelpIcon>Help text</InlineHelpIcon>)
		const svg = document.querySelector('svg')!
		expect(svg.closest('span')).toHaveClass('inline-help-outer')
	})

	it('applies a custom className', () => {
		render(<InlineHelpIcon className="icon-help">Help text</InlineHelpIcon>)
		const svg = document.querySelector('svg')!
		expect(svg.closest('span')).toHaveClass('icon-help')
	})

	it('tooltip is not visible initially', () => {
		render(<InlineHelpIcon>Help text</InlineHelpIcon>)
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
	})

	it('shows the tooltip with children as content on hover', async () => {
		const user = userEvent.setup()
		render(<InlineHelpIcon>Help text</InlineHelpIcon>)
		await user.hover(document.querySelector('svg')!)
		await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Help text'), { timeout: 1000 })
	})
})
