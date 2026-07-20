import { createEvent, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ButtonPreview, ButtonPreviewBase } from '../ButtonPreview'

const location: ControlLocation = { pageNumber: 1, row: 2, column: 3 }

type Props = Parameters<typeof ButtonPreview>[0]

function setup(props: Partial<Props> = {}) {
	const onClick = vi.fn()
	const utils = render(<ButtonPreview location={location} preview={false} onClick={onClick} {...props} />)
	// The outermost element is the `.button-control` div that carries all the interaction handlers.
	const root = utils.container.firstElementChild as HTMLElement
	return { onClick, root, ...utils }
}

/**
 * Dispatch a cancelable native `touchstart` and report whether the default was prevented.
 * This is the exact mechanism that suppresses Android Chrome's long-press gesture (and its haptic
 * buzz) - see the non-passive listener in ButtonPreview. jsdom has no haptics, so this is the
 * closest faithful proxy for "the phone does not buzz".
 */
function dispatchTouchStart(el: HTMLElement): boolean {
	const event = createEvent.touchStart(el, { cancelable: true, bubbles: true })
	fireEvent(el, event)
	return event.defaultPrevented
}

describe('ButtonPreview', () => {
	it('renders as clickable when an onClick handler is provided', () => {
		const { root } = setup()
		expect(root).toHaveClass('button-control', 'clickable')
	})

	it('is not clickable without an onClick handler', () => {
		const { container } = render(<ButtonPreview location={location} preview={false} />)
		expect(container.firstElementChild).not.toHaveClass('clickable')
	})

	it('applies the title and placeholder', () => {
		const { root } = setup({ title: 'Button 2/3', placeholder: '2/3' })
		expect(root.querySelector('.button-border')).toHaveAttribute('title', 'Button 2/3')
		expect(root.querySelector('.button-placeholder')).toHaveTextContent('2/3')
	})

	it('reflects the selected / copy-source / context-menu-open state as classes', () => {
		const { root } = setup({ selected: true, copySource: true, contextMenuOpen: true })
		expect(root).toHaveClass('selected', 'copy-source', 'context-menu-open')
	})

	describe('press & release (pointer events)', () => {
		it('fires a press on pointerdown and a release on pointerup, in order', () => {
			const { root, onClick } = setup()

			fireEvent.pointerDown(root, { button: 0 })
			fireEvent.pointerUp(root)

			expect(onClick.mock.calls).toEqual([
				[location, true],
				[location, false],
			])
		})

		it('ignores the secondary (right-click) pointer button', () => {
			const { root, onClick } = setup({ onContextMenu: vi.fn() })

			fireEvent.pointerDown(root, { button: 2 })

			expect(onClick).not.toHaveBeenCalled()
		})

		it('does not emit a release that was never preceded by a press', () => {
			// A spurious pointercancel (button=0) can follow a right-click; it must not release a
			// button that was never pressed.
			const { root, onClick } = setup({ onContextMenu: vi.fn() })

			fireEvent.pointerDown(root, { button: 2 }) // secondary → no press
			fireEvent.pointerCancel(root)

			expect(onClick).not.toHaveBeenCalled()
		})

		it('releases only once when pointerup is followed by pointercancel', () => {
			const { root, onClick } = setup({ onContextMenu: vi.fn() })

			fireEvent.pointerDown(root, { button: 0 })
			fireEvent.pointerUp(root)
			fireEvent.pointerCancel(root)

			expect(onClick).toHaveBeenCalledTimes(2)
			expect(onClick.mock.calls).toEqual([
				[location, true],
				[location, false],
			])
		})

		it('does not throw when pressed without an onClick handler', () => {
			const { container } = render(<ButtonPreview location={location} preview={false} />)
			const root = container.firstElementChild as HTMLElement

			expect(() => {
				fireEvent.pointerDown(root, { button: 0 })
				fireEvent.pointerUp(root)
			}).not.toThrow()
		})
	})

	// The regression from issue #4322: on a hold button (no context menu) a stationary touch on
	// Android Chrome triggers a long-press gesture which fires pointercancel / contextmenu. Those must
	// NOT release the button - it should stay held until the finger is lifted (pointerup).
	describe('hold buttons keep the press through a long-press (issue #4322)', () => {
		it('does not release on pointercancel', () => {
			const { root, onClick } = setup() // no onContextMenu → hold button

			fireEvent.pointerDown(root, { button: 0 })
			fireEvent.pointerCancel(root)

			expect(onClick).toHaveBeenCalledTimes(1)
			expect(onClick).toHaveBeenCalledWith(location, true)
		})

		it('does not release on the long-press contextmenu, then releases on pointerup', () => {
			const { root, onClick } = setup() // hold button

			fireEvent.pointerDown(root, { button: 0 })
			fireEvent.contextMenu(root) // long-press gesture
			expect(onClick).toHaveBeenCalledTimes(1) // still held

			fireEvent.pointerUp(root) // finger lifted
			expect(onClick.mock.calls).toEqual([
				[location, true],
				[location, false],
			])
		})

		it('survives a pointercancel AND contextmenu, releasing only on pointerup', () => {
			const { root, onClick } = setup()

			fireEvent.pointerDown(root, { button: 0 })
			fireEvent.pointerCancel(root)
			fireEvent.contextMenu(root)
			expect(onClick).toHaveBeenCalledTimes(1) // never released by the gesture

			fireEvent.pointerUp(root)
			expect(onClick).toHaveBeenLastCalledWith(location, false)
		})
	})

	describe('grid buttons (with a context menu) still use long-press for the menu', () => {
		it('releases the in-progress press and opens the menu on contextmenu', () => {
			const onContextMenu = vi.fn()
			const { root, onClick } = setup({ onContextMenu })

			fireEvent.pointerDown(root, { button: 0 })
			fireEvent.contextMenu(root, { clientX: 11, clientY: 22 })

			expect(onClick).toHaveBeenCalledWith(location, false) // press released before the menu
			expect(onContextMenu).toHaveBeenCalledWith(location, 11, 22)
		})

		it('releases on pointercancel', () => {
			const { root, onClick } = setup({ onContextMenu: vi.fn() })

			fireEvent.pointerDown(root, { button: 0 })
			fireEvent.pointerCancel(root)

			expect(onClick).toHaveBeenCalledWith(location, false)
		})

		it('lets the native menu through (does not open ours) when a modifier key is held', () => {
			const onContextMenu = vi.fn()
			const { root, onClick } = setup({ onContextMenu })

			fireEvent.pointerDown(root, { button: 0 })
			const event = createEvent.contextMenu(root, { ctrlKey: true, cancelable: true })
			fireEvent(root, event)

			expect(onContextMenu).not.toHaveBeenCalled()
			expect(event.defaultPrevented).toBe(false) // native menu allowed
			// The press is left intact and releases on pointerup as normal
			fireEvent.pointerUp(root)
			expect(onClick).toHaveBeenLastCalledWith(location, false)
		})
	})

	// The buzz fix from issue #4322: hold buttons attach a non-passive touchstart listener that
	// preventDefault()s, so the browser never starts its long-press gesture (no haptic buzz). Grid
	// buttons must NOT do this, so their long-press context menu keeps working.
	describe('long-press gesture suppression / haptic buzz (issue #4322)', () => {
		it('preventDefaults touchstart on hold buttons', () => {
			const { root } = setup() // no onContextMenu
			expect(dispatchTouchStart(root)).toBe(true)
		})

		it('does not preventDefault touchstart on grid buttons', () => {
			const { root } = setup({ onContextMenu: vi.fn() })
			expect(dispatchTouchStart(root)).toBe(false)
		})

		it('touchstart suppression does not itself trigger a press', () => {
			const { root, onClick } = setup()
			dispatchTouchStart(root)
			expect(onClick).not.toHaveBeenCalled()
		})

		it('removes / re-evaluates the listener when the context-menu handler changes', () => {
			const { root, rerender } = setup() // hold → listener attached
			expect(dispatchTouchStart(root)).toBe(true)

			// Now it becomes a grid button: the hold listener must be cleaned up
			rerender(<ButtonPreview location={location} preview={false} onClick={vi.fn()} onContextMenu={vi.fn()} />)
			expect(dispatchTouchStart(root)).toBe(false)
		})

		it('cleans up the listener on unmount', () => {
			const { root, unmount } = setup()
			unmount()
			// The node is detached; dispatching must not throw and nothing prevents default
			expect(dispatchTouchStart(root)).toBe(false)
		})
	})
})

// ButtonPreviewBase is the simpler sibling used for preset drag previews and the edit-button preview.
// It has no pointer-event handling, no location, and an onClick signature of (pressed) => void.
describe('ButtonPreviewBase', () => {
	type BaseProps = Parameters<typeof ButtonPreviewBase>[0]

	function setupBase(props: Partial<BaseProps> = {}) {
		const onClick = vi.fn()
		const utils = render(<ButtonPreviewBase preview={false} onClick={onClick} {...props} />)
		const root = utils.container.firstElementChild as HTMLElement
		return { onClick, root, ...utils }
	}

	describe('rendering', () => {
		it('is clickable only when an onClick handler is provided', () => {
			const { root } = setupBase()
			expect(root).toHaveClass('button-control', 'clickable')

			const { container } = render(<ButtonPreviewBase preview={false} />)
			expect(container.firstElementChild).not.toHaveClass('clickable')
		})

		it('maps fixedSize to the fixed / fixed-100 classes', () => {
			const { root: fixed } = setupBase({ fixedSize: true })
			expect(fixed).toHaveClass('fixed')
			expect(fixed).not.toHaveClass('fixed-100')

			const { root: fixed100 } = setupBase({ fixedSize: 100 })
			expect(fixed100).toHaveClass('fixed-100')
			expect(fixed100).not.toHaveClass('fixed')
		})

		it('reflects draggable / selected / right / custom className', () => {
			const { root } = setupBase({ dragRef: vi.fn(), selected: true, right: true, className: 'preset-drag-source' })
			expect(root).toHaveClass('draggable', 'selected', 'right', 'preset-drag-source')
		})

		it('applies the title and placeholder', () => {
			const { root } = setupBase({ title: 'A preset', placeholder: '1/2' })
			expect(root.querySelector('.button-border')).toHaveAttribute('title', 'A preset')
			expect(root.querySelector('.button-placeholder')).toHaveTextContent('1/2')
		})
	})

	describe('interaction', () => {
		it('presses on mousedown and releases on mouseup', () => {
			const { root, onClick } = setupBase()

			fireEvent.mouseDown(root)
			fireEvent.mouseUp(root)

			expect(onClick.mock.calls).toEqual([[true], [false]])
		})

		it('presses on touchstart and releases on touchend', () => {
			const { root, onClick } = setupBase()

			fireEvent.touchStart(root)
			fireEvent.touchEnd(root)

			expect(onClick.mock.calls).toEqual([[true], [false]])
		})

		it('releases on touchcancel', () => {
			const { root, onClick } = setupBase()

			fireEvent.touchStart(root)
			fireEvent.touchCancel(root)

			expect(onClick.mock.calls).toEqual([[true], [false]])
		})

		it('suppresses the browser context menu and does not treat it as a click', () => {
			const { root, onClick } = setupBase()

			const event = createEvent.contextMenu(root, { cancelable: true, bubbles: true })
			fireEvent(root, event)

			expect(event.defaultPrevented).toBe(true)
			expect(onClick).not.toHaveBeenCalled()
		})

		it('does not throw when interacted with without an onClick handler', () => {
			const { container } = render(<ButtonPreviewBase preview={false} />)
			const root = container.firstElementChild as HTMLElement

			expect(() => {
				fireEvent.mouseDown(root)
				fireEvent.mouseUp(root)
				fireEvent.touchStart(root)
				fireEvent.touchEnd(root)
			}).not.toThrow()
		})

		// Documents a real limitation: the preventDefault() in the touch handlers is a no-op because
		// React registers onTouchStart/onTouchMove as passive listeners. The browser's default touch
		// behaviour (e.g. synthesized compatibility mouse events) is therefore NOT suppressed here -
		// this is exactly why the interactive ButtonPreview attaches a native non-passive listener
		// instead of relying on the synthetic handler.
		it('cannot preventDefault touchstart via the synthetic handler (React passive listener)', () => {
			const { root } = setupBase()

			const event = createEvent.touchStart(root, { cancelable: true, bubbles: true })
			fireEvent(root, event)

			expect(event.defaultPrevented).toBe(false)
		})
	})

	describe('refs', () => {
		it('assigns the root element to dragRef when provided', () => {
			const dragRef = vi.fn()
			const { root } = setupBase({ dragRef })
			expect(dragRef).toHaveBeenCalledWith(root)
		})

		it('falls back to dropRef when no dragRef is provided', () => {
			const dropRef = vi.fn()
			const { root } = setupBase({ dropRef })
			expect(dropRef).toHaveBeenCalledWith(root)
		})
	})
})
