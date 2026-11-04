import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResizeHandle } from '~/Components/ResizeHandle.js'
import { splitTemplateFor, useSplitResize, type SplitOrientation } from '../useSplitResize.js'

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

beforeEach(() => {
	window.localStorage.clear()
})

const KEY = 'test-split'

function Split({ orientation, enabled }: { orientation: SplitOrientation; enabled: boolean }) {
	const { rootRef, rootStyle, handleProps } = useSplitResize({
		orientation,
		enabled,
		storageKey: KEY,
		panelSelectors: ['.first', '.second'],
		minFirstPx: 100,
		minSecondPx: 200,
		defaultFirstPercent: 30,
	})
	return (
		<div ref={rootRef} data-testid="root" style={rootStyle}>
			<div className="first" />
			<div className="second" />
			{enabled && <ResizeHandle {...handleProps} />}
		</div>
	)
}

function renderSplit(orientation: SplitOrientation, enabled = true) {
	render(<Split orientation={orientation} enabled={enabled} />)
	return { root: screen.getByTestId('root'), handle: screen.queryByRole('separator') }
}

function storedPercent(): number | null {
	const raw = window.localStorage.getItem(KEY)
	return raw === null ? null : Number(raw)
}

function rect(r: Partial<DOMRect>): DOMRect {
	return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}), ...r }
}

describe('useSplitResize', () => {
	it('sets the rows from the default percent for a vertical split', () => {
		const { root, handle } = renderSplit('vertical')
		expect(root.style.gridTemplateRows).toBe('minmax(100px, 30fr) minmax(200px, 70fr)')
		expect(root.style.gridTemplateColumns).toBe('')
		expect(handle).toHaveClass('resize-handle', 'vertical')
		expect(handle).toHaveAttribute('aria-orientation', 'horizontal')
	})

	it('sets the columns for a horizontal split', () => {
		const { root, handle } = renderSplit('horizontal')
		expect(root.style.gridTemplateColumns).toBe('minmax(100px, 30fr) minmax(200px, 70fr)')
		expect(root.style.gridTemplateRows).toBe('')
		expect(handle).toHaveClass('resize-handle', 'horizontal')
		expect(handle).toHaveAttribute('aria-orientation', 'vertical')
	})

	it('uses the stored percent over the default', () => {
		window.localStorage.setItem(KEY, '60')
		const { root, handle } = renderSplit('vertical')
		expect(root.style.gridTemplateRows).toBe('minmax(100px, 60fr) minmax(200px, 40fr)')
		expect(handle).toHaveAttribute('aria-valuenow', '60')
	})

	it('leaves the layout alone while not enabled', () => {
		const { root } = renderSplit('vertical', false)
		expect(root.style.gridTemplateRows).toBe('')
		expect(root.style.gridTemplateColumns).toBe('')
	})

	it('steps a vertical split with up/down, and shift for bigger steps', () => {
		const { handle } = renderSplit('vertical')
		fireEvent.keyDown(handle!, { key: 'ArrowDown' })
		expect(storedPercent()).toBe(32)
		fireEvent.keyDown(handle!, { key: 'ArrowUp', shiftKey: true })
		expect(storedPercent()).toBe(22)
	})

	it('steps a horizontal split with left/right', () => {
		const { handle } = renderSplit('horizontal')
		fireEvent.keyDown(handle!, { key: 'ArrowRight' })
		expect(storedPercent()).toBe(32)
		fireEvent.keyDown(handle!, { key: 'ArrowLeft' })
		expect(storedPercent()).toBe(30)
	})

	it('keeps keyboard steps within 20-80%', () => {
		const { handle } = renderSplit('vertical')
		fireEvent.keyDown(handle!, { key: 'ArrowUp', shiftKey: true })
		fireEvent.keyDown(handle!, { key: 'ArrowUp', shiftKey: true })
		expect(storedPercent()).toBe(20)
		fireEvent.keyDown(handle!, { key: 'End' })
		expect(storedPercent()).toBe(80)
		fireEvent.keyDown(handle!, { key: 'Home' })
		expect(storedPercent()).toBe(20)
	})

	it('resets to the default on Enter and on double-click', () => {
		window.localStorage.setItem(KEY, '60')
		const { handle } = renderSplit('vertical')
		fireEvent.keyDown(handle!, { key: 'Enter' })
		expect(storedPercent()).toBe(30)

		fireEvent.keyDown(handle!, { key: 'End' })
		fireEvent.doubleClick(handle!)
		expect(storedPercent()).toBe(30)
	})

	it('drags a vertical split along the y axis, clamped to the minimums, and saves on release', () => {
		const { root, handle } = renderSplit('vertical')
		const [first, second] = [root.querySelector('.first')!, root.querySelector('.second')!]
		// Two panels 300px + 700px tall, with a 20px gap between them
		vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 1020, height: 1020 }))
		vi.spyOn(first, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 300, height: 300 }))
		vi.spyOn(second, 'getBoundingClientRect').mockReturnValue(rect({ top: 320, bottom: 1020, height: 700 }))
		handle!.setPointerCapture = vi.fn()
		handle!.hasPointerCapture = vi.fn(() => true)
		handle!.releasePointerCapture = vi.fn()

		fireEvent.pointerDown(handle!, { pointerId: 1, clientX: 0, clientY: 310 })
		expect(handle).toHaveAttribute('data-dragging', 'true')

		fireEvent.pointerMove(handle!, { pointerId: 1, clientX: 500, clientY: 410 })
		expect(root.style.gridTemplateRows).toBe(splitTemplateFor(100, 200, 40))
		expect(storedPercent()).toBeNull()

		// Past the second panel's minimum: clamped to 1000 - 200 = 800px
		fireEvent.pointerMove(handle!, { pointerId: 1, clientX: 0, clientY: 1000 })
		expect(root.style.gridTemplateRows).toBe(splitTemplateFor(100, 200, 80))

		fireEvent.pointerUp(handle!, { pointerId: 1 })
		expect(storedPercent()).toBe(80)
		expect(handle).not.toHaveAttribute('data-dragging')
	})
})
