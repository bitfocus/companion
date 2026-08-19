import { describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type { ActionEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ClientDevicesListItem, ClientSurfaceItem } from '@companion-app/shared/Model/Surfaces.js'
import type { IControlStore } from '../../lib/Controls/IControlStore.js'
import type { RunActionExtras } from '../../lib/Instance/Connection/ChildHandlerApi.js'
import { InternalSurface } from '../../lib/Internal/Surface.js'
import type {
	ActionForInternalExecution,
	ActionForVisitor,
	FeedbackForInternalExecution,
	FeedbackForVisitor,
	InternalVisitor,
} from '../../lib/Internal/Types.js'
import type { IPageStore } from '../../lib/Page/Store.js'
import type { SurfaceController } from '../../lib/Surface/Controller.js'

function createSurface() {
	const surfaceController = mockDeep<SurfaceController>()
	const controlsStore = mockDeep<IControlStore>()
	const pageStore = mockDeep<IPageStore>()

	// Sensible defaults; individual tests override as needed.
	surfaceController.getGroupIdFromDeviceId.mockReturnValue('group0')
	surfaceController.isPinLockEnabled.mockReturnValue(true)
	surfaceController.triggerRefreshDevices.mockResolvedValue(undefined)
	pageStore.getPageInfo.mockReturnValue({ id: 'page-2' } as any)

	const surface = new InternalSurface(surfaceController, controlsStore, pageStore)

	return { surface, surfaceController, controlsStore, pageStore }
}

function makeExecAction(definitionId: string, options: Record<string, unknown>): ActionForInternalExecution {
	return {
		id: 'action1',
		definitionId,
		options: options as any,
		rawEntity: { rawOptions: {} } as any,
	}
}

function makeExtras(overrides: Partial<RunActionExtras> = {}): RunActionExtras {
	return {
		controlId: 'ctrl1',
		surfaceId: 'surface0',
		location: undefined,
		abortDelayed: new AbortController().signal,
		executionMode: 'sequential',
		rotationDelta: null,
		...overrides,
	}
}

/** Flush a `setImmediate` callback (used by the lock/unlock actions). */
const flushImmediate = async () => new Promise((resolve) => setImmediate(resolve))

const fakeExtras = makeExtras()

function makeSurfaceItem(overrides: Partial<ClientSurfaceItem>): ClientSurfaceItem {
	return {
		id: 'surface0',
		type: 'test',
		integrationType: 'test',
		name: '',
		configFields: [],
		isConnected: true,
		displayName: 'Surface 0',
		location: null,
		locked: false,
		enabled: true,
		canChangeEnabled: true,
		hasFirmwareUpdates: null,
		size: null,
		rotation: null,
		brightness: 100,
		offset: null,
		...overrides,
	}
}

function makeGroup(overrides: Partial<ClientDevicesListItem>): ClientDevicesListItem {
	return {
		id: 'group:g0',
		index: 0,
		displayName: 'Group 0',
		isAutoGroup: false,
		surfaces: [],
		...overrides,
	}
}

describe('InternalSurface', () => {
	describe('executeAction: brightness', () => {
		test('set_brightness sets the device brightness', () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(makeExecAction('set_brightness', { surfaceId: 'surface0', brightness: 42 }), fakeExtras)

			expect(surfaceController.setDeviceBrightness).toHaveBeenCalledWith('surface0', 42, true)
		})

		test('adjust_brightness adjusts the device brightness', () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(makeExecAction('adjust_brightness', { surfaceId: 'surface0', brightness: -10 }), fakeExtras)

			expect(surfaceController.adjustDeviceBrightness).toHaveBeenCalledWith('surface0', -10, true)
		})

		test("surfaceId 'self' resolves to the invoking surface", () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(
				makeExecAction('set_brightness', { surfaceId: 'self', brightness: 50 }),
				makeExtras({ surfaceId: 'deck-7' })
			)

			expect(surfaceController.setDeviceBrightness).toHaveBeenCalledWith('deck-7', 50, true)
		})

		test('no action when surfaceId is empty', () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(makeExecAction('set_brightness', { surfaceId: '', brightness: 42 }), fakeExtras)

			expect(surfaceController.setDeviceBrightness).not.toHaveBeenCalled()
		})
	})

	describe('executeAction: page changes', () => {
		// Regression guard for the `#changeSurfacePage` defer default. The pre-fix code was
		// `!(surfaceId in ['back', 'forward'])`, where `in` checks array indices against the surface
		// id string and so always evaluated to `true` — every page change was deferred, including
		// back/forward history navigation which should redraw immediately.

		test('absolute set_page resolves the page id and defers the redraw', () => {
			const { surface, surfaceController, pageStore } = createSurface()
			pageStore.getPageInfo.mockReturnValue({ id: 'page-5' } as any)

			surface.executeAction(makeExecAction('set_page', { surfaceId: 'surface0', page: 5 }), fakeExtras)

			expect(surfaceController.devicePageSet).toHaveBeenCalledWith('group0', 'page-5', true, true)
		})

		test.each([
			['+1', 'inc_page'],
			['-1', 'dec_page'],
		])('%s (%s) defers the redraw', (toPage, definitionId) => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(makeExecAction(definitionId, { surfaceId: 'surface0' }), fakeExtras)

			expect(surfaceController.devicePageSet).toHaveBeenCalledWith('group0', toPage, true, true)
		})

		test.each(['back', 'forward'])('%s navigation redraws immediately (no defer)', (toPage) => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(makeExecAction('set_page', { surfaceId: 'surface0', page: toPage }), fakeExtras)

			expect(surfaceController.devicePageSet).toHaveBeenCalledWith('group0', toPage, true, false)
		})

		test('startup page resolves to the surface startup page id', () => {
			const { surface, surfaceController } = createSurface()
			surfaceController.devicePageGetStartup.mockReturnValue('page-startup')

			surface.executeAction(makeExecAction('set_page', { surfaceId: 'surface0', page: 'startup' }), fakeExtras)

			expect(surfaceController.devicePageSet).toHaveBeenCalledWith('group0', 'page-startup', true, true)
		})

		test('startup page falls back to the first page when the surface has none', () => {
			const { surface, surfaceController, pageStore } = createSurface()
			surfaceController.devicePageGetStartup.mockReturnValue(undefined)
			pageStore.getFirstPageId.mockReturnValue('page-first')

			surface.executeAction(makeExecAction('set_page', { surfaceId: 'surface0', page: 'startup' }), fakeExtras)

			expect(surfaceController.devicePageSet).toHaveBeenCalledWith('group0', 'page-first', true, true)
		})

		test('unknown absolute page is ignored', () => {
			const { surface, surfaceController, pageStore } = createSurface()
			pageStore.getPageInfo.mockReturnValue(undefined)

			surface.executeAction(makeExecAction('set_page', { surfaceId: 'surface0', page: 99 }), fakeExtras)

			expect(surfaceController.devicePageSet).not.toHaveBeenCalled()
		})

		test('page change is skipped when the surface has no group', () => {
			const { surface, surfaceController } = createSurface()
			surfaceController.getGroupIdFromDeviceId.mockReturnValue(undefined)

			surface.executeAction(makeExecAction('set_page', { surfaceId: 'surface0', page: 5 }), fakeExtras)

			expect(surfaceController.devicePageSet).not.toHaveBeenCalled()
		})
	})

	describe('executeAction: set_page_byindex', () => {
		test('resolves the surface from its index and changes page', () => {
			const { surface, surfaceController, pageStore } = createSurface()
			surfaceController.getDeviceIdFromIndex.mockReturnValue('surface-idx')
			pageStore.getPageInfo.mockReturnValue({ id: 'page-3' } as any)

			surface.executeAction(makeExecAction('set_page_byindex', { surfaceIndex: 2, page: 3 }), fakeExtras)

			expect(surfaceController.getDeviceIdFromIndex).toHaveBeenCalledWith(2)
			expect(surfaceController.devicePageSet).toHaveBeenCalledWith('group0', 'page-3', true, true)
		})

		test.each([-1, NaN])('invalid index %s is ignored', (surfaceIndex) => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(makeExecAction('set_page_byindex', { surfaceIndex, page: 3 }), fakeExtras)

			expect(surfaceController.getDeviceIdFromIndex).not.toHaveBeenCalled()
			expect(surfaceController.devicePageSet).not.toHaveBeenCalled()
		})

		test.each([undefined, ''])('unavailable index (resolves to %s) is ignored', (resolved) => {
			const { surface, surfaceController } = createSurface()
			surfaceController.getDeviceIdFromIndex.mockReturnValue(resolved)

			surface.executeAction(makeExecAction('set_page_byindex', { surfaceIndex: 2, page: 3 }), fakeExtras)

			expect(surfaceController.devicePageSet).not.toHaveBeenCalled()
		})
	})

	describe('executeAction: locking', () => {
		test('lockout_device locks the surface after the immediate tick', async () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(makeExecAction('lockout_device', { surfaceId: 'surface0' }), makeExtras({ controlId: '' }))

			expect(surfaceController.setSurfaceOrGroupLocked).not.toHaveBeenCalled()
			await flushImmediate()
			expect(surfaceController.setSurfaceOrGroupLocked).toHaveBeenCalledWith('surface0', true, true)
		})

		test('lockout_device does nothing when pin lock is disabled', async () => {
			const { surface, surfaceController } = createSurface()
			surfaceController.isPinLockEnabled.mockReturnValue(false)

			surface.executeAction(makeExecAction('lockout_device', { surfaceId: 'surface0' }), fakeExtras)

			await flushImmediate()
			expect(surfaceController.setSurfaceOrGroupLocked).not.toHaveBeenCalled()
		})

		test('lockout_device clears the pushed state of the invoking control', async () => {
			const { surface, surfaceController, controlsStore } = createSurface()
			const control = { supportsPushed: true, setPushed: vi.fn() }
			controlsStore.getControl.mockReturnValue(control as any)

			surface.executeAction(
				makeExecAction('lockout_device', { surfaceId: 'self' }),
				makeExtras({ controlId: 'ctrl1', surfaceId: 'surface0' })
			)

			expect(controlsStore.getControl).toHaveBeenCalledWith('ctrl1')
			expect(control.setPushed).toHaveBeenCalledWith(false, 'surface0')
			await flushImmediate()
			expect(surfaceController.setSurfaceOrGroupLocked).toHaveBeenCalledWith('surface0', true, true)
		})

		test('unlockout_device unlocks the surface', async () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(makeExecAction('unlockout_device', { surfaceId: 'surface0' }), fakeExtras)

			await flushImmediate()
			expect(surfaceController.setSurfaceOrGroupLocked).toHaveBeenCalledWith('surface0', false, true)
		})

		test('lockout_all locks everything when pin lock is enabled', async () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(makeExecAction('lockout_all', {}), makeExtras({ controlId: '' }))

			await flushImmediate()
			expect(surfaceController.setAllLocked).toHaveBeenCalledWith(true)
		})

		test('lockout_all does nothing when pin lock is disabled', async () => {
			const { surface, surfaceController } = createSurface()
			surfaceController.isPinLockEnabled.mockReturnValue(false)

			surface.executeAction(makeExecAction('lockout_all', {}), fakeExtras)

			await flushImmediate()
			expect(surfaceController.setAllLocked).not.toHaveBeenCalled()
		})

		test('unlockout_all unlocks everything without needing pin lock', async () => {
			const { surface, surfaceController } = createSurface()
			surfaceController.isPinLockEnabled.mockReturnValue(false)

			surface.executeAction(makeExecAction('unlockout_all', {}), fakeExtras)

			await flushImmediate()
			expect(surfaceController.setAllLocked).toHaveBeenCalledWith(false)
		})
	})

	describe('executeAction: misc', () => {
		test('rescan triggers a device refresh', () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(makeExecAction('rescan', {}), fakeExtras)

			expect(surfaceController.triggerRefreshDevices).toHaveBeenCalled()
		})

		test('surface_set_position sets the absolute offset', () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(
				makeExecAction('surface_set_position', { surfaceId: 'surface0', x_offset: 3, y_offset: 4 }),
				fakeExtras
			)

			expect(surfaceController.setDevicePosition).toHaveBeenCalledWith('surface0', 3, 4, true)
		})

		test('surface_set_position ignores non-numeric offsets', () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(
				makeExecAction('surface_set_position', { surfaceId: 'surface0', x_offset: 'abc', y_offset: 4 }),
				fakeExtras
			)

			expect(surfaceController.setDevicePosition).not.toHaveBeenCalled()
		})

		test('surface_adjust_position adjusts the offset', () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(
				makeExecAction('surface_adjust_position', { surfaceId: 'surface0', x_adjustment: -2, y_adjustment: 1 }),
				fakeExtras
			)

			expect(surfaceController.adjustDevicePosition).toHaveBeenCalledWith('surface0', -2, 1, true)
		})

		test('surface_adjust_position ignores non-numeric adjustments', () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(
				makeExecAction('surface_adjust_position', { surfaceId: 'surface0', x_adjustment: 1, y_adjustment: 'x' }),
				fakeExtras
			)

			expect(surfaceController.adjustDevicePosition).not.toHaveBeenCalled()
		})

		test('unknown action returns null', () => {
			const { surface } = createSurface()

			expect(surface.executeAction(makeExecAction('not_a_real_action', {}), fakeExtras)).toBeNull()
		})

		test('a handled action returns an undefined result', () => {
			const { surface } = createSurface()

			expect(surface.executeAction(makeExecAction('rescan', {}), fakeExtras)).toEqual({ result: undefined })
		})
	})

	describe('executeAction: outbound_surface_set_enabled', () => {
		test('enable sets the surface enabled', () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(
				makeExecAction('outbound_surface_set_enabled', { surfaceId: 'remote1', setType: 'enable' }),
				fakeExtras
			)

			expect(surfaceController.outbound.setOutboundEnabled).toHaveBeenCalledWith('remote1', true)
		})

		test('disable sets the surface disabled', () => {
			const { surface, surfaceController } = createSurface()

			surface.executeAction(
				makeExecAction('outbound_surface_set_enabled', { surfaceId: 'remote1', setType: 'disable' }),
				fakeExtras
			)

			expect(surfaceController.outbound.setOutboundEnabled).toHaveBeenCalledWith('remote1', false)
		})

		test('toggle flips a currently-enabled surface off', () => {
			const { surface, surfaceController } = createSurface()
			surfaceController.outbound.getById.mockReturnValue({ enabled: true } as any)

			surface.executeAction(
				makeExecAction('outbound_surface_set_enabled', { surfaceId: 'remote1', setType: 'toggle' }),
				fakeExtras
			)

			expect(surfaceController.outbound.setOutboundEnabled).toHaveBeenCalledWith('remote1', false)
		})

		test('toggle turns an unknown surface on', () => {
			const { surface, surfaceController } = createSurface()
			surfaceController.outbound.getById.mockReturnValue(undefined)

			surface.executeAction(
				makeExecAction('outbound_surface_set_enabled', { surfaceId: 'remote1', setType: 'toggle' }),
				fakeExtras
			)

			expect(surfaceController.outbound.setOutboundEnabled).toHaveBeenCalledWith('remote1', true)
		})
	})

	describe('actionUpgrade', () => {
		test('rewrites the v4.2 empty-string set_page to page "0"', () => {
			const { surface } = createSurface()
			const action = {
				definitionId: 'set_page',
				options: { page: { isExpression: false, value: '' } },
			} as unknown as ActionEntityModel

			const result = surface.actionUpgrade(action, 'ctrl1')

			expect(result).toBe(action)
			expect((action.options.page as any).value).toBe('0')
		})

		test('leaves an expression page untouched', () => {
			const { surface } = createSurface()
			const action = {
				definitionId: 'set_page',
				options: { page: { isExpression: true, value: '' } },
			} as unknown as ActionEntityModel

			expect(surface.actionUpgrade(action, 'ctrl1')).toBeUndefined()
		})

		test('leaves non set_page actions untouched', () => {
			const { surface } = createSurface()
			const action = {
				definitionId: 'set_brightness',
				options: { page: { isExpression: false, value: '' } },
			} as unknown as ActionEntityModel

			expect(surface.actionUpgrade(action, 'ctrl1')).toBeUndefined()
		})
	})

	describe('executeFeedback', () => {
		function makeFeedback(definitionId: string, options: Record<string, unknown>): FeedbackForInternalExecution {
			return { controlId: 'ctrl1', location: undefined, id: 'fb1', definitionId, options: options as any }
		}

		test('surface_on_page is true when the surface is on the requested page', () => {
			const { surface, surfaceController, pageStore } = createSurface()
			pageStore.getPageInfo.mockReturnValue({ id: 'page-2' } as any)
			surfaceController.devicePageGet.mockReturnValue('page-2')

			expect(surface.executeFeedback(makeFeedback('surface_on_page', { surfaceId: 'surface0', page: 2 }))).toBe(true)
		})

		test('surface_on_page is false when the surface is on a different page', () => {
			const { surface, surfaceController, pageStore } = createSurface()
			pageStore.getPageInfo.mockReturnValue({ id: 'page-2' } as any)
			surfaceController.devicePageGet.mockReturnValue('page-9')

			expect(surface.executeFeedback(makeFeedback('surface_on_page', { surfaceId: 'surface0', page: 2 }))).toBe(false)
		})

		test('surface_on_page is false when no surface is selected', () => {
			const { surface } = createSurface()

			expect(surface.executeFeedback(makeFeedback('surface_on_page', { surfaceId: '', page: 2 }))).toBe(false)
		})

		test('outbound_surface_enabled reflects the surface enabled state', () => {
			const { surface, surfaceController } = createSurface()
			surfaceController.outbound.getById.mockReturnValue({ enabled: true } as any)

			expect(surface.executeFeedback(makeFeedback('outbound_surface_enabled', { surfaceId: 'remote1' }))).toBe(true)
		})

		test('outbound_surface_enabled is false for an unknown surface', () => {
			const { surface, surfaceController } = createSurface()
			surfaceController.outbound.getById.mockReturnValue(undefined)

			expect(surface.executeFeedback(makeFeedback('outbound_surface_enabled', { surfaceId: 'remote1' }))).toBe(false)
		})
	})

	describe('getVariableDefinitions', () => {
		test('emits group and surface variables, skipping auto-groups and disconnected surfaces', () => {
			const { surface, surfaceController } = createSurface()
			surfaceController.getDevicesList.mockReturnValue([
				makeGroup({
					id: 'group:g0',
					displayName: 'Group 0',
					surfaces: [
						makeSurfaceItem({ id: 'aa:bb', displayName: 'Deck A', isConnected: true }),
						makeSurfaceItem({ id: 'cc:dd', displayName: 'Deck B', isConnected: false }),
					],
				}),
				makeGroup({ id: 'auto', isAutoGroup: true, surfaces: [] }),
			])

			const names = surface.getVariableDefinitions().map((d) => d.name)

			// Group vars use the id with the `group:` prefix stripped.
			expect(names).toContain('surface_group_g0_name')
			expect(names).toContain('surface_group_g0_page')
			expect(names).toContain('surface_group_g0_surface_count')
			// Connected surface, with `:` sanitized to `_`.
			expect(names).toContain('surface_aa_bb_page')
			expect(names).toContain('surface_aa_bb_brightness')
			// Disconnected surface is skipped.
			expect(names).not.toContain('surface_cc_dd_page')
		})
	})

	describe('updateVariables', () => {
		test('emits the current surface and group values', () => {
			const { surface, surfaceController, pageStore } = createSurface()
			surfaceController.getDevicesList.mockReturnValue([
				makeGroup({
					id: 'group:g0',
					displayName: 'Group 0',
					surfaces: [makeSurfaceItem({ id: 'aa', name: 'My Deck', locked: true, brightness: 80, location: 'Local' })],
				}),
			])
			surfaceController.devicePageGet.mockReturnValue('page-id')
			pageStore.getPageNumber.mockReturnValue(4)

			const setVariables = vi.fn()
			surface.on('setVariables', setVariables)
			surface.updateVariables()

			const values = setVariables.mock.lastCall![0]
			expect(values).toMatchObject({
				surface_aa_name: 'My Deck',
				surface_aa_locked: true,
				surface_aa_brightness: 80,
				surface_aa_location: 'Local',
				surface_aa_page: 4,
				surface_group_g0_name: 'Group 0',
				surface_group_g0_surface_count: 1,
				surface_group_g0_page: 4,
			})
		})

		test('clears variables that were set on a previous run but are gone now', () => {
			const { surface, surfaceController, pageStore } = createSurface()
			pageStore.getPageNumber.mockReturnValue(1)
			surfaceController.devicePageGet.mockReturnValue('page-id')

			const setVariables = vi.fn()
			surface.on('setVariables', setVariables)

			surfaceController.getDevicesList.mockReturnValue([
				makeGroup({ id: 'auto', isAutoGroup: true, surfaces: [makeSurfaceItem({ id: 'aa' })] }),
			])
			surface.updateVariables()
			expect(setVariables.mock.lastCall![0]).toHaveProperty('surface_aa_name')

			// The surface disappears on the next run.
			surfaceController.getDevicesList.mockReturnValue([makeGroup({ id: 'auto', isAutoGroup: true, surfaces: [] })])
			surface.updateVariables()

			expect(setVariables.mock.lastCall![0]).toMatchObject({ surface_aa_name: undefined })
		})
	})

	describe('definitions', () => {
		test('exposes the expected action ids', () => {
			const { surface } = createSurface()

			expect(Object.keys(surface.getActionDefinitions()).sort()).toEqual(
				[
					'set_brightness',
					'adjust_brightness',
					'set_page',
					'set_page_byindex',
					'inc_page',
					'dec_page',
					'lockout_device',
					'unlockout_device',
					'lockout_all',
					'unlockout_all',
					'rescan',
					'surface_set_position',
					'surface_adjust_position',
					'outbound_surface_set_enabled',
				].sort()
			)
		})

		test('exposes the expected feedback ids', () => {
			const { surface } = createSurface()

			expect(Object.keys(surface.getFeedbackDefinitions()).sort()).toEqual(
				['surface_on_page', 'outbound_surface_enabled'].sort()
			)
		})
	})

	describe('visitReferences', () => {
		test('visits the outbound surface id on actions and feedbacks', () => {
			const { surface } = createSurface()
			const visitor = mockDeep<InternalVisitor>()

			const actions: ActionForVisitor[] = [
				{ id: 'a1', action: 'outbound_surface_set_enabled', options: { surfaceId: 'remote1' } as any },
				{ id: 'a2', action: 'set_brightness', options: {} },
			]
			const feedbacks: FeedbackForVisitor[] = [
				{ id: 'f1', type: 'outbound_surface_enabled', options: { surfaceId: 'remote2' } as any },
				{ id: 'f2', type: 'surface_on_page', options: {} },
			]

			surface.visitReferences(visitor, actions, feedbacks)

			expect(visitor.visitOutboundSurfaceId).toHaveBeenCalledWith(actions[0].options, 'surfaceId')
			expect(visitor.visitOutboundSurfaceId).toHaveBeenCalledWith(feedbacks[0].options, 'surfaceId', 'f1')
			expect(visitor.visitOutboundSurfaceId).toHaveBeenCalledTimes(2)
		})
	})
})
