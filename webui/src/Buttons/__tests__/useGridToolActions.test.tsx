import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { ButtonGridStore } from '../ButtonGridStore.js'
import { useGridToolActions } from '../useGridToolActions.js'
import { at } from './gridViewTestHelpers.js'

/** Every mutation these actions fire, by the trpc path it was built from */
const sent: { path: string; input: any }[] = []

/** Whether the server accepts what it is sent - only a test about failure says otherwise */
let mutationsFail = false

// The real `trpc` proxy is kept, so each mutation is still named by its real path - only the sending
// is stood in for
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

const GRID_SIZE: UserConfigGridSize = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }

/** What the confirmation modal was asked to put to the user, and how to answer it */
interface AskedQuestion {
	title: string
	message: string | string[] | null
	buttonLabel: string
	confirm: () => void
}

function setup(
	options: {
		gridSize?: UserConfigGridSize | undefined
		occupied?: (location: ControlLocation) => boolean
	} = {}
) {
	const store = new ButtonGridStore()
	const asked: AskedQuestion[] = []
	const confirmRef = createRef<GenericConfirmModalRef>()
	confirmRef.current = {
		show: (title, message, buttonLabel, confirm) => asked.push({ title, message, buttonLabel, confirm }),
	}

	const openEditor = vi.fn()
	const onGridChanged = vi.fn()
	// Everywhere holds a button unless the test says otherwise
	const isOccupied = vi.fn(options.occupied ?? (() => true))

	const queryClient = new QueryClient()
	const { result } = renderHook(
		() =>
			useGridToolActions({
				store,
				gridSize: 'gridSize' in options ? options.gridSize : GRID_SIZE,
				isOccupied,
				openEditor,
				confirmRef,
				onGridChanged,
			}),
		{
			wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
		}
	)

	const actions = () => result.current
	const answerLast = () => act(() => asked[asked.length - 1].confirm())

	return { store, actions, asked, answerLast, openEditor, onGridChanged, isOccupied }
}

const pair = (from: ControlLocation, to: ControlLocation) => ({ fromLocation: from, toLocation: to })

beforeEach(() => {
	sent.length = 0
	mutationsFail = false
})

describe('what fits on the grid', () => {
	it('accepts what is within it', () => {
		const { actions } = setup()

		expect(actions().fitsOnGrid([at(0, 0), at(3, 7)])).toBe(true)
	})

	it.each([
		['past the bottom', at(4, 0)],
		['above the top', at(-1, 0)],
		['past the right', at(0, 8)],
		['left of the left', at(0, -1)],
	])('refuses a button %s, where nothing could reach it', (_name, location) => {
		const { actions } = setup()

		expect(actions().fitsOnGrid([location])).toBe(false)
	})

	it('refuses everything before the grid size is known', () => {
		const { actions } = setup({ gridSize: undefined })

		expect(actions().fitsOnGrid([at(1, 1)])).toBe(false)
	})
})

describe('transferring buttons', () => {
	it('sends the whole lot as one request, so overlapping regions resolve against what was there', () => {
		const { actions } = setup({ occupied: (l) => l.row === 1 })
		const pairs = [pair(at(1, 1), at(2, 1)), pair(at(1, 2), at(2, 2))]

		act(() => actions().transfer('move', pairs, () => undefined))

		expect(sent).toEqual([{ path: 'controls.gridBatchTransfer', input: { operation: 'move', pairs } }])
	})

	it('selects where the buttons landed, rather than where they used to be', () => {
		const { store, actions } = setup({ occupied: (l) => l.row === 1 })

		act(() => actions().transfer('move', [pair(at(1, 1), at(2, 1))], () => undefined))

		expect(store.selectedLocations).toEqual([at(2, 1)])
	})

	it('reports back once it has happened, so a cut is only spent on a real paste', () => {
		const { actions, onGridChanged } = setup({ occupied: (l) => l.row === 1 })
		const onApplied = vi.fn()

		act(() => actions().transfer('move', [pair(at(1, 1), at(2, 1))], onApplied))

		expect(onApplied).toHaveBeenCalled()
		expect(onGridChanged).toHaveBeenCalled()
	})

	it('asks before replacing anything, naming how much would go', () => {
		const { actions, asked } = setup()
		const onApplied = vi.fn()

		act(() => actions().transfer('copy', [pair(at(1, 1), at(2, 1)), pair(at(1, 2), at(2, 2))], onApplied))

		expect(asked[0].title).toBe('Overwrite 2 buttons')
		expect(sent).toEqual([])
		expect(onApplied).not.toHaveBeenCalled()
	})

	it('keeps the buttons in hand when that question is left unanswered', () => {
		const { store, actions } = setup()
		const onApplied = vi.fn()

		act(() => actions().transfer('copy', [pair(at(1, 1), at(2, 1))], onApplied))

		expect(store.selectionCount).toBe(0)
		expect(onApplied).not.toHaveBeenCalled()
	})

	it('goes ahead once that is confirmed', () => {
		const { actions, answerLast } = setup()
		const onApplied = vi.fn()
		act(() => actions().transfer('copy', [pair(at(1, 1), at(2, 1))], onApplied))

		answerLast()

		expect(sent).toHaveLength(1)
		expect(onApplied).toHaveBeenCalled()
	})

	it('names a single button in the singular, since counting to one is not helpful', () => {
		const { actions, asked } = setup()

		act(() => actions().transfer('copy', [pair(at(1, 1), at(2, 1))], () => undefined))

		expect(asked[0].title).toBe('Overwrite 1 button')
	})

	it('does nothing at all when there is nothing to carry', () => {
		const { actions } = setup({ occupied: () => false })

		act(() => actions().transfer('copy', [pair(at(1, 1), at(2, 1))], () => undefined))

		expect(sent).toEqual([])
	})

	it('refuses a region that would hang off the grid, rather than placing the part that fits', () => {
		const { actions, asked } = setup({ occupied: (l) => l.row === 1 })

		act(() => actions().transfer('move', [pair(at(1, 1), at(2, 1)), pair(at(1, 2), at(9, 9))], () => undefined))

		expect(sent).toEqual([])
		expect(asked).toEqual([])
	})

	it('reports a rejected transfer rather than letting it escape', async () => {
		mutationsFail = true
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
		const { actions } = setup({ occupied: (l) => l.row === 1 })

		act(() => actions().transfer('swap', [pair(at(1, 1), at(2, 1))], () => undefined))

		await vi.waitFor(() => expect(errors).toHaveBeenCalledWith(expect.stringContaining('swap failed')))
		errors.mockRestore()
	})
})

describe('pasting the clipboard', () => {
	it('anchors the region at the cell named, since there is no ghost pointing at one', () => {
		const { store, actions } = setup({ occupied: (l) => l.row === 1 })
		act(() => store.setClipboard([at(1, 1), at(1, 2)], 'copy'))

		act(() => actions().pasteAt(at(2, 4)))

		expect(sent[0].input).toEqual({
			operation: 'copy',
			pairs: [pair(at(1, 1), at(2, 4)), pair(at(1, 2), at(2, 5))],
		})
	})

	it('moves what was cut rather than copying it, and spends the clipboard', () => {
		const { store, actions } = setup({ occupied: (l) => l.row === 1 })
		act(() => store.setClipboard([at(1, 1)], 'cut'))

		act(() => actions().pasteAt(at(2, 4)))

		expect(sent[0].input.operation).toBe('move')
		expect(store.clipboard).toBeNull()
	})

	it('keeps a copy on the clipboard, so it can be pasted again', () => {
		const { store, actions } = setup({ occupied: (l) => l.row === 1 })
		act(() => store.setClipboard([at(1, 1)], 'copy'))

		act(() => actions().pasteAt(at(2, 4)))

		expect(store.clipboard).not.toBeNull()
	})

	it('explains a paste that would land off the grid, which would otherwise just do nothing', () => {
		const { store, actions, asked } = setup({ occupied: (l) => l.row === 1 })
		act(() => store.setClipboard([at(1, 1), at(1, 2)], 'copy'))

		act(() => actions().pasteAt(at(3, 7)))

		expect(asked[0].title).toBe('Cannot paste here')
		expect(asked[0].message?.[0]).toContain('1 of the 2 buttons')
		expect(sent).toEqual([])
	})

	it('leaves that explanation as something to dismiss, not something to confirm', () => {
		const { store, actions, asked } = setup({ occupied: (l) => l.row === 1 })
		act(() => store.setClipboard([at(1, 1), at(1, 2)], 'copy'))
		act(() => actions().pasteAt(at(3, 7)))

		expect(asked[0].buttonLabel).toBe('OK')
		expect(() => asked[0].confirm()).not.toThrow()
		expect(sent).toEqual([])
	})

	it('does nothing with an empty clipboard', () => {
		const { actions } = setup()

		act(() => actions().pasteAt(at(2, 2)))

		expect(sent).toEqual([])
	})

	it('does nothing before the grid size is known', () => {
		const { store, actions } = setup({ gridSize: undefined })
		act(() => store.setClipboard([at(1, 1)], 'copy'))

		act(() => actions().pasteAt(at(2, 2)))

		expect(sent).toEqual([])
	})
})

describe('the rest of what a tool can do', () => {
	it('presses a button down and reports a press that fails', async () => {
		const { actions } = setup()

		act(() => actions().press(at(1, 1), true))

		expect(sent).toEqual([
			{ path: 'controls.hotPressControl', input: { location: at(1, 1), direction: true, surfaceId: 'grid' } },
		])
	})

	it('reports a failed press rather than letting the rejection escape', async () => {
		mutationsFail = true
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
		const { actions } = setup()

		act(() => actions().press(at(1, 1), false))

		await vi.waitFor(() => expect(errors).toHaveBeenCalledWith(expect.stringContaining('Hot press failed')))
		errors.mockRestore()
	})

	it('asks before clearing a button, naming which one', () => {
		const { actions, asked } = setup()

		act(() => actions().clearButtons([at(1, 1)]))

		expect(asked[0].title).toBe('Clear button 1/1/1')
		expect(sent).toEqual([])
	})

	it('names the count when clearing several', () => {
		const { actions, asked } = setup()

		act(() => actions().clearButtons([at(1, 1), at(1, 2)]))

		expect(asked[0].title).toBe('Clear 2 buttons')
	})

	it('clears them once that is confirmed', () => {
		const { actions, answerLast } = setup()
		act(() => actions().clearButtons([at(1, 1), at(1, 2)]))

		answerLast()

		expect(sent).toEqual([
			{ path: 'controls.resetControls', input: { locations: [at(1, 1), at(1, 2)], newType: null } },
		])
	})

	it('reports a failed clear rather than letting the rejection escape', async () => {
		mutationsFail = true
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
		const { actions, answerLast } = setup()
		act(() => actions().clearButtons([at(1, 1)]))

		answerLast()

		await vi.waitFor(() => expect(errors).toHaveBeenCalledWith(expect.stringContaining('Reset failed')))
		errors.mockRestore()
	})

	it('asks nothing when there is nothing to clear', () => {
		const { actions, asked } = setup()

		act(() => actions().clearButtons([]))

		expect(asked).toEqual([])
	})

	it('opens the editor through whatever the page gave it', () => {
		const { actions, openEditor } = setup()

		actions().openEditor(at(1, 1))

		expect(openEditor).toHaveBeenCalledWith(at(1, 1))
	})
})
