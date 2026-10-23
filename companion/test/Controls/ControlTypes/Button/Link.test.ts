import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseLinkButtonOptions, type LinkButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ControlDependencies } from '../../../../lib/Controls/ControlDependencies.js'
import { ControlButtonLink } from '../../../../lib/Controls/ControlTypes/Button/Link.js'
import { LINK_ICON_SVG, LINK_SLASH_ICON_SVG } from '../../../../lib/Controls/ControlTypes/Button/LinkButtonIcons.js'
import { DisplayedLocations } from '../../../../lib/Graphics/DisplayedLocations.js'
import type { LinkButtonClient, LinkButtonState } from '../../../../lib/Link/ButtonClient.js'
import type { LinkButtonImage } from '../../../../lib/Link/RemoteImageStore.js'
import { mangleReferenceSurfaceId } from '../../../../lib/Surface/ReferenceSurfaceId.js'

const MY_CONTROL_ID = 'bank:test01'

const NO_DECORATION_STATE = {
	remoteKey: 'peer/remote',
	unreachable: false,
	stepCurrent: 1,
	stepCount: 1,
	buttonStatus: undefined,
	actionRunning: false,
}
const MY_LOCATION: ControlLocation = { pageNumber: 1, row: 2, column: 3 }

function makeModel(peerId: string, location: string): LinkButtonModel {
	return {
		type: 'link-button',
		options: parseLinkButtonOptions({ peerId, location: { value: location, isExpression: false } }).options,
	}
}

describe('ControlButtonLink', () => {
	let deps: ControlDependencies
	let linkButtons: {
		setTarget: ReturnType<typeof vi.fn>
		removeTarget: ReturnType<typeof vi.fn>
		getState: ReturnType<typeof vi.fn>
		press: ReturnType<typeof vi.fn>
		rotate: ReturnType<typeof vi.fn>
		abort: ReturnType<typeof vi.fn>
		setDisplayedSizes: ReturnType<typeof vi.fn>
		setDecoration: ReturnType<typeof vi.fn>
	}
	let parseVariables: ReturnType<typeof vi.fn>
	let displayedLocations: DisplayedLocations

	beforeEach(() => {
		linkButtons = {
			setTarget: vi.fn(),
			removeTarget: vi.fn(),
			getState: vi.fn(() => undefined),
			press: vi.fn(),
			rotate: vi.fn(() => true),
			abort: vi.fn(),
			setDisplayedSizes: vi.fn(),
			setDecoration: vi.fn(),
		}
		displayedLocations = new DisplayedLocations()

		parseVariables = vi.fn((value: string) => ({ text: String(value), variableIds: new Set<string>() }))
		const parser = {
			parseVariables,
			executeExpression: vi.fn((value: string) => ({ ok: true, value, variableIds: new Set<string>() })),
		}

		deps = {
			surfaces: {} as any,
			pageStore: { getLocationOfControlId: vi.fn(() => MY_LOCATION) } as any,
			getPageVariableEntities: () => null,
			triggerEvents: null as any,
			expressionVariableNamesMap: null as any,
			internalModule: { entityUpgrade: vi.fn(() => undefined), visitReferences: vi.fn() } as any,
			instance: {} as any,
			variableValues: { createVariablesAndExpressionParser: vi.fn(() => parser) } as any,
			userconfig: {} as any,
			graphics: Object.assign(new EventEmitter(), { displayedLocations }) as any,
			actionRunner: {} as any,
			dbTable: { set: vi.fn(), delete: vi.fn() } as any,
			events: new EventEmitter() as any,
			changeEvents: new EventEmitter() as any,
			renderClock: { subscribe: vi.fn(() => () => {}) } as any,
			controlsAccessor: null as any,
			linkButtons: linkButtons as unknown as LinkButtonClient,
			customActionInstances: { entityUpdate: vi.fn(), entityDelete: vi.fn() },
		}
	})

	it('tells the link client what to show', () => {
		new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '2/0/1'), false)
		expect(linkButtons.setTarget).toHaveBeenLastCalledWith(
			MY_CONTROL_ID,
			{ peerId: 'peer', location: { pageNumber: 2, row: 0, column: 1 } },
			expect.any(Function)
		)
	})

	it('tells the link client the sizes it is shown at, again when it moves', () => {
		displayedLocations.acquire(MY_LOCATION, { width: 200, height: 100 })
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '2/0/1'), false)
		expect(linkButtons.setDisplayedSizes).toHaveBeenLastCalledWith(MY_CONTROL_ID, [{ width: 200, height: 100 }])

		vi.mocked(deps.pageStore.getLocationOfControlId).mockReturnValue({ ...MY_LOCATION, column: 4 })
		control.triggerLocationHasChanged()
		expect(linkButtons.setDisplayedSizes).toHaveBeenLastCalledWith(MY_CONTROL_ID, [])
	})

	it('resolves `this` to the location of the button itself', () => {
		new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', 'this'), false)
		expect(linkButtons.setTarget).toHaveBeenLastCalledWith(
			MY_CONTROL_ID,
			{ peerId: 'peer', location: MY_LOCATION },
			expect.any(Function)
		)
	})

	it('says when the location given is not a button location, rather than that nothing is set', async () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', 'nonsense'), false)
		expect(linkButtons.setTarget).toHaveBeenLastCalledWith(MY_CONTROL_ID, null, expect.any(Function))
		expect(control.toRuntimeJSON().status).toBe('bad_location')
		expect((await control.drawing.getDrawStyle()).elements).toMatchObject([
			{ type: 'canvas' },
			{ type: 'box' },
			{ type: 'image', base64Image: LINK_SLASH_ICON_SVG },
			{ type: 'text', text: 'Remote\nbad location' },
		])

		control.optionsSetField('location', { value: '', isExpression: false })
		expect(control.toRuntimeJSON().status).toBe('unconfigured')
	})

	it.each(['1.5/0/0', '1/0/20000'])('says %s is a bad location, as it is not one a peer accepts', (location) => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', location), false)
		expect(linkButtons.setTarget).toHaveBeenLastCalledWith(MY_CONTROL_ID, null, expect.any(Function))
		expect(control.toRuntimeJSON().status).toBe('bad_location')
	})

	it('has no target until both the peer and location are set', () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, null, false)
		expect(linkButtons.setTarget).toHaveBeenLastCalledWith(MY_CONTROL_ID, null, expect.any(Function))

		control.optionsSetField('peerId', 'peer')
		expect(linkButtons.setTarget).toHaveBeenLastCalledWith(MY_CONTROL_ID, null, expect.any(Function))

		control.optionsSetField('location', { value: '1/0/0', isExpression: false })
		expect(linkButtons.setTarget).toHaveBeenLastCalledWith(
			MY_CONTROL_ID,
			{ peerId: 'peer', location: { pageNumber: 1, row: 0, column: 0 } },
			expect.any(Function)
		)
		expect(control.toJSON().options).toEqual({
			peerId: 'peer',
			location: { value: '1/0/0', isExpression: false },
			decoration: 'default',
			showStatusIcons: 'default',
		})
	})

	it('replaces invalid stored options by their defaults, and saves the result', () => {
		const storage = {
			type: 'link-button',
			options: { peerId: 'peer', location: { value: 5, isExpression: false }, notes: 'kept' },
		} as unknown as LinkButtonModel
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, storage, false)

		expect(control.toJSON().options).toEqual({
			peerId: 'peer',
			location: { value: '', isExpression: false },
			notes: 'kept',
			decoration: 'default',
			showStatusIcons: 'default',
		})
		expect(deps.dbTable.set).toHaveBeenCalledWith(MY_CONTROL_ID, control.toJSON())
	})

	it('rejects invalid options', () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, null, false)
		expect(control.optionsSetField('peerId', 5)).toBe(false)
		expect(control.optionsSetField('location', 'nope')).toBe(false)
		expect(control.optionsSetField('location', { value: 5, isExpression: false })).toBe(false)
		expect(control.optionsSetField('location', { isExpression: true })).toBe(false)
		expect(control.optionsSetField('other', 'x')).toBe(false)
	})

	it('resolves the location again when a variable it uses changes', () => {
		parseVariables.mockImplementation(() => ({ text: '3/0/0', variableIds: new Set(['custom:page']) }))
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '$(custom:page)/0/0'), false)
		linkButtons.setTarget.mockClear()

		control.onVariablesChanged(new Set(['custom:other']))
		expect(linkButtons.setTarget).not.toHaveBeenCalled()

		control.onVariablesChanged(new Set(['custom:page']))
		expect(linkButtons.setTarget).toHaveBeenCalled()
	})

	it('forwards presses and rotation with its id appended to the surface id', () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)

		control.pressControl(true, 'deck')
		expect(linkButtons.press).toHaveBeenCalledWith(MY_CONTROL_ID, true, mangleReferenceSurfaceId('deck', MY_CONTROL_ID))

		expect(control.rotateControl(2, 'deck')).toBe(true)
		expect(linkButtons.rotate).toHaveBeenCalledWith(MY_CONTROL_ID, 2, mangleReferenceSurfaceId('deck', MY_CONTROL_ID))
	})

	it('forwards aborts, as its actions run on the remote installation', () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)

		control.abortDelayedActions(true, null, 1)
		expect(linkButtons.abort).toHaveBeenCalledWith(MY_CONTROL_ID, true, 1)
	})

	it('draws the remote image, or a placeholder', async () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)

		// Nothing to show yet: a link icon and why
		const placeholder = await control.drawing.getDrawStyle()
		expect(placeholder.elements).toMatchObject([
			{ type: 'canvas' },
			{ type: 'box' },
			{ type: 'image', base64Image: LINK_ICON_SVG },
			{ type: 'text', text: 'Remote\nbutton' },
		])

		// Can't be shown: a broken link icon
		linkButtons.getState.mockReturnValue({
			status: 'offline',
			peerName: 'Peer',
			...NO_DECORATION_STATE,
			images: [],
			pressed: false,
			sourceChain: [],
		} satisfies LinkButtonState)
		expect((await control.drawing.getDrawStyle()).elements).toMatchObject([
			{ type: 'canvas' },
			{ type: 'box' },
			{ type: 'image', base64Image: LINK_SLASH_ICON_SVG },
			{ type: 'text', text: 'Remote\noffline' },
		])

		const state: LinkButtonState = {
			status: 'ok',
			peerName: 'Peer',
			remoteKey: 'peer/remote',
			images: [image(144, 144, 'AAAA', true)],
			unreachable: false,
			pressed: true,
			stepCurrent: 2,
			stepCount: 3,
			buttonStatus: 'error',
			actionRunning: true,
			sourceChain: ['peer'],
		}
		linkButtons.getState.mockReturnValue(state)

		// Decorated here, from the state of the remote button
		const style = await control.drawing.getDrawStyle()
		expect(style).toMatchObject({
			pushed: true,
			stepCurrent: 2,
			stepCount: 3,
			button_status: 'error',
			action_running: true,
			link_status: 'ok',
		})
		expect(style.elements).toMatchObject([
			{ type: 'canvas', decoration: 'default', showStatusIcons: 'default' },
			{ type: 'remote', source: 'peer/remote' },
		])
		expect(control.toRuntimeJSON()).toEqual({ status: 'ok', peerName: 'Peer' })

		// Still showing the last image of an installation that has dropped out
		linkButtons.getState.mockReturnValue({ ...state, unreachable: true })
		expect((await control.drawing.getDrawStyle()).link_status).toBe('unreachable')

		// A remote button with nothing on it is shown as that, decorated, rather than as still loading
		linkButtons.getState.mockReturnValue({ ...state, images: [] })
		expect((await control.drawing.getDrawStyle()).elements).toMatchObject([{ type: 'canvas' }])
	})

	it('is decorated as set, and tells the link client so', async () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)
		expect(linkButtons.setDecoration).toHaveBeenLastCalledWith(MY_CONTROL_ID, 'default')

		expect(control.optionsSetField('decoration', 'bogus')).toBe(false)
		expect(control.optionsSetField('showStatusIcons', 'bogus')).toBe(false)
		expect(control.optionsSetField('decoration', 'none')).toBe(true)
		expect(control.optionsSetField('showStatusIcons', 'all')).toBe(true)
		expect(linkButtons.setDecoration).toHaveBeenLastCalledWith(MY_CONTROL_ID, 'none')

		expect((await control.drawing.getDrawStyle()).elements[0]).toMatchObject({
			type: 'canvas',
			decoration: 'none',
			showStatusIcons: 'all',
		})
		expect(control.toJSON().options).toMatchObject({ decoration: 'none', showStatusIcons: 'all' })
	})

	function image(width: number, height: number, data: string, current: boolean): LinkButtonImage {
		return {
			width,
			height,
			dataUrl: `data:image/png;base64,${data}`,
			revision: { stream: 's', seq: current ? 2 : 1 },
			current,
		}
	}

	it('draws the remote image as a remote element, fetched for the size it is drawn at', async () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)

		linkButtons.getState.mockReturnValue({
			status: 'ok',
			peerName: 'Peer',
			...NO_DECORATION_STATE,
			images: [image(144, 144, 'SQUARE', true), image(288, 144, 'WIDE', false)],
			pressed: false,
			sourceChain: ['peer'],
		} satisfies LinkButtonState)

		const style = await control.drawing.getDrawStyle()
		expect(style.elements).toMatchObject([
			{ type: 'canvas' },
			{
				type: 'remote',
				source: 'peer/remote',
				x: 0,
				y: 0,
				width: 1,
				height: 1,
				// Changes with the images, so that renders of different ones are told apart without comparing them
				revision: '144x144@s:2,288x144@s:1',
			},
		])
	})

	it('is pushed when the remote button is, and reports each change', () => {
		const pushedState = (pressed: boolean): LinkButtonState => ({
			status: 'ok',
			peerName: 'Peer',
			...NO_DECORATION_STATE,
			images: [],
			pressed,
			sourceChain: ['peer'],
		})
		const reported: unknown[][] = []
		deps.events.on('updateButtonState', (...args: unknown[]) => reported.push(args))

		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)
		const onChange = linkButtons.setTarget.mock.lastCall![2] as () => void
		expect(control.supportsPushed).toBe(true)
		expect(control.pushed).toBe(false)

		linkButtons.getState.mockReturnValue(pushedState(true))
		onChange()
		onChange()
		expect(control.pushed).toBe(true)
		expect(reported).toEqual([[MY_LOCATION, true, undefined]])

		// It can't be changed from here
		expect(control.setPushed(false, 'deck')).toBe(false)
		expect(control.pushed).toBe(true)

		linkButtons.getState.mockReturnValue(pushedState(false))
		onChange()
		expect(reported).toEqual([
			[MY_LOCATION, true, undefined],
			[MY_LOCATION, false, undefined],
		])
	})

	it('reports being released when destroyed while pushed', () => {
		const reported: unknown[][] = []
		deps.events.on('updateButtonState', (...args: unknown[]) => reported.push(args))

		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)
		linkButtons.getState.mockReturnValue({
			status: 'ok',
			peerName: 'Peer',
			...NO_DECORATION_STATE,
			images: [],
			pressed: true,
			sourceChain: ['peer'],
		} satisfies LinkButtonState)
		;(linkButtons.setTarget.mock.lastCall![2] as () => void)()

		control.destroy()
		expect(reported).toEqual([
			[MY_LOCATION, true, undefined],
			[MY_LOCATION, false, undefined],
		])
	})

	it('releases its subscription when destroyed', () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)
		control.destroy()
		expect(linkButtons.removeTarget).toHaveBeenCalledWith(MY_CONTROL_ID)
	})
})
