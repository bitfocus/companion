import { render } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	clampPrimaryPercent,
	SPLIT_PANELS_DEFAULT_MIN_PX,
	SPLIT_PANELS_DEFAULT_PRIMARY_PERCENT,
	SplitPanels,
	type SplitPanelsResizeConfig,
} from '../SplitPanels'

// The resizable path reads the xl breakpoint via useTwoPanelMode; drive it directly so the tests
// don't depend on jsdom media queries or the breakpoint CSS custom properties.
const mockTwoPanelMode = vi.hoisted(() => ({ value: true }))
vi.mock('~/Hooks/useLayoutMode.js', () => ({
	useTwoPanelMode: () => mockTwoPanelMode.value,
	useMobileMode: () => false,
}))

// jsdom runs on an opaque origin, so window.localStorage is undefined. Install a minimal in-memory Storage.
class MemoryStorage {
	#m = new Map<string, string>()
	get length(): number {
		return this.#m.size
	}
	key(i: number): string | null {
		return Array.from(this.#m.keys())[i] ?? null
	}
	getItem(k: string): string | null {
		return this.#m.has(k) ? this.#m.get(k)! : null
	}
	setItem(k: string, v: string): void {
		this.#m.set(k, String(v))
	}
	removeItem(k: string): void {
		this.#m.delete(k)
	}
	clear(): void {
		this.#m.clear()
	}
}

beforeAll(() => {
	Object.defineProperty(window, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true })
})

const RESIZE: SplitPanelsResizeConfig = {
	storageKey: 'test-view',
	minPrimaryPx: 300,
	minSecondaryPx: 350,
	defaultPrimaryPercent: 50,
}

// `max-xl:hidden` is the whole visibility mechanism: a panel is hidden only below the width at which
// both fit, and never has a display forced on it, so it keeps whatever its own classes give it.
const HIDE = 'max-xl:hidden'

function renderPanels(showing: 'primary' | 'secondary' | null, resize: SplitPanelsResizeConfig | null = null) {
	const { container } = render(
		<SplitPanels.Root showing={showing} resize={resize}>
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
			<SplitPanels.Root showing={null} className="connections-page" data-testid="root" resize={null}>
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

describe('SplitPanels resize', () => {
	beforeEach(() => {
		mockTwoPanelMode.value = true
		window.localStorage.clear()
	})

	it('renders the handle and drives the columns from the stored percent when in two-panel mode', () => {
		const { root } = renderPanels(null, RESIZE)
		expect(root).toHaveClass('split-panels-resizable')
		expect(root.style.gridTemplateColumns).toBe('minmax(300px, 50fr) minmax(350px, 50fr)')
		expect(root.querySelector('.split-panels-resize-handle')).not.toBeNull()
	})

	it('falls back to the shared default min widths and split when only a storageKey is given', () => {
		const { root } = renderPanels(null, { storageKey: 'defaults-view' })
		const min = SPLIT_PANELS_DEFAULT_MIN_PX
		const pct = SPLIT_PANELS_DEFAULT_PRIMARY_PERCENT
		expect(root.style.gridTemplateColumns).toBe(`minmax(${min}px, ${pct}fr) minmax(${min}px, ${100 - pct}fr)`)
	})

	it('uses a stored percentage over the default', () => {
		window.localStorage.setItem('split-panels-width:test-view', '70')
		const { root } = renderPanels(null, RESIZE)
		expect(root.style.gridTemplateColumns).toBe('minmax(300px, 70fr) minmax(350px, 30fr)')
	})

	it('does not resize (no handle, no inline columns) below the two-panel breakpoint', () => {
		mockTwoPanelMode.value = false
		const { root } = renderPanels(null, RESIZE)
		expect(root).not.toHaveClass('split-panels-resizable')
		expect(root.style.gridTemplateColumns).toBe('')
		expect(root.querySelector('.split-panels-resize-handle')).toBeNull()
	})

	it('is fully inert when resize is null', () => {
		const { root } = renderPanels(null, null)
		expect(root).not.toHaveClass('split-panels-resizable')
		expect(root.querySelector('.split-panels-resize-handle')).toBeNull()
	})
})

describe('clampPrimaryPercent', () => {
	// available = 1000, mins 300/350 → primary px is free to move within [300, 650]
	it('maps an unconstrained width straight to its percentage', () => {
		expect(clampPrimaryPercent(500, 1000, 300, 350)).toBe(50)
		expect(clampPrimaryPercent(600, 1000, 300, 350)).toBe(60)
	})

	it('clamps to the primary minimum', () => {
		expect(clampPrimaryPercent(100, 1000, 300, 350)).toBe(30)
	})

	it('clamps to the secondary minimum (available - minSecondary)', () => {
		expect(clampPrimaryPercent(900, 1000, 300, 350)).toBe(65)
	})
})
