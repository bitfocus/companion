import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { MirrorButtonDrawer } from '../../lib/Controls/ControlTypes/Button/MirrorButtonDrawer.js'

const MY_LOCATION: ControlLocation = { pageNumber: 2, row: 0, column: 0 }
const TARGET_LOCATION: ControlLocation = { pageNumber: 1, row: 0, column: 0 }

function makeStyle(referencedLocations?: string[]): DrawStyleLayeredButtonModel {
	return {
		pushed: false,
		stepCurrent: 0,
		stepCount: 0,
		button_status: undefined,
		action_running: undefined,
		elements: [{ id: 'canvas', type: 'canvas' } as any, { id: 'text0', type: 'text', text: 'hello' } as any],
		referencedLocations: referencedLocations ? new Set(referencedLocations) : undefined,
		style: 'button-layered',
		drawType: 'button',
	}
}

/** The text of the placeholder rendered for unresolved/cyclic references. */
function placeholderText(style: DrawStyleLayeredButtonModel): string | undefined {
	const textEl = style.elements.find((el) => el.type === 'text') as { text?: string } | undefined
	return textEl?.text
}

describe('MirrorButtonDrawer', () => {
	let graphics: EventEmitter
	let events: EventEmitter
	let getControl: ReturnType<typeof vi.fn>
	let getControlIdAt: ReturnType<typeof vi.fn>
	let deps: any

	beforeEach(() => {
		graphics = new EventEmitter()
		events = new EventEmitter()
		getControl = vi.fn(() => undefined)
		getControlIdAt = vi.fn(() => undefined)

		deps = {
			graphics,
			events,
			pageStore: {
				getLocationOfControlId: vi.fn(() => MY_LOCATION),
				getControlIdAt,
			},
			controlsAccessor: { getControl },
		}
	})

	function makeDrawer(getTargetLocation: () => ControlLocation | null): MirrorButtonDrawer {
		return new MirrorButtonDrawer(deps, 'bank:2-0-0', getTargetLocation)
	}

	it('renders an unresolved placeholder when there is no target location', async () => {
		const drawer = makeDrawer(() => null)
		const style = await drawer.getDrawStyle()
		expect(placeholderText(style)).toBe('Unresolved\nReference')
	})

	it('renders an unresolved placeholder when the target control is missing', async () => {
		getControlIdAt.mockReturnValue(undefined)
		const drawer = makeDrawer(() => TARGET_LOCATION)
		const style = await drawer.getDrawStyle()
		expect(placeholderText(style)).toBe('Unresolved\nReference')
	})

	it('renders a cycle placeholder for a direct self-reference', async () => {
		const drawer = makeDrawer(() => MY_LOCATION)
		const style = await drawer.getDrawStyle()
		expect(placeholderText(style)).toBe('∞')
	})

	it('mirrors the target style and merges referenced locations', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle(['3/0/0'])
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION)
		const style = await drawer.getDrawStyle()

		// Mirrors the target's elements
		expect(style.elements.map((el) => el.type)).toEqual(['canvas', 'text'])
		// Tracks the target + its transitive references, so it redraws when either changes
		expect([...(style.referencedLocations ?? [])].sort()).toEqual([formatLocation(TARGET_LOCATION), '3/0/0'].sort())
	})

	it('shows a placeholder while the target has not drawn yet, without calling its getDrawStyle', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const getDrawStyle = vi.fn(async () => makeStyle())
		getControl.mockReturnValue({ drawing: { getLastDrawStyle: () => null, getDrawStyle } })

		const drawer = makeDrawer(() => TARGET_LOCATION)
		const style = await drawer.getDrawStyle()

		// It waits for the target's imminent render rather than forcing a (recursion-prone) fresh compute
		expect(getDrawStyle).not.toHaveBeenCalled()
		expect(placeholderText(style)).toBe('Unresolved\nReference')
	})

	it('shows a cycle placeholder when the target references us back', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		// The target's cached style references this control's own location (an A -> B -> A cycle)
		const targetStyle = makeStyle([formatLocation(MY_LOCATION)])
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION)
		const style = await drawer.getDrawStyle()

		expect(placeholderText(style)).toBe('∞')
	})

	it('invalidates when a referenced location is drawn', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle()
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION)
		await drawer.getDrawStyle()

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		// A draw at the mirrored location should schedule a redraw
		graphics.emit('button_drawn', TARGET_LOCATION, {} as any)
		await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('bank:2-0-0'))
	})

	it('does not invalidate when an unrelated location is drawn', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle()
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION)
		await drawer.getDrawStyle()

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		graphics.emit('button_drawn', { pageNumber: 9, row: 9, column: 9 }, {} as any)
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()
	})

	it('stops redrawing after dispose', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle()
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION)
		await drawer.getDrawStyle()

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		drawer.dispose()
		graphics.emit('button_drawn', TARGET_LOCATION, {} as any)
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()
	})

	it('exposes the last computed style via getLastDrawStyle', async () => {
		const drawer = makeDrawer(() => null)
		expect(drawer.getLastDrawStyle()).toBeNull()

		const style = await drawer.getDrawStyle()
		expect(drawer.getLastDrawStyle()).toBe(style)
	})
})
