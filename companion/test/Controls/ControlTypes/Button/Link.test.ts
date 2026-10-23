import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinkButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ControlDependencies } from '../../../../lib/Controls/ControlDependencies.js'
import { ControlButtonLink } from '../../../../lib/Controls/ControlTypes/Button/Link.js'
import { LINK_ICON_SVG, LINK_SLASH_ICON_SVG } from '../../../../lib/Controls/ControlTypes/Button/LinkButtonIcons.js'
import { DisplayedLocations } from '../../../../lib/Graphics/DisplayedLocations.js'
import type { LinkButtonClient, LinkButtonImage, LinkButtonState } from '../../../../lib/Link/ButtonClient.js'
import { mangleReferenceSurfaceId } from '../../../../lib/Surface/ReferenceSurfaceId.js'

const MY_CONTROL_ID = 'bank:test01'
const MY_LOCATION: ControlLocation = { pageNumber: 1, row: 2, column: 3 }

function makeModel(peerId: string, location: string): LinkButtonModel {
	return { type: 'link-button', options: { peerId, location: { value: location, isExpression: false } } }
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
		waitForImage: ReturnType<typeof vi.fn>
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
			waitForImage: vi.fn(async () => null),
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
			{ type: 'box' },
			{ type: 'image', base64Image: LINK_ICON_SVG },
			{ type: 'text', text: 'Remote\nbutton' },
		])

		// Can't be shown: a broken link icon
		linkButtons.getState.mockReturnValue({
			status: 'offline',
			peerName: 'Peer',
			images: [],
			pressed: false,
			sourceChain: [],
		} satisfies LinkButtonState)
		expect((await control.drawing.getDrawStyle()).elements).toMatchObject([
			{ type: 'box' },
			{ type: 'image', base64Image: LINK_SLASH_ICON_SVG },
			{ type: 'text', text: 'Remote\noffline' },
		])

		const state: LinkButtonState = {
			status: 'ok',
			peerName: 'Peer',
			images: [image(144, 144, 'AAAA', true)],
			pressed: true,
			sourceChain: ['peer'],
		}
		linkButtons.getState.mockReturnValue(state)

		const style = await control.drawing.getDrawStyle()
		expect(style.pushed).toBe(true)
		expect(style.elements).toMatchObject([
			{ type: 'canvas', decoration: 'none' },
			{ type: 'image', base64Image: 'data:image/png;base64,AAAA' },
		])
		expect(control.toRuntimeJSON()).toEqual({ status: 'ok', peerName: 'Peer' })
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

	it('draws each size from the image of its shape', async () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)
		expect(control.drawing.getSizedDraw()).toBeNull()

		linkButtons.getState.mockReturnValue({
			status: 'ok',
			peerName: 'Peer',
			// The strip is yet to catch up with the newest render
			images: [image(144, 144, 'SQUARE', true), image(288, 144, 'WIDE', false), image(144, 288, 'TALL', true)],
			pressed: false,
			sourceChain: ['peer'],
		} satisfies LinkButtonState)
		await control.drawing.getDrawStyle()
		const sized = control.drawing.getSizedDraw()!

		const imageAt = async (width: number, height: number) =>
			(await sized.elementsAt(width, height)).find((e) => e.type === 'image')
		expect(await imageAt(72, 72)).toMatchObject({ base64Image: 'data:image/png;base64,SQUARE' })
		expect(await imageAt(100, 200)).toMatchObject({ base64Image: 'data:image/png;base64,TALL' })
		expect(linkButtons.waitForImage).not.toHaveBeenCalled()

		// Waits for the newest strip, and without it draws the closest newest shape
		expect(await imageAt(200, 100)).toMatchObject({ base64Image: 'data:image/png;base64,SQUARE' })
		expect(linkButtons.waitForImage).toHaveBeenCalledWith(MY_CONTROL_ID, { width: 200, height: 100 })

		linkButtons.waitForImage.mockResolvedValueOnce(image(288, 144, 'WIDE-NEW', true))
		expect(await imageAt(200, 100)).toMatchObject({ base64Image: 'data:image/png;base64,WIDE-NEW' })

		// What is drawn changes with the images, so is part of the cache key
		expect(sized.key).toBe('144x144@s:2,288x144@s:1,144x288@s:2')
	})

	it('releases its subscription when destroyed', () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)
		control.destroy()
		expect(linkButtons.removeTarget).toHaveBeenCalledWith(MY_CONTROL_ID)
	})
})
