import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ContextHelpButton } from '../PanelIcons'

// ContextHelpButton renders through two wrapper paths depending on whether `children` (the hover
// help) is provided: with children it goes through InlineHelpCustom, without it a plain span. In both
// cases the `.context-help-button` element carries the default class plus any caller-provided one.

describe('ContextHelpButton', () => {
	describe('without help children (plain-span path)', () => {
		it('renders the default context-help-button class', () => {
			render(<ContextHelpButton action="/user-guide/config/connections" />)
			expect(document.querySelector('.context-help-button')).toBeInTheDocument()
		})

		it('applies a caller-provided className alongside the default', () => {
			render(<ContextHelpButton action="/user-guide/config/connections" className="pe-2" />)
			const el = document.querySelector('.context-help-button')
			expect(el).toHaveClass('context-help-button', 'pe-2')
		})

		it('omitting className leaves only the default class', () => {
			render(<ContextHelpButton action="/user-guide/config/connections" />)
			expect(document.querySelector('.context-help-button')).toHaveClass('context-help-button')
		})
	})

	describe('with help children (InlineHelpCustom path)', () => {
		it('applies both the default and caller-provided className to the trigger', () => {
			render(
				<ContextHelpButton action="/user-guide/config/connections" className="pe-2">
					Some help text
				</ContextHelpButton>
			)
			const trigger = document.querySelector('.inline-help-outer')
			expect(trigger).toHaveClass('context-help-button', 'pe-2')
		})

		it('omitting className leaves only the default class on the trigger', () => {
			render(<ContextHelpButton action="/user-guide/config/connections">Some help text</ContextHelpButton>)
			const trigger = document.querySelector('.inline-help-outer')
			expect(trigger).toHaveClass('context-help-button')
			expect(trigger).not.toHaveClass('undefined')
		})
	})
})
