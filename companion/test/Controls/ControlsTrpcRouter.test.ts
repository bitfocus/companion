import { EventEmitter } from 'node:events'
import { initTRPC } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { ControlCommonEvents } from '../../lib/Controls/ControlDependencies.js'
import type { ControlsController } from '../../lib/Controls/Controller.js'
import { createControlsTrpcRouter } from '../../lib/Controls/ControlsTrpcRouter.js'
import type { Logger } from '../../lib/Log/Controller.js'
import type { IPageStore } from '../../lib/Page/Store.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'

const GRID_SIZE: UserConfigGridSize = { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }

const t = initTRPC.context<TrpcContext>().create()

const loc = (pageNumber: number, row: number, column: number): ControlLocation => ({ pageNumber, row, column })

/** One control sitting on the grid at the start of a test */
interface Cell {
	location: ControlLocation
	controlId: string
}

function setup(options: { cells?: Cell[]; validPages?: number[]; gridSize?: UserConfigGridSize } = {}) {
	const cells = options.cells ?? []
	const validPages = new Set(options.validPages ?? [1, 2])
	const gridSize = options.gridSize ?? GRID_SIZE

	// Backing maps for the page store, keyed by the formatted location
	const byLocation = new Map<string, string>()
	const locationOf = new Map<string, ControlLocation>()
	for (const { location, controlId } of cells) {
		byLocation.set(formatLocation(location), controlId)
		locationOf.set(controlId, location)
	}

	const pageStore = {
		getControlIdAt: (location: ControlLocation) => byLocation.get(formatLocation(location)) ?? null,
		getLocationOfControlId: (controlId: string) => locationOf.get(controlId),
		isPageValid: (pageNumber: number) => validPages.has(pageNumber),
		getPageId: (pageNumber: number) => (validPages.has(pageNumber) ? `page-${pageNumber}` : undefined),
	} as unknown as IPageStore

	// A mock control per occupied cell, tracking the calls the router makes on it
	const controlsMap = new Map<string, any>()
	for (const { controlId } of cells) {
		controlsMap.set(controlId, {
			toJSON: vi.fn((_clone: boolean) => ({ type: 'button', __sourceId: controlId })),
			triggerLocationHasChanged: vi.fn(),
			supportsOptions: true,
			optionsSetField: vi.fn(() => true),
		})
	}

	const controlsController = {
		deleteControl: vi.fn(),
		importControl: vi.fn(),
		createButtonControl: vi.fn(),
		notifyControlMovedPage: vi.fn(),
		pressControl: vi.fn(),
		rotateControl: vi.fn(),
		abortAllDelayedActions: vi.fn(),
	} as unknown as ControlsController

	const logger = {
		warn: vi.fn(),
		silly: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
	} as unknown as Logger

	const userconfig = {
		getKey: vi.fn((key: string) => (key === 'gridSize' ? gridSize : undefined)),
	} as any

	const instanceDefinitions = {} as any

	const controlEvents = new EventEmitter()
	const emitSpy = vi.spyOn(controlEvents, 'emit')

	const router = t.router(
		createControlsTrpcRouter(
			logger,
			controlsMap as any,
			pageStore,
			instanceDefinitions,
			controlEvents,
			controlsController,
			userconfig
		)
	)
	const caller = t.createCallerFactory(router)(createMockTrpcContext())

	/** All args a given event was emitted with, in order */
	const emitsOf = (event: keyof ControlCommonEvents): any[][] =>
		emitSpy.mock.calls.filter((call) => call[0] === event).map((call) => call.slice(1))

	/** The locations (as strings) a given event was emitted for */
	const locationsEmittedFor = (event: keyof ControlCommonEvents): string[] =>
		emitsOf(event).map(([location]) => formatLocation(location))

	return { caller, controlsController, controlsMap, logger, emitsOf, locationsEmittedFor }
}

describe('createControlsTrpcRouter', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('gridBatchTransfer', () => {
		it('rejects the whole batch when a source page is invalid', async () => {
			const { caller, controlsController, logger } = setup({
				cells: [{ location: loc(1, 0, 0), controlId: 'ctrlA' }],
			})

			const result = await caller.gridBatchTransfer({
				operation: 'move',
				pairs: [{ fromLocation: loc(99, 0, 0), toLocation: loc(1, 0, 1) }],
			})

			expect(result).toBe(false)
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('invalid page'))
			expect(controlsController.deleteControl).not.toHaveBeenCalled()
			expect(controlsController.importControl).not.toHaveBeenCalled()
		})

		it('rejects the whole batch when a destination is off the grid', async () => {
			const { caller, controlsController, logger } = setup({
				cells: [{ location: loc(1, 0, 0), controlId: 'ctrlA' }],
			})

			const result = await caller.gridBatchTransfer({
				operation: 'move',
				pairs: [{ fromLocation: loc(1, 0, 0), toLocation: loc(1, 0, 99) }],
			})

			expect(result).toBe(false)
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('off the grid'))
			expect(controlsController.deleteControl).not.toHaveBeenCalled()
		})

		it('rejects a batch whose only pair is a no-op (from === to)', async () => {
			const { caller, controlsController } = setup({
				cells: [{ location: loc(1, 0, 0), controlId: 'ctrlA' }],
			})

			const result = await caller.gridBatchTransfer({
				operation: 'move',
				pairs: [{ fromLocation: loc(1, 0, 0), toLocation: loc(1, 0, 0) }],
			})

			expect(result).toBe(false)
			expect(controlsController.deleteControl).not.toHaveBeenCalled()
			expect(controlsController.importControl).not.toHaveBeenCalled()
		})

		it('moves a control into an empty cell', async () => {
			const { caller, controlsController, controlsMap, emitsOf, locationsEmittedFor } = setup({
				cells: [{ location: loc(1, 0, 0), controlId: 'ctrlA' }],
			})

			const result = await caller.gridBatchTransfer({
				operation: 'move',
				pairs: [{ fromLocation: loc(1, 0, 0), toLocation: loc(1, 0, 1) }],
			})

			expect(result).toBe(true)
			// Nothing is overwritten, so nothing is deleted
			expect(controlsController.deleteControl).not.toHaveBeenCalled()
			// Both the source and destination slots are cleared before the control is placed
			expect(locationsEmittedFor('controlRemovedFrom').sort()).toEqual(['1/0/0', '1/0/1'])
			// The existing control is placed at the destination
			expect(emitsOf('controlPlacedAt')).toEqual([[loc(1, 0, 1), 'ctrlA']])
			expect(controlsMap.get('ctrlA').triggerLocationHasChanged).toHaveBeenCalledTimes(1)
		})

		it('deletes the control that a move overwrites', async () => {
			const { caller, controlsController } = setup({
				cells: [
					{ location: loc(1, 0, 0), controlId: 'ctrlA' },
					{ location: loc(1, 0, 1), controlId: 'ctrlB' },
				],
			})

			const result = await caller.gridBatchTransfer({
				operation: 'move',
				pairs: [{ fromLocation: loc(1, 0, 0), toLocation: loc(1, 0, 1) }],
			})

			expect(result).toBe(true)
			expect(controlsController.deleteControl).toHaveBeenCalledTimes(1)
			expect(controlsController.deleteControl).toHaveBeenCalledWith('ctrlB')
		})

		it('clones the source when copying and leaves the source in place', async () => {
			const { caller, controlsController, controlsMap } = setup({
				cells: [{ location: loc(1, 0, 0), controlId: 'ctrlA' }],
			})

			const result = await caller.gridBatchTransfer({
				operation: 'copy',
				pairs: [{ fromLocation: loc(1, 0, 0), toLocation: loc(1, 0, 1) }],
			})

			expect(result).toBe(true)
			// A clone is serialised from the source and imported at the destination
			expect(controlsMap.get('ctrlA').toJSON).toHaveBeenCalledWith(true)
			expect(controlsController.importControl).toHaveBeenCalledWith(loc(1, 0, 1), {
				type: 'button',
				__sourceId: 'ctrlA',
			})
			// The source keeps its place - a copy never deletes it
			expect(controlsController.deleteControl).not.toHaveBeenCalled()
		})

		it('copies onto an occupied cell by discarding the occupant', async () => {
			const { caller, controlsController } = setup({
				cells: [
					{ location: loc(1, 0, 0), controlId: 'ctrlA' },
					{ location: loc(1, 0, 1), controlId: 'ctrlB' },
				],
			})

			const result = await caller.gridBatchTransfer({
				operation: 'copy',
				pairs: [{ fromLocation: loc(1, 0, 0), toLocation: loc(1, 0, 1) }],
			})

			expect(result).toBe(true)
			expect(controlsController.deleteControl).toHaveBeenCalledWith('ctrlB')
			expect(controlsController.importControl).toHaveBeenCalledWith(loc(1, 0, 1), {
				type: 'button',
				__sourceId: 'ctrlA',
			})
		})

		it('swaps two controls without deleting either', async () => {
			const { caller, controlsController, controlsMap, emitsOf } = setup({
				cells: [
					{ location: loc(1, 0, 0), controlId: 'ctrlA' },
					{ location: loc(1, 0, 1), controlId: 'ctrlB' },
				],
			})

			const result = await caller.gridBatchTransfer({
				operation: 'swap',
				pairs: [{ fromLocation: loc(1, 0, 0), toLocation: loc(1, 0, 1) }],
			})

			expect(result).toBe(true)
			expect(controlsController.deleteControl).not.toHaveBeenCalled()

			const placed = emitsOf('controlPlacedAt').map(([location, controlId]) => [formatLocation(location), controlId])
			expect(placed).toContainEqual(['1/0/1', 'ctrlA'])
			expect(placed).toContainEqual(['1/0/0', 'ctrlB'])
			expect(controlsMap.get('ctrlA').triggerLocationHasChanged).toHaveBeenCalledTimes(1)
			expect(controlsMap.get('ctrlB').triggerLocationHasChanged).toHaveBeenCalledTimes(1)
		})

		it('notifies of a page change when a control moves across pages', async () => {
			const { caller, controlsController } = setup({
				cells: [{ location: loc(1, 0, 0), controlId: 'ctrlA' }],
			})

			await caller.gridBatchTransfer({
				operation: 'move',
				pairs: [{ fromLocation: loc(1, 0, 0), toLocation: loc(2, 0, 0) }],
			})

			expect(controlsController.notifyControlMovedPage).toHaveBeenCalledWith('ctrlA', 1, 2)
		})
	})

	describe('resetControls', () => {
		it('refuses to create at an off-grid location but still processes valid ones', async () => {
			const { caller, controlsController, logger } = setup()

			await caller.resetControls({
				locations: [loc(1, 0, 99), loc(1, 0, 0)],
				newType: 'button',
			})

			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('off the grid'))
			// Only the on-grid location is created
			expect(controlsController.createButtonControl).toHaveBeenCalledTimes(1)
			expect(controlsController.createButtonControl).toHaveBeenCalledWith(loc(1, 0, 0), 'button')
		})

		it('replaces an existing control when a newType is given', async () => {
			const { caller, controlsController } = setup({
				cells: [{ location: loc(1, 0, 0), controlId: 'ctrlA' }],
			})

			await caller.resetControls({ locations: [loc(1, 0, 0)], newType: 'button' })

			expect(controlsController.deleteControl).toHaveBeenCalledWith('ctrlA')
			expect(controlsController.createButtonControl).toHaveBeenCalledWith(loc(1, 0, 0), 'button')
		})

		it('clears a control without recreating when newType is null, ignoring the grid bounds', async () => {
			const { caller, controlsController } = setup({
				cells: [{ location: loc(1, 0, 99), controlId: 'ctrlOff' }],
			})

			await caller.resetControls({ locations: [loc(1, 0, 99)], newType: null })

			expect(controlsController.deleteControl).toHaveBeenCalledWith('ctrlOff')
			expect(controlsController.createButtonControl).not.toHaveBeenCalled()
		})
	})

	describe('hotPressControl', () => {
		it('presses the control at the location', async () => {
			const { caller, controlsController } = setup({
				cells: [{ location: loc(1, 0, 0), controlId: 'ctrlA' }],
			})

			await caller.hotPressControl({ location: loc(1, 0, 0), direction: true, surfaceId: 'surface1' })

			expect(controlsController.pressControl).toHaveBeenCalledWith('ctrlA', true, 'hot:surface1')
		})

		it('does nothing when there is no control at the location', async () => {
			const { caller, controlsController } = setup()

			await caller.hotPressControl({ location: loc(1, 0, 0), direction: true, surfaceId: 'surface1' })

			expect(controlsController.pressControl).not.toHaveBeenCalled()
		})
	})

	describe('setOptionsField', () => {
		it('delegates to the control when it supports options', async () => {
			const { caller, controlsMap } = setup({
				cells: [{ location: loc(1, 0, 0), controlId: 'ctrlA' }],
			})

			const result = await caller.setOptionsField({ controlId: 'ctrlA', key: 'text', value: 'hello' })

			expect(result).toBe(true)
			expect(controlsMap.get('ctrlA').optionsSetField).toHaveBeenCalledWith('text', 'hello')
		})

		it('returns false when the control does not exist', async () => {
			const { caller } = setup()

			const result = await caller.setOptionsField({ controlId: 'missing', key: 'text', value: 'hello' })

			expect(result).toBe(false)
		})
	})
})
