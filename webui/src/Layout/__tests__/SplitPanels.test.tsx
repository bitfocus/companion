import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SplitPanels } from '../SplitPanels'

// `max-xl:hidden` is the whole visibility mechanism: a panel is hidden only below the width at which
// both fit, and never has a display forced on it, so it keeps whatever its own classes give it.
const HIDE = 'max-xl:hidden'

function renderPanels(showing: 'primary' | 'secondary' | null) {
	const { container } = render(
		<SplitPanels.Root showing={showing}>
			<SplitPanels.Primary>primary</SplitPanels.Primary>
			<SplitPanels.Secondary>secondary</SplitPanels.Secondary>
		</SplitPanels.Root>
	)
	const root = container.firstChild as HTMLElement
	return { root, primary: root.children[0], secondary: root.children[1] }
}

describe('SplitPanels', () => {
	it('renders the split container and both panels', () => {
		const { root, primary, secondary } = renderPanels(null)
		expect(root).toHaveClass('split-panels')
		expect(primary).toHaveClass('primary-panel')
		expect(secondary).toHaveClass('secondary-panel')
	})

	it("showing='primary' hides only the secondary while there is room for one", () => {
		const { primary, secondary } = renderPanels('primary')
		expect(primary).not.toHaveClass(HIDE)
		expect(secondary).toHaveClass(HIDE)
	})

	it("showing='secondary' hides only the primary", () => {
		const { primary, secondary } = renderPanels('secondary')
		expect(primary).toHaveClass(HIDE)
		expect(secondary).not.toHaveClass(HIDE)
	})

	it('showing={null} keeps both panels on show at every width', () => {
		const { primary, secondary } = renderPanels(null)
		expect(primary).not.toHaveClass(HIDE)
		expect(secondary).not.toHaveClass(HIDE)
	})

	it('never forces a display on a visible panel, so its own classes decide', () => {
		const { primary } = renderPanels('primary')
		expect(primary.className).not.toMatch(/\b(block|flex|grid)\b/)
	})

	it('merges className and passes through HTML attributes', () => {
		const { container } = render(
			<SplitPanels.Root showing={null} className="connections-page" data-testid="root">
				<SplitPanels.Primary className="connections-panel">primary</SplitPanels.Primary>
			</SplitPanels.Root>
		)
		const root = container.firstChild as HTMLElement
		expect(root).toHaveClass('split-panels', 'connections-page')
		expect(root.getAttribute('data-testid')).toBe('root')
		expect(root.children[0]).toHaveClass('primary-panel', 'connections-panel')
	})

	it('a panel outside a root is not hidden', () => {
		const { container } = render(<SplitPanels.Primary />)
		expect(container.firstChild).not.toHaveClass(HIDE)
	})
})
