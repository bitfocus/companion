import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'

/** The handlers the hook subscribed with, so a drag can be played through them */
let monitor: {
	onDragOver: (event: { operation: DragOperation }) => void
	onDragEnd: (event: { operation: DragOperation; canceled: boolean }) => void
} | null = null

interface DragOperation {
	source: { type: string; data: unknown } | null
	target: { id: unknown } | null
}

vi.mock('@dnd-kit/react', () => ({
	useDragDropMonitor: (handlers: any) => {
		monitor = handlers
	},
}))

/** Every mutation the monitor fires, by the trpc path it was built from */
const sent: { path: string; input: any }[] = []
let mutationsFail = false

vi.mock('~/Resources/TRPC.js', async (importOriginal) => {
	const original = await importOriginal<Record<string, unknown>>()
	return {
		...original,
		useMutationExt: (options: { mutationKey?: unknown[][] }) => ({
			...options,
			mutateAsync: async (input: unknown) => {
				sent.push({ path: (options.mutationKey?.[0] ?? []).join('.'), input })
				if (mutationsFail) throw new Error('nope')
			},
		}),
	}
})

const { useGridDropMonitor } = await import('../useGridDropMonitor.js')
const { ButtonGridStore } = await import('../ButtonGridStore.js')
const { GRID_BUTTON_DRAG_TYPE } = await import('../GridButtonDragItem.js')
const { makeGridActions, at } = await import('./gridViewTestHelpers.js')

const GRID_SIZE: UserConfigGridSize = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }

/** The id the grid's droppable cells carry */
const cellId = (location: ControlLocation) => `gridbtn:${location.pageNumber}:${location.column}:${location.row}`

function gridDrag(origin: ControlLocation) {
	return { type: GRID_BUTTON_DRAG_TYPE, data: { location: origin } }
}

function setup(
	options: { gridSize?: UserConfigGridSize | undefined; occupied?: (l: ControlLocation) => boolean } = {}
) {
	const store = new ButtonGridStore()
	const actions = makeGridActions()
	const isOccupied = vi.fn(options.occupied ?? (() => true))

	const queryClient = new QueryClient()
	renderHook(
		() =>
			useGridDropMonitor({
				store,
				gridSize: 'gridSize' in options ? options.gridSize : GRID_SIZE,
				isOccupied,
				actions,
			}),
		{ wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> }
	)

	const over = (operation: DragOperation) => act(() => monitor?.onDragOver({ operation }))
	const drop = (operation: DragOperation, canceled = false) => act(() => monitor?.onDragEnd({ operation, canceled }))

	return { store, actions, over, drop }
}

beforeEach(() => {
	monitor = null
	sent.length = 0
	mutationsFail = false
})

describe('while a button is being dragged over the grid', () => {
	it('shows where it would land', () => {
		const { store, over } = setup()

		over({ source: gridDrag(at(1, 1)), target: { id: cellId(at(2, 3)) } })

		expect(store.dropGhostSource(formatLocation(at(2, 3)))).toEqual(at(1, 1))
	})

	it('shows both ends of a swap, so the button coming back is visible too', () => {
		const { store, over } = setup()

		over({ source: gridDrag(at(1, 1)), target: { id: cellId(at(2, 3)) } })

		// The occupied destination trades with the source
		expect(store.dropGhostSource(formatLocation(at(1, 1)))).toEqual(at(2, 3))
	})

	it('marks a landing spot that would be refused, rather than letting it look fine', () => {
		const { store, over } = setup()
		act(() => store.setSelection([at(1, 1), at(1, 2)]))

		over({ source: gridDrag(at(1, 1)), target: { id: cellId(at(1, 7)) } })

		expect(store.dragPreviewValid).toBe(false)
	})

	it('clears the preview once the pointer is over nothing', () => {
		const { store, over } = setup()
		over({ source: gridDrag(at(1, 1)), target: { id: cellId(at(2, 3)) } })

		over({ source: gridDrag(at(1, 1)), target: null })

		expect(store.dropGhostSource(formatLocation(at(2, 3)))).toBeNull()
	})

	it('says nothing about a preset, which is marked on every cell instead', () => {
		const { store, over } = setup()

		over({ source: { type: 'preset', data: {} }, target: { id: cellId(at(2, 3)) } })

		expect(store.dropGhostSource(formatLocation(at(2, 3)))).toBeNull()
	})

	it('says nothing while nothing is being dragged', () => {
		const { store, over } = setup()

		over({ source: null, target: { id: cellId(at(2, 3)) } })

		expect(store.dropGhostSource(formatLocation(at(2, 3)))).toBeNull()
	})

	it('says nothing over a target that is not a grid cell', () => {
		const { store, over } = setup()

		over({ source: gridDrag(at(1, 1)), target: { id: 'somewhere-else' } })

		expect(store.dropGhostSource(formatLocation(at(2, 3)))).toBeNull()
	})

	it('says nothing before the grid size is known', () => {
		const { store, over } = setup({ gridSize: undefined })

		over({ source: gridDrag(at(1, 1)), target: { id: cellId(at(2, 3)) } })

		expect(store.dropGhostSource(formatLocation(at(2, 3)))).toBeNull()
	})

	it('says nothing for a drag that has not reported what it picked up', () => {
		const { store, over } = setup()

		over({ source: { type: GRID_BUTTON_DRAG_TYPE, data: {} }, target: { id: cellId(at(2, 3)) } })

		expect(store.dropGhostSource(formatLocation(at(2, 3)))).toBeNull()
	})
})

describe('when a button is dropped on the grid', () => {
	it('moves it through the same path as every other way of moving buttons', () => {
		const { actions, drop } = setup()

		drop({ source: gridDrag(at(1, 1)), target: { id: cellId(at(2, 3)) } })

		// One pair each way round is the backend's business; the drop only says what goes where
		expect(actions.transfer).toHaveBeenCalledWith(
			'swap',
			[{ fromLocation: at(1, 1), toLocation: at(2, 3) }],
			expect.any(Function)
		)
	})

	it('takes the whole selection when the dragged button belongs to it', () => {
		const { store, actions, drop } = setup({ occupied: (l) => l.row === 1 })
		act(() => store.setSelection([at(1, 1), at(1, 2)]))

		drop({ source: gridDrag(at(1, 1)), target: { id: cellId(at(2, 3)) } })

		expect(vi.mocked(actions.transfer).mock.calls[0][1]).toEqual([
			{ fromLocation: at(1, 1), toLocation: at(2, 3) },
			{ fromLocation: at(1, 2), toLocation: at(2, 4) },
		])
	})

	it('clears the preview, whatever the drop turns out to do', () => {
		const { store, drop } = setup()
		act(() => store.setDragPreview({ placements: new Map([['1/2/3', at(1, 1)]]), valid: true }))

		drop({ source: gridDrag(at(1, 1)), target: { id: cellId(at(2, 3)) } })

		expect(store.dropGhostSource('1/2/3')).toBeNull()
	})

	it('refuses a region that would hang off the grid, rather than dropping the part that fits', () => {
		const { store, actions, drop } = setup({ occupied: (l) => l.row === 1 })
		act(() => store.setSelection([at(1, 1), at(1, 2)]))

		drop({ source: gridDrag(at(1, 1)), target: { id: cellId(at(1, 7)) } })

		expect(actions.transfer).not.toHaveBeenCalled()
	})

	it('does nothing when the drag was abandoned', () => {
		const { actions, drop } = setup()

		drop({ source: gridDrag(at(1, 1)), target: { id: cellId(at(2, 3)) } }, true)

		expect(actions.transfer).not.toHaveBeenCalled()
	})

	it.each([
		['nothing was being dragged', { source: null, target: { id: 'gridbtn:1:3:2' } }],
		['it was released over nothing', { source: gridDrag(at(1, 1)), target: null }],
		['the target is not a grid cell', { source: gridDrag(at(1, 1)), target: { id: 'elsewhere' } }],
	])('does nothing when %s', (_name, operation) => {
		const { actions, drop } = setup()

		drop(operation)

		expect(actions.transfer).not.toHaveBeenCalled()
	})

	it('leaves a drag of something else entirely alone', () => {
		const { actions, drop } = setup()

		drop({ source: { type: 'entity', data: {} }, target: { id: cellId(at(2, 3)) } })

		expect(actions.transfer).not.toHaveBeenCalled()
		expect(sent).toEqual([])
	})
})

describe('when a preset is dropped on the grid', () => {
	const preset = {
		type: 'preset',
		data: { connectionId: 'conn1', presetId: 'preset1', variableValues: { a: 1 }, mode: 'button' },
	}

	it('imports it at the cell it landed on', () => {
		const { drop } = setup()

		drop({ source: preset, target: { id: cellId(at(2, 3)) } })

		expect(sent).toEqual([
			{
				path: 'controls.importPreset',
				input: {
					connectionId: 'conn1',
					presetId: 'preset1',
					location: at(2, 3),
					variableValues: { a: 1 },
					mode: 'button',
				},
			},
		])
	})

	it('does nothing when it lands on something that is not a cell', () => {
		const { drop } = setup()

		drop({ source: preset, target: { id: 'elsewhere' } })

		expect(sent).toEqual([])
	})

	it('reports a failed import rather than letting the rejection escape', async () => {
		mutationsFail = true
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
		const { drop } = setup()

		drop({ source: preset, target: { id: cellId(at(2, 3)) } })

		await vi.waitFor(() => expect(errors).toHaveBeenCalledWith('Preset import failed'))
		errors.mockRestore()
	})
})
