import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { GridButtonPreview } from '../GridButtonPreview'
import { ROTARY_HOLD_MS } from '../SurfaceView/rotaryDrag.js'

const location: ControlLocation = { pageNumber: 1, row: 2, column: 3 }

type Props = Parameters<typeof GridButtonPreview>[0]

function setup(props: Partial<Props> = {}) {
	const onPress = vi.fn()
	const onRotate = vi.fn()
	const onTap = vi.fn()
	const onContextMenu = vi.fn()

	const baseProps: Props = {
		location,
		kind: 'button',
		image: null,
		color: null,
		overlay: null,
		style: { left: 0, top: 0 },
		title: '1/2/3',
		placeholder: '2/3',
		pressMode: false,
		onPress,
		onRotate: null,
		onTap,
		onContextMenu,
		selected: false,
		copySource: false,
		pendingChange: null,
		contextMenuOpen: false,
		canDrop: false,
		dropHover: false,
		dropDestination: false,
		dropInvalid: false,
		ghostImage: null,
		dropRef: () => {},
		dragRef: () => {},
		isDragSource: false,
		...props,
	}

	const utils = render(<GridButtonPreview {...baseProps} />)
	const root = utils.container.firstElementChild as HTMLElement
	const rerender = (next: Partial<Props>) => utils.rerender(<GridButtonPreview {...baseProps} {...next} />)
	return { ...utils, onPress, onRotate, onTap, onContextMenu, root, rerender }
}

describe('GridButtonPreview', () => {
	describe('a control which shows only a colour', () => {
		it('is filled with the colour, with no placeholder over it', () => {
			const { root } = setup({ color: 'rgba(255, 0, 0, 1)' })
			const border = root.querySelector('.button-border') as HTMLElement

			expect(border.style.backgroundColor).toBe('rgb(255, 0, 0)')
			expect(border.style.backgroundImage).toBe('')
			expect(root.querySelector('.button-placeholder')).toBeNull()
		})

		it('shows the placeholder when there is no colour, as an empty button does', () => {
			const { root } = setup({ color: null })

			expect(root.querySelector('.button-placeholder')).toHaveTextContent('2/3')
		})
	})

	describe('select mode', () => {
		it('commits a tap on release, not on press', () => {
			const { root, onTap } = setup()

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			expect(onTap).not.toHaveBeenCalled()

			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50 })
			expect(onTap).toHaveBeenCalledWith(location, { range: false, toggle: false })
		})

		it('does not tap when the pointer moved too far - that gesture was a scroll or a drag', () => {
			const { root, onTap } = setup()

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerMove(root, { pointerId: 1, clientX: 50, clientY: 90 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 90 })

			expect(onTap).not.toHaveBeenCalled()
		})

		it('still taps after a small jitter within the threshold', () => {
			const { root, onTap } = setup()

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerMove(root, { pointerId: 1, clientX: 52, clientY: 51 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 52, clientY: 51 })

			expect(onTap).toHaveBeenCalledTimes(1)
		})

		it('abandons the tap when the browser takes the gesture over to scroll', () => {
			const { root, onTap } = setup()

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerCancel(root, { pointerId: 1 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50 })

			expect(onTap).not.toHaveBeenCalled()
		})

		it('never fires a real press', () => {
			const { root, onPress } = setup()

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50 })

			expect(onPress).not.toHaveBeenCalled()
		})

		it('reports the modifiers held at the moment of release', () => {
			const { root, onTap } = setup()

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50, shiftKey: true, ctrlKey: true })

			expect(onTap).toHaveBeenCalledWith(location, { range: true, toggle: true })
		})

		it('ignores the secondary pointer button, leaving it to the context menu', () => {
			const { root, onTap } = setup()

			fireEvent.pointerDown(root, { button: 2, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50 })

			expect(onTap).not.toHaveBeenCalled()
		})

		it('lets the browser pan, so a touch drag scrolls the grid', () => {
			const { root } = setup()
			expect(root).toHaveClass('grid-pannable')
		})
	})

	describe('press mode', () => {
		it('fires the press immediately on pointerdown, and releases on pointerup', () => {
			const { root, onPress, onTap } = setup({ pressMode: true })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			expect(onPress).toHaveBeenCalledWith(location, true)

			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50 })
			expect(onPress).toHaveBeenNthCalledWith(2, location, false)
			expect(onTap).not.toHaveBeenCalled()
		})

		it('releases a held button when the gesture is cancelled, so it cannot stick down', () => {
			const { root, onPress } = setup({ pressMode: true })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerCancel(root, { pointerId: 1 })

			expect(onPress).toHaveBeenNthCalledWith(2, location, false)
		})

		it('does not release twice when a cancel is followed by an up', () => {
			const { root, onPress } = setup({ pressMode: true })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerCancel(root, { pointerId: 1 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50 })

			expect(onPress.mock.calls.filter(([, isDown]) => isDown === false)).toHaveLength(1)
		})

		it('presses even when the pointer moves, so a slide off the button still counts', () => {
			const { root, onPress } = setup({ pressMode: true })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerMove(root, { pointerId: 1, clientX: 50, clientY: 200 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 200 })

			expect(onPress.mock.calls).toEqual([
				[location, true],
				[location, false],
			])
		})

		it('stops the browser panning, so a scroll cannot steal the press', () => {
			const { root } = setup({ pressMode: true })
			expect(root).not.toHaveClass('grid-pannable')
		})

		it('releases a held button when press mode is turned off mid-press', () => {
			// No pointerup arrives when the mode changes under a finger, so the release has to be
			// guaranteed some other way or the control stays held
			const { root, onPress, rerender } = setup({ pressMode: true })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			expect(onPress).toHaveBeenCalledWith(location, true)

			rerender({ pressMode: false })

			expect(onPress).toHaveBeenNthCalledWith(2, location, false)
		})

		it('releases a held button when the cell unmounts, so a virtualised cell cannot leave it stuck down', () => {
			// The grid virtualises cells, so one can be unmounted while a finger is still pressing it
			const { root, onPress, unmount } = setup({ pressMode: true })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			expect(onPress).toHaveBeenCalledWith(location, true)

			unmount()

			expect(onPress).toHaveBeenNthCalledWith(2, location, false)
		})
	})

	describe('press mode on a control which turns', () => {
		// jsdom lays nothing out, so the control's box is all zeros and its centre is the origin. Pointing right
		// from it and then down is a quarter turn clockwise.
		const right = { clientX: 50, clientY: 0 }
		const down = { clientX: 0, clientY: 50 }

		it('turns it rightward for a drag clockwise round it, as one turn of however far it went', () => {
			const onRotate = vi.fn()
			const { root, onPress } = setup({ pressMode: true, onRotate })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, ...right })
			fireEvent.pointerMove(root, { pointerId: 1, ...down })
			fireEvent.pointerUp(root, { pointerId: 1, ...down })

			// A quarter turn in one move is 6 steps of 15 degrees, sent together as an encoder spun fast would
			expect(onRotate.mock.calls).toEqual([[location, 6]])
			// Turned, not pushed
			expect(onPress).not.toHaveBeenCalled()
		})

		it('turns it leftward for a drag anticlockwise', () => {
			const onRotate = vi.fn()
			const { root } = setup({ pressMode: true, onRotate })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, ...down })
			fireEvent.pointerMove(root, { pointerId: 1, ...right })

			expect(onRotate.mock.calls).toEqual([[location, -6]])
		})

		it('sends a slow turn a step at a time, as each move only goes one step', () => {
			const onRotate = vi.fn()
			const { root } = setup({ pressMode: true, onRotate })

			// A quarter turn, a little over a step per move
			fireEvent.pointerDown(root, { button: 0, pointerId: 1, ...right })
			for (const degrees of [16, 32, 48]) {
				const radians = (degrees * Math.PI) / 180
				fireEvent.pointerMove(root, { pointerId: 1, clientX: Math.cos(radians) * 50, clientY: Math.sin(radians) * 50 })
			}

			expect(onRotate.mock.calls).toEqual([
				[location, 1],
				[location, 1],
				[location, 1],
			])
		})

		it('pushes it for a quick tap', () => {
			const onRotate = vi.fn()
			const { root, onPress } = setup({ pressMode: true, onRotate })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, ...right })
			// Waits to see whether it is being turned
			expect(onPress).not.toHaveBeenCalled()

			fireEvent.pointerUp(root, { pointerId: 1, ...right })

			expect(onPress.mock.calls).toEqual([
				[location, true],
				[location, false],
			])
			expect(onRotate).not.toHaveBeenCalled()
		})

		it('holds it pushed once held still, until it is let go', () => {
			vi.useFakeTimers()
			try {
				const onRotate = vi.fn()
				const { root, onPress } = setup({ pressMode: true, onRotate })

				fireEvent.pointerDown(root, { button: 0, pointerId: 1, ...right })
				vi.advanceTimersByTime(ROTARY_HOLD_MS)
				expect(onPress.mock.calls).toEqual([[location, true]])

				// Moving while held is a push sliding, not a turn
				fireEvent.pointerMove(root, { pointerId: 1, ...down })
				expect(onRotate).not.toHaveBeenCalled()

				fireEvent.pointerUp(root, { pointerId: 1, ...down })
				expect(onPress.mock.calls).toEqual([
					[location, true],
					[location, false],
				])
			} finally {
				vi.useRealTimers()
			}
		})

		it('never pushes it once it is being turned, however long it is held', () => {
			vi.useFakeTimers()
			try {
				const onRotate = vi.fn()
				const { root, onPress } = setup({ pressMode: true, onRotate })

				fireEvent.pointerDown(root, { button: 0, pointerId: 1, ...right })
				fireEvent.pointerMove(root, { pointerId: 1, ...down })
				vi.advanceTimersByTime(ROTARY_HOLD_MS * 4)
				fireEvent.pointerUp(root, { pointerId: 1, ...down })

				expect(onPress).not.toHaveBeenCalled()
			} finally {
				vi.useRealTimers()
			}
		})

		it('does not push it later when the gesture is cancelled before the hold', () => {
			vi.useFakeTimers()
			try {
				const { root, onPress } = setup({ pressMode: true, onRotate: vi.fn() })

				fireEvent.pointerDown(root, { button: 0, pointerId: 1, ...right })
				fireEvent.pointerCancel(root, { pointerId: 1 })
				vi.advanceTimersByTime(ROTARY_HOLD_MS * 2)

				expect(onPress).not.toHaveBeenCalled()
			} finally {
				vi.useRealTimers()
			}
		})

		it('is only selected, not turned, outside press mode', () => {
			const onRotate = vi.fn()
			const { root, onTap } = setup({ pressMode: false, onRotate })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, ...right })
			fireEvent.pointerUp(root, { pointerId: 1, ...right })
			fireEvent.pointerDown(root, { button: 0, pointerId: 2, ...right })
			fireEvent.pointerMove(root, { pointerId: 2, ...down })

			expect(onTap).toHaveBeenCalledTimes(1)
			expect(onRotate).not.toHaveBeenCalled()
		})
	})

	describe('context menu', () => {
		it('opens at the pointer position', () => {
			const { root, onContextMenu } = setup()

			fireEvent.contextMenu(root, { clientX: 120, clientY: 340 })

			expect(onContextMenu).toHaveBeenCalledWith(location, 120, 340)
		})

		it('releases an in-flight press first, so a long-press cannot leave the button held', () => {
			const { root, onPress, onContextMenu } = setup({ pressMode: true })

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.contextMenu(root, { clientX: 50, clientY: 50 })

			expect(onPress).toHaveBeenNthCalledWith(2, location, false)
			expect(onContextMenu).toHaveBeenCalled()
		})

		it('cancels a pending tap, so the menu does not also select', () => {
			const { root, onTap } = setup()

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.contextMenu(root, { clientX: 50, clientY: 50 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50 })

			expect(onTap).not.toHaveBeenCalled()
		})

		it('lets the browser menu through when a modifier is held', () => {
			const { root, onContextMenu } = setup()

			for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
				fireEvent.contextMenu(root, { [modifier]: true, clientX: 50, clientY: 50 })
			}

			expect(onContextMenu).not.toHaveBeenCalled()
		})
	})

	describe('a pointer that is not the one being tracked', () => {
		it('ignores movement before anything was pressed', () => {
			const { root, onTap } = setup()

			fireEvent.pointerMove(root, { pointerId: 1, clientX: 500, clientY: 500 })
			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50 })

			// The stray move did not count against the tap that came after it
			expect(onTap).toHaveBeenCalledWith(location, { range: false, toggle: false })
		})

		it('ignores a second pointer moving while the first is held', () => {
			const { root, onTap } = setup()

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			// A second finger dragging elsewhere is not this gesture moving
			fireEvent.pointerMove(root, { pointerId: 2, clientX: 500, clientY: 500 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50 })

			expect(onTap).toHaveBeenCalled()
		})

		it('stops measuring once the gesture has already travelled too far', () => {
			const { root, onTap } = setup()

			fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerMove(root, { pointerId: 1, clientX: 500, clientY: 500 })
			// Coming back does not turn a drag back into a tap
			fireEvent.pointerMove(root, { pointerId: 1, clientX: 50, clientY: 50 })
			fireEvent.pointerUp(root, { pointerId: 1, clientX: 50, clientY: 50 })

			expect(onTap).not.toHaveBeenCalled()
		})
	})

	describe('what it draws', () => {
		it('marks what kind of control it is, so it can be drawn as one', () => {
			const { root, rerender } = setup({ kind: 'jog' })
			expect(root).toHaveClass('control-kind-jog')

			rerender({ kind: 'button' })
			expect(root).toHaveClass('control-kind-button')
			expect(root).not.toHaveClass('control-kind-jog')
		})

		it('draws the placeholder while there is no image', () => {
			const { root } = setup({ image: null })

			expect(root.querySelector('.button-placeholder')).toHaveTextContent('2/3')
			expect((root.querySelector('.button-border') as HTMLElement).style.backgroundImage).toBe('')
		})

		it('draws the button image in place of the placeholder', () => {
			const { root } = setup({ image: 'data:image/png;base64,BBB' })

			expect(root.querySelector('.button-placeholder')).toBeNull()
			expect((root.querySelector('.button-border') as HTMLElement).style.backgroundImage).toContain(
				'data:image/png;base64,BBB'
			)
		})

		it('marks a cell a drag is hovering over', () => {
			const { root } = setup({ dropHover: true })

			expect(root.className).toContain('drophover')
		})

		it('does not mark a landing spot that would be refused as one that would work', () => {
			const { root } = setup({ dropDestination: true, dropInvalid: true })

			expect(root.className).toContain('dropinvalid')
			expect(root.className).not.toContain('drophover')
		})

		it('draws the button that would land here', () => {
			const { root } = setup({ dropDestination: true, ghostImage: 'data:image/png;base64,AAA' })

			const ghost = root.querySelector('.button-drop-ghost') as HTMLElement
			expect(ghost).toBeInTheDocument()
			expect(ghost.style.backgroundImage).toContain('data:image/png;base64,AAA')
		})

		it('draws an empty button where a swap would leave nothing', () => {
			const { root } = setup({ dropDestination: true, ghostImage: null })

			const ghost = root.querySelector('.button-drop-ghost') as HTMLElement
			expect(ghost).toBeInTheDocument()
			expect(ghost.style.backgroundImage).toBe('')
		})
	})
})
