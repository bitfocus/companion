import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ResolvedSurfaceControl, ResolvedSurfaceView } from '@companion-app/shared/SurfaceLayout.js'
import { at, makeGridView, renderInGridView } from '../../__tests__/gridViewTestHelpers.js'

vi.mock('@dnd-kit/react', () => ({
	useDragOperation: () => ({ source: null }),
	useDraggable: () => ({ ref: () => undefined, isDragSource: false }),
	useDroppable: () => ({ ref: () => undefined, isDropTarget: false }),
}))

vi.mock('~/Resources/TRPC', () => ({
	trpcClient: { preview: { graphics: { location: { subscribe: () => ({ unsubscribe: () => undefined }) } } } },
}))

const { SurfaceCanvas } = await import('../SurfaceCanvas.js')

function control(id: string, row: number, column: number): ResolvedSurfaceControl {
	return {
		id,
		cell: { row, column },
		bounds: { x: column * 100, y: row * 100, width: 96, height: 96 },
		shape: { type: 'rect', cornerRadiusRatio: 0.12 },
		feedback: 'bitmap',
		leds: null,
		aspectRatio: null,
		renderSize: { width: 72, height: 72 },
	}
}

const VIEW: ResolvedSurfaceView = {
	controls: [control('a', 0, 0), control('b', 0, 1)],
	extent: { width: 200, height: 100 },
	gridBounds: { minRow: 0, maxRow: 0, minColumn: 0, maxColumn: 1 },
	body: null,
}

describe('SurfaceCanvas', () => {
	it('presses a control for real in press mode', () => {
		const view = makeGridView()
		act(() => view.store.setTool('press', view.actions))

		const { getByTitle } = renderInGridView(
			<SurfaceCanvas
				view={VIEW}
				gridSize={{ minRow: 0, maxRow: 7, minColumn: 0, maxColumn: 7 }}
				pageNumber={1}
				drawScale={1}
				contextMenuButton={null}
				isHot
				setViewportMinHeight={() => undefined}
			/>,
			view
		)

		const cell = getByTitle('1/0/1').parentElement!
		fireEvent.pointerDown(cell, { pointerId: 1, button: 0 })
		expect(view.actions.press).toHaveBeenCalledWith(at(0, 1), true)

		fireEvent.pointerUp(cell, { pointerId: 1, button: 0 })
		expect(view.actions.press).toHaveBeenLastCalledWith(at(0, 1), false)
	})
})
