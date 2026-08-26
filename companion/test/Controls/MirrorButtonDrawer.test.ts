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

	function makeDrawer(
		getTargetLocation: () => ControlLocation | null,
		referencedVariableIds: ReadonlySet<string> = new Set()
	): MirrorButtonDrawer {
		return new MirrorButtonDrawer(deps, 'bank:2-0-0', () => ({
			location: getTargetLocation(),
			referencedVariableIds,
		}))
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
		drawer.onButtonDrawn(TARGET_LOCATION, {} as any)
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

		drawer.onButtonDrawn({ pageNumber: 9, row: 9, column: 9 }, {} as any)
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()
	})

	it('cancels a queued redraw on dispose', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle()
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION)
		await drawer.getDrawStyle()

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		// Queue a redraw, then dispose before the debounce fires - it must be cancelled
		drawer.onButtonDrawn(TARGET_LOCATION, {} as any)
		drawer.dispose()
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()
	})

	it('redraws when a variable its location depends on changes', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle()
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION, new Set(['page:test']))
		await drawer.getDrawStyle()

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		drawer.onVariablesChanged(new Set(['page:test']))
		await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('bank:2-0-0'))
	})

	it('does not redraw when an unrelated variable changes', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle()
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION, new Set(['page:test']))
		await drawer.getDrawStyle()

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		drawer.onVariablesChanged(new Set(['page:other']))
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()
	})

	it('exposes the last computed style via getLastDrawStyle', async () => {
		const drawer = makeDrawer(() => null)
		expect(drawer.getLastDrawStyle()).toBeNull()

		const style = await drawer.getDrawStyle()
		expect(drawer.getLastDrawStyle()).toBe(style)
	})

	it('does not redraw on a variable change before the first draw', async () => {
		const drawer = makeDrawer(() => TARGET_LOCATION, new Set(['page:test']))

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		drawer.onVariablesChanged(new Set(['page:test']))
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()
	})

	it('does not redraw on a button_drawn before the first draw', async () => {
		const drawer = makeDrawer(() => TARGET_LOCATION)

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		drawer.onButtonDrawn(TARGET_LOCATION, {} as any)
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()
	})

	it('still tracks location variables when the target location is unresolved', async () => {
		const drawer = makeDrawer(() => null, new Set(['page:test']))
		const style = await drawer.getDrawStyle()
		expect(placeholderText(style)).toBe('Unresolved\nReference')

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		// No referenced location to listen for while unresolved...
		drawer.onButtonDrawn(TARGET_LOCATION, {} as any)
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()

		// ...but a change to the location expression's own variables must still redraw us
		drawer.onVariablesChanged(new Set(['page:test']))
		await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('bank:2-0-0'))
	})

	it('never redraws on variable changes when the location references no variables', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle()
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION) // empty referencedVariableIds
		await drawer.getDrawStyle()

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		drawer.onVariablesChanged(new Set(['page:test']))
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()
	})

	it('invalidates when a transitively-referenced location is drawn', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle(['3/0/0'])
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION)
		await drawer.getDrawStyle()

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		// '3/0/0' is a reference of the target, so it is part of our tracked set: a draw there must redraw us
		drawer.onButtonDrawn({ pageNumber: 3, row: 0, column: 0 }, {} as any)
		await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('bank:2-0-0'))
	})

	it('references just the target when the target has no references of its own', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle() // no referencedLocations
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION)
		const style = await drawer.getDrawStyle()

		expect([...(style.referencedLocations ?? [])]).toEqual([formatLocation(TARGET_LOCATION)])
	})

	it('returns a deep clone of the target style, isolated from the source', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle()
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION)
		const style = await drawer.getDrawStyle()

		// Mutating the mirror's output must not bleed back into the target's cached style
		;(style.elements[1] as any).text = 'mutated'
		expect((targetStyle.elements[1] as any).text).toBe('hello')
	})

	it('stops listening for the old target once re-targeted to an unresolved location', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle()
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		let target: ControlLocation | null = TARGET_LOCATION
		const drawer = makeDrawer(() => target)
		await drawer.getDrawStyle()

		// Re-point at nothing and redraw: the previous referenced location must no longer trigger us
		target = null
		await drawer.getDrawStyle()

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		drawer.onButtonDrawn(TARGET_LOCATION, {} as any)
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()
	})

	it('ignores composite element changes (a mirror owns no elements)', async () => {
		getControlIdAt.mockReturnValue('bank:1-0-0')
		const targetStyle = makeStyle()
		getControl.mockReturnValue({
			drawing: { getLastDrawStyle: () => targetStyle, getDrawStyle: async () => targetStyle },
		})

		const drawer = makeDrawer(() => TARGET_LOCATION)
		await drawer.getDrawStyle()

		const invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy)

		expect(() => drawer.onCompositeElementsChanged(new Set(['conn:elem']) as any)).not.toThrow()
		await new Promise((resolve) => setTimeout(resolve, 30))
		expect(invalidateSpy).not.toHaveBeenCalled()
	})
})
