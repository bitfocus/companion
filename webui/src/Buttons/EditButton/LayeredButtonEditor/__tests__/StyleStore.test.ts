import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { isElementDisabled, LayeredStyleStore, PINNED_PROPERTIES_ENTRY_ID } from '../StyleStore.js'

// jsdom runs on an opaque origin here, so window.localStorage is undefined. Install a minimal
// in-memory Storage so the store's persistence can be exercised directly.
class MemoryStorage {
	#m = new Map<string, string>()
	get length(): number {
		return this.#m.size
	}
	key(i: number): string | null {
		return Array.from(this.#m.keys())[i] ?? null
	}
	getItem(k: string): string | null {
		return this.#m.has(k) ? this.#m.get(k)! : null
	}
	setItem(k: string, v: string): void {
		this.#m.set(k, String(v))
	}
	removeItem(k: string): void {
		this.#m.delete(k)
	}
	clear(): void {
		this.#m.clear()
	}
}

const STORAGE_KEY = 'layeredEditor.lastSelectedElement'

beforeAll(() => {
	Object.defineProperty(window, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true })
})

beforeEach(() => {
	window.localStorage.clear()
})

// Minimal element stand-ins - the store only reads id/type/enabled/children.
function el(
	id: string,
	type: SomeButtonGraphicsElement['type'],
	children?: SomeButtonGraphicsElement[],
	enabled = true
): SomeButtonGraphicsElement {
	return {
		id,
		type,
		enabled: { isExpression: false, value: enabled },
		...(children ? { children } : {}),
	} as unknown as SomeButtonGraphicsElement
}

// An element whose `enabled` is an expression, which cannot be resolved here
function elExpressionEnabled(id: string, type: SomeButtonGraphicsElement['type']): SomeButtonGraphicsElement {
	return {
		id,
		type,
		enabled: { isExpression: true, value: '$(internal:time_s)' },
	} as unknown as SomeButtonGraphicsElement
}

// Minimal feedback stand-in for updateOverridesData - it only reads type/styleOverrides/children.
function feedback(
	styleOverrides: Array<{ elementId: string; elementProperty: string }>,
	children?: Record<string, SomeEntityModel[]>
): SomeEntityModel {
	return { type: EntityModelType.Feedback, styleOverrides, children } as unknown as SomeEntityModel
}
function action(): SomeEntityModel {
	return { type: EntityModelType.Action } as unknown as SomeEntityModel
}

const canvas = el('canvas', 'canvas')

// Data order is bottom-first (canvas at index 0), so the last entry is the topmost visual row.
const defaultLayers = [canvas, el('box0', 'box'), el('text0', 'text')]

describe('LayeredStyleStore updateData / findElementById', () => {
	test('exposes the elements it was given', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		expect(store.elements.map((e) => e.id)).toEqual(['canvas', 'box0', 'text0'])
	})

	test('replaces elements on subsequent updates', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.updateData([canvas, el('only', 'box')])
		expect(store.elements.map((e) => e.id)).toEqual(['canvas', 'only'])
	})

	test('findElementById finds top-level and nested elements', () => {
		const store = new LayeredStyleStore()
		store.updateData([canvas, el('grp', 'group', [el('child', 'text')]), el('top', 'box')])
		expect(store.findElementById('top')?.id).toBe('top')
		expect(store.findElementById('grp')?.type).toBe('group')
		expect(store.findElementById('child')?.id).toBe('child')
	})

	test('findElementById returns undefined for unknown ids', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		expect(store.findElementById('nope')).toBeUndefined()
	})
})

describe('LayeredStyleStore selection seeding', () => {
	test('new button with no stored preference selects the pinned view', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		expect(store.selectedEntryId).toBe(PINNED_PROPERTIES_ENTRY_ID)
		expect(store.isPinnedViewSelected).toBe(true)
		// The pinned view isn't an element, so nothing is selected for the preview/property panel
		expect(store.selectedElementId).toBe(null)
	})

	test('a button with only the canvas still selects the pinned view', () => {
		const store = new LayeredStyleStore()
		store.updateData([canvas])
		expect(store.selectedEntryId).toBe(PINNED_PROPERTIES_ENTRY_ID)
	})

	test('keeps a still-valid selection when data updates', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.setSelectedEntryId('box0')
		store.updateData(defaultLayers)
		expect(store.selectedElementId).toBe('box0')
	})

	test('keeps the pinned view selected when data updates', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.setSelectedEntryId(PINNED_PROPERTIES_ENTRY_ID)
		store.updateData([canvas, el('other', 'box')])
		expect(store.isPinnedViewSelected).toBe(true)
	})

	test('re-seeds when the selected element is deleted', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.setSelectedEntryId('box0')
		store.updateData([canvas, el('text0', 'text')]) // box removed
		expect(store.selectedEntryId).toBe(PINNED_PROPERTIES_ENTRY_ID)
	})
})

describe('LayeredStyleStore getSelectedElement', () => {
	test('returns the selected element', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.setSelectedEntryId('box0')
		expect(store.getSelectedElement()?.id).toBe('box0')
	})

	test('returns undefined when the pinned view is selected', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.setSelectedEntryId(PINNED_PROPERTIES_ENTRY_ID)
		expect(store.selectedElementId).toBe(null)
		expect(store.getSelectedElement()).toBeUndefined()
	})

	test('setSelectedEntryId(null) clears the selection', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.setSelectedEntryId(null)
		expect(store.selectedElementId).toBe(null)
		expect(store.getSelectedElement()).toBeUndefined()
	})
})

describe('LayeredStyleStore remembers by type + ordinal across buttons', () => {
	// visual (top-first) here is [img-b, img-a]: img-b is the 1st image, img-a is the 2nd.
	const twoImages = [canvas, el('img-a', 'image'), el('img-b', 'image')]

	test('restores the Nth element of the same type', () => {
		const first = new LayeredStyleStore()
		first.updateData(twoImages)
		first.setSelectedEntryId('img-a') // the 2nd image (ordinal 1)

		const next = new LayeredStyleStore()
		next.updateData([canvas, el('other-a', 'image'), el('other-b', 'image')])
		// 2nd image top-first is other-a
		expect(next.selectedElementId).toBe('other-a')
	})

	test('clamps down when the next button has fewer of that type', () => {
		const first = new LayeredStyleStore()
		first.updateData(twoImages)
		first.setSelectedEntryId('img-a') // 2nd image

		const next = new LayeredStyleStore()
		next.updateData([canvas, el('solo', 'image')]) // only one image
		expect(next.selectedElementId).toBe('solo')
	})

	test('falls back to the pinned view when the type is absent', () => {
		const first = new LayeredStyleStore()
		first.updateData(twoImages)
		first.setSelectedEntryId('img-a')

		const next = new LayeredStyleStore()
		next.updateData(defaultLayers) // no image elements
		expect(next.selectedEntryId).toBe(PINNED_PROPERTIES_ENTRY_ID)
	})

	test('remembers the pinned view, which every button has', () => {
		const first = new LayeredStyleStore()
		first.updateData(defaultLayers)
		first.setSelectedEntryId(PINNED_PROPERTIES_ENTRY_ID)
		expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({
			type: PINNED_PROPERTIES_ENTRY_ID,
			ordinal: 0,
		})

		const next = new LayeredStyleStore()
		next.updateData(twoImages) // a button with entirely different elements
		expect(next.isPinnedViewSelected).toBe(true)
	})

	test('remembers a canvas selection', () => {
		const first = new LayeredStyleStore()
		first.updateData(defaultLayers)
		first.setSelectedEntryId('canvas')

		const next = new LayeredStyleStore()
		next.updateData(defaultLayers)
		expect(next.selectedElementId).toBe('canvas')
	})

	test('counts ordinals across group children in visual order', () => {
		// data order: [canvas, box, group(children: [imgInner]), imgTop]
		// visual top-first: [imgTop (image #1), group, imgInner (image #2), box]
		const grouped = [canvas, el('box', 'box'), el('grp', 'group', [el('imgInner', 'image')]), el('imgTop', 'image')]
		const first = new LayeredStyleStore()
		first.updateData(grouped)
		first.setSelectedEntryId('imgInner') // 2nd image

		const next = new LayeredStyleStore()
		next.updateData(grouped)
		expect(next.selectedElementId).toBe('imgInner')
	})

	test('persists the reference to localStorage', () => {
		const store = new LayeredStyleStore()
		store.updateData(twoImages)
		store.setSelectedEntryId('img-a') // 2nd image (ordinal 1)
		expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ type: 'image', ordinal: 1 })
	})

	test('a corrupt stored reference is ignored and falls back to the pinned view', () => {
		window.localStorage.setItem(STORAGE_KEY, 'not json{')
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		expect(store.selectedEntryId).toBe(PINNED_PROPERTIES_ENTRY_ID)
	})
})

describe('LayeredStyleStore visualElements', () => {
	test('lists elements top-first, each group above its own children, without the canvas', () => {
		const store = new LayeredStyleStore()
		store.updateData([canvas, el('box', 'box'), el('grp', 'group', [el('inner', 'text')]), el('top', 'image')])
		expect(store.visualElements.map((entry) => entry.element.id)).toEqual(['top', 'grp', 'inner', 'box'])
	})

	test('marks children of a disabled group as disabled by an ancestor', () => {
		const store = new LayeredStyleStore()
		store.updateData([canvas, el('grp', 'group', [el('inner', 'text')], false), el('top', 'image')])
		expect(store.visualElements.map((entry) => [entry.element.id, entry.ancestorDisabled])).toEqual([
			['top', false],
			['grp', false],
			['inner', true],
		])
	})
})

describe('LayeredStyleStore element visibility', () => {
	test('elements are visible by default', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		expect(store.isElementVisible('text0')).toBe(true)
		expect(store.hiddenElements.size).toBe(0)
	})

	test('setElementVisibility(id, false) hides and (id, true) shows', () => {
		const store = new LayeredStyleStore()
		store.setElementVisibility('text0', false)
		expect(store.isElementVisible('text0')).toBe(false)
		expect(store.hiddenElements).toEqual(new Set(['text0']))

		store.setElementVisibility('text0', true)
		expect(store.isElementVisible('text0')).toBe(true)
		expect(store.hiddenElements.size).toBe(0)
	})

	test('setElementVisibility(id) toggles', () => {
		const store = new LayeredStyleStore()
		store.setElementVisibility('box0')
		expect(store.isElementVisible('box0')).toBe(false)
		store.setElementVisibility('box0')
		expect(store.isElementVisible('box0')).toBe(true)
	})

	test('tracks visibility of several elements independently', () => {
		const store = new LayeredStyleStore()
		store.setElementVisibility('a', false)
		store.setElementVisibility('b', false)
		expect(store.hiddenElements).toEqual(new Set(['a', 'b']))
		expect(store.isElementVisible('c')).toBe(true)
	})
})

describe('LayeredStyleStore feedback style overrides', () => {
	test('marks overridden element properties', () => {
		const store = new LayeredStyleStore()
		store.updateOverridesData([feedback([{ elementId: 'text0', elementProperty: 'color' }])])
		expect(store.isPropertyOverridden('text0', 'color')).toBe(true)
		expect(store.isPropertyOverridden('text0', 'text')).toBe(false)
		expect(store.isPropertyOverridden('box0', 'color')).toBe(false)
	})

	test('aggregates overrides from multiple feedbacks and ignores non-feedback entities', () => {
		const store = new LayeredStyleStore()
		store.updateOverridesData([
			feedback([{ elementId: 'text0', elementProperty: 'color' }]),
			action(),
			feedback([{ elementId: 'box0', elementProperty: 'color' }]),
		])
		expect(store.isPropertyOverridden('text0', 'color')).toBe(true)
		expect(store.isPropertyOverridden('box0', 'color')).toBe(true)
	})

	test('replaces the override set on each update', () => {
		const store = new LayeredStyleStore()
		store.updateOverridesData([feedback([{ elementId: 'text0', elementProperty: 'color' }])])
		store.updateOverridesData([feedback([{ elementId: 'box0', elementProperty: 'color' }])])
		expect(store.isPropertyOverridden('text0', 'color')).toBe(false)
		expect(store.isPropertyOverridden('box0', 'color')).toBe(true)
	})

	test('handles feedbacks without styleOverrides', () => {
		const store = new LayeredStyleStore()
		store.updateOverridesData([feedback([]), { type: EntityModelType.Feedback } as unknown as SomeEntityModel])
		expect(store.isPropertyOverridden('text0', 'color')).toBe(false)
	})
})

describe('LayeredStyleStore selectableElementIds', () => {
	test('collects every element including the canvas and nested children', () => {
		const store = new LayeredStyleStore()
		store.updateData([canvas, el('box0', 'box'), el('grp', 'group', [el('inner', 'text'), el('deep', 'group', [])])])
		expect(store.selectableElementIds).toEqual(new Set(['canvas', 'box0', 'grp', 'inner', 'deep']))
	})

	test('is empty for a button with no elements', () => {
		const store = new LayeredStyleStore()
		store.updateData([])
		expect(store.selectableElementIds.size).toBe(0)
	})

	test('follows the data it is given', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.updateData([canvas, el('only', 'image')])
		expect(store.selectableElementIds).toEqual(new Set(['canvas', 'only']))
	})
})

describe('isElementDisabled', () => {
	test('an element switched off is disabled', () => {
		expect(isElementDisabled(el('a', 'text', undefined, false))).toBe(true)
	})

	test('an element switched on is not', () => {
		expect(isElementDisabled(el('a', 'text'))).toBe(false)
	})

	test('an expression cannot be resolved here, so it counts as on', () => {
		expect(isElementDisabled(elExpressionEnabled('a', 'text'))).toBe(false)
	})

	test('the canvas has no enabled state and is never disabled', () => {
		expect(isElementDisabled(canvas)).toBe(false)
	})
})

describe('LayeredStyleStore visualElements nesting', () => {
	test('carries a disabled ancestor down through several levels', () => {
		const store = new LayeredStyleStore()
		store.updateData([
			canvas,
			el('outer', 'group', [el('mid', 'group', [el('leaf', 'text')])], false), // outer is switched off
		])
		expect(store.visualElements.map((entry) => [entry.element.id, entry.ancestorDisabled])).toEqual([
			['outer', false], // its own disabled state is not an *ancestor's*
			['mid', true],
			['leaf', true],
		])
	})

	test('a disabled child does not mark its own siblings or itself', () => {
		const store = new LayeredStyleStore()
		store.updateData([canvas, el('grp', 'group', [el('off', 'text', undefined, false), el('on', 'text')])])
		expect(store.visualElements.map((entry) => [entry.element.id, entry.ancestorDisabled])).toEqual([
			['grp', false],
			['on', false], // children render top-first, mirroring the layer list
			['off', false],
		])
	})

	test('is empty when the button has only the canvas', () => {
		const store = new LayeredStyleStore()
		store.updateData([canvas])
		expect(store.visualElements).toEqual([])
	})
})

describe('LayeredStyleStore selection persistence edge cases', () => {
	test('selecting an unknown id leaves the remembered reference untouched', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.setSelectedEntryId('box0')
		store.setSelectedEntryId('nope')

		expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ type: 'box', ordinal: 0 })
	})

	test('clearing the selection does not write a reference', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.setSelectedEntryId(null)
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(null)
	})

	test('the canvas is remembered without an ordinal of its own', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.setSelectedEntryId('canvas')
		expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ type: 'canvas', ordinal: 0 })
	})

	test('an element inside a group is remembered by its place in the visual order', () => {
		// visual top-first: [imgTop (image #1), grp, imgInner (image #2)]
		const grouped = [canvas, el('grp', 'group', [el('imgInner', 'image')]), el('imgTop', 'image')]
		const store = new LayeredStyleStore()
		store.updateData(grouped)
		store.setSelectedEntryId('imgInner')
		expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ type: 'image', ordinal: 1 })
	})

	test('a remembered canvas falls back to the pinned view on a button without one', () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ type: 'canvas', ordinal: 0 }))
		const store = new LayeredStyleStore()
		store.updateData([el('text0', 'text')]) // no canvas
		expect(store.selectedEntryId).toBe(PINNED_PROPERTIES_ENTRY_ID)
	})

	test('a stored ordinal of 0 selects the topmost of that type', () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ type: 'image', ordinal: 0 }))
		const store = new LayeredStyleStore()
		store.updateData([canvas, el('img-a', 'image'), el('img-b', 'image')])
		expect(store.selectedElementId).toBe('img-b') // data order is bottom-first, so img-b is on top
	})

	test.each([
		['a value of the wrong shape', JSON.stringify({ type: 5, ordinal: 0 })],
		['a negative ordinal', JSON.stringify({ type: 'text', ordinal: -1 })],
		['a fractional ordinal', JSON.stringify({ type: 'text', ordinal: 1.5 })],
		['a missing ordinal', JSON.stringify({ type: 'text' })],
		['an array', JSON.stringify(['text', 0])],
		['a bare null', JSON.stringify(null)],
	])('ignores %s and falls back to the pinned view', (_label, stored) => {
		window.localStorage.setItem(STORAGE_KEY, stored)
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		expect(store.selectedEntryId).toBe(PINNED_PROPERTIES_ENTRY_ID)
	})

	test('re-seeds from the remembered reference when the selected element goes away', () => {
		const store = new LayeredStyleStore()
		store.updateData([canvas, el('img-a', 'image'), el('box0', 'box')])
		store.setSelectedEntryId('img-a') // remembers { image, 0 }

		// That image is gone on the next update, so the reference picks the image which replaced it
		store.updateData([canvas, el('img-b', 'image')])
		expect(store.selectedElementId).toBe('img-b')
	})

	test('re-seeds to the pinned view when nothing matches the remembered reference', () => {
		const store = new LayeredStyleStore()
		store.updateData([canvas, el('img-a', 'image'), el('box0', 'box')])
		store.setSelectedEntryId('box0') // the last selection is the one remembered

		store.updateData([canvas, el('img-b', 'image')]) // no box on this button
		expect(store.selectedEntryId).toBe(PINNED_PROPERTIES_ENTRY_ID)
	})
})

describe('LayeredStyleStore selection of nested elements', () => {
	const grouped = [canvas, el('grp', 'group', [el('inner', 'text')])]

	test('a nested element can be selected and read back', () => {
		const store = new LayeredStyleStore()
		store.updateData(grouped)
		store.setSelectedEntryId('inner')
		expect(store.getSelectedElement()?.id).toBe('inner')
	})

	test('a nested selection survives a data update that keeps it', () => {
		const store = new LayeredStyleStore()
		store.updateData(grouped)
		store.setSelectedEntryId('inner')
		store.updateData([canvas, el('grp', 'group', [el('inner', 'text'), el('other', 'box')])])
		expect(store.selectedElementId).toBe('inner')
	})
})

describe('LayeredStyleStore hiddenElements', () => {
	test('is a plain copy: mutating it does not change the store', () => {
		const store = new LayeredStyleStore()
		store.setElementVisibility('text0', false)

		const hidden = store.hiddenElements
		hidden.add('box0')

		expect(store.isElementVisible('box0')).toBe(true)
		expect(store.hiddenElements).toEqual(new Set(['text0']))
	})

	test('visibility is remembered across data updates', () => {
		const store = new LayeredStyleStore()
		store.updateData(defaultLayers)
		store.setElementVisibility('text0', false)
		store.updateData(defaultLayers)
		expect(store.isElementVisible('text0')).toBe(false)
	})
})

describe('LayeredStyleStore feedback overrides from nested feedbacks', () => {
	test('marks properties overridden by a feedback nested in another', () => {
		const store = new LayeredStyleStore()
		store.updateOverridesData([
			feedback([{ elementId: 'text0', elementProperty: 'color' }], {
				feedbacks: [feedback([{ elementId: 'box0', elementProperty: 'color' }])],
			}),
		])
		expect(store.isPropertyOverridden('text0', 'color')).toBe(true)
		expect(store.isPropertyOverridden('box0', 'color')).toBe(true)
	})

	test('descends through several levels of nesting', () => {
		const store = new LayeredStyleStore()
		store.updateOverridesData([
			feedback([], {
				feedbacks: [feedback([], { feedbacks: [feedback([{ elementId: 'text0', elementProperty: 'text' }])] })],
			}),
		])
		expect(store.isPropertyOverridden('text0', 'text')).toBe(true)
	})

	test('ignores non-feedback children', () => {
		const store = new LayeredStyleStore()
		store.updateOverridesData([feedback([], { children: [action()] })])
		expect(store.isPropertyOverridden('text0', 'color')).toBe(false)
	})
})
