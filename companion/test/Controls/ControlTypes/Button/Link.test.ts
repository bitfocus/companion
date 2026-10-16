import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinkButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ControlDependencies } from '../../../../lib/Controls/ControlDependencies.js'
import { ControlButtonLink } from '../../../../lib/Controls/ControlTypes/Button/Link.js'
import type { LinkButtonClient, LinkButtonState } from '../../../../lib/Link/ButtonClient.js'
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
	}
	let parseVariables: ReturnType<typeof vi.fn>

	beforeEach(() => {
		linkButtons = {
			setTarget: vi.fn(),
			removeTarget: vi.fn(),
			getState: vi.fn(() => undefined),
			press: vi.fn(),
			rotate: vi.fn(() => true),
		}

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
			graphics: new EventEmitter() as any,
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

	it('rejects invalid options', () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, null, false)
		expect(control.optionsSetField('peerId', 5)).toBe(false)
		expect(control.optionsSetField('location', 'nope')).toBe(false)
		expect(control.optionsSetField('other', 'x')).toBe(false)
	})

	it('resolves the location again when a variable it uses changes', () => {
		parseVariables.mockImplementation(() => ({ text: '3/0/0', variableIds: new Set(['custom:page']) }))
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '$(custom:page)/0/0'), false)
		linkButtons.setTarget.mockClear()

		control.drawing.onVariablesChanged(new Set(['custom:other']))
		expect(linkButtons.setTarget).not.toHaveBeenCalled()

		control.drawing.onVariablesChanged(new Set(['custom:page']))
		expect(linkButtons.setTarget).toHaveBeenCalled()
	})

	it('forwards presses and rotation with its id appended to the surface id', () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)

		control.pressControl(true, 'deck')
		expect(linkButtons.press).toHaveBeenCalledWith(MY_CONTROL_ID, true, mangleReferenceSurfaceId('deck', MY_CONTROL_ID))

		expect(control.rotateControl(2, 'deck')).toBe(true)
		expect(linkButtons.rotate).toHaveBeenCalledWith(MY_CONTROL_ID, 2, mangleReferenceSurfaceId('deck', MY_CONTROL_ID))
	})

	it('draws the remote image, or a placeholder', async () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)

		const placeholder = await control.drawing.getDrawStyle()
		expect(placeholder.elements.map((e) => e.type)).toEqual(['box', 'text'])

		const state: LinkButtonState = {
			status: 'ok',
			peerName: 'Peer',
			dataUrl: 'data:image/png;base64,AAAA',
			pressed: true,
			sourceChain: ['peer'],
		}
		linkButtons.getState.mockReturnValue(state)

		const style = await control.drawing.getDrawStyle()
		expect(style.pushed).toBe(true)
		expect(style.elements).toMatchObject([
			{ type: 'canvas', decoration: 'none' },
			{ type: 'image', base64Image: state.dataUrl },
		])
		expect(control.toRuntimeJSON()).toEqual({ status: 'ok', peerName: 'Peer' })
	})

	it('releases its subscription when destroyed', () => {
		const control = new ControlButtonLink(deps, MY_CONTROL_ID, makeModel('peer', '1/0/0'), false)
		control.destroy()
		expect(linkButtons.removeTarget).toHaveBeenCalledWith(MY_CONTROL_ID)
	})
})
