import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CreateElementOfType } from '../../lib/Controls/ControlTypes/Button/LayerDefaults.js'
import { LayeredButtonStyleEditor } from '../../lib/Controls/ControlTypes/Button/LayeredButtonStyleEditor.js'

// The element conversion is heavy and irrelevant to the editing operations under test
vi.mock('../../lib/Graphics/ConvertGraphicsElements.js', () => ({
	ConvertSomeButtonGraphicsElementForDrawing: vi.fn(),
}))

const CONTROL_ID = 'bank:1-0-0'

function canvasElement(): SomeButtonGraphicsElement {
	return {
		id: 'canvas',
		name: 'Canvas',
		type: 'canvas',
		usage: 'automatic',
		decoration: { isExpression: false, value: 'default' },
		showStatusIcons: { isExpression: false, value: 'default' },
	} as unknown as SomeButtonGraphicsElement
}

describe('LayeredButtonStyleEditor pinned properties', () => {
	let editor: LayeredButtonStyleEditor
	let commitChange: ReturnType<typeof vi.fn>

	function elementById(id: string): any {
		return editor.drawElements.find((element) => element.id === id)
	}

	beforeEach(() => {
		const events = new EventEmitter()
		const deps: any = {
			events,
			pageStore: { getLocationOfControlId: vi.fn(() => undefined) },
			variableValues: { createVariablesAndExpressionParser: vi.fn(() => ({})) },
			getPageVariableEntities: vi.fn(() => ({})),
			instance: { definitions: {} },
			graphics: { renderPixelBuffers: vi.fn(), getCachedRender: vi.fn(() => undefined) },
		}

		commitChange = vi.fn()
		const host: any = {
			getButtonStateProps: () => ({}),
			entities: null,
			commitChange,
			emitElementChanged: vi.fn(),
		}

		editor = new LayeredButtonStyleEditor(deps, CONTROL_ID, host)

		const text = { ...CreateElementOfType('text'), id: 'text0' }
		const box = { ...CreateElementOfType('box'), id: 'box0' }
		const group = {
			...CreateElementOfType('group'),
			id: 'group0',
			children: [{ ...CreateElementOfType('text'), id: 'inner' }],
		}
		editor.loadElements([canvasElement(), box, group, text] as SomeButtonGraphicsElement[])
	})

	it('gives a newly created element the defaults for its type', () => {
		expect(elementById('text0').pinnedProperties).toEqual([
			'text',
			'fontsize',
			'fontsizeAllowShrink',
			'color',
			'halign',
			'valign',
		])
		expect(elementById('box0').pinnedProperties).toEqual(['color'])
	})

	it('pins a property that was not pinned', () => {
		expect(editor.setElementPropertyPinned('text0', 'weight', true)).toBe(true)
		expect(elementById('text0').pinnedProperties).toContain('weight')
		expect(commitChange).toHaveBeenCalledWith(false) // pins are editor-only, so nothing to redraw
	})

	it('unpins a pinned property', () => {
		expect(editor.setElementPropertyPinned('text0', 'color', false)).toBe(true)
		expect(elementById('text0').pinnedProperties).not.toContain('color')
	})

	it('reports no change when the property is already in the requested state', () => {
		expect(editor.setElementPropertyPinned('text0', 'color', true)).toBe(false)
		expect(editor.setElementPropertyPinned('text0', 'weight', false)).toBe(false)
		expect(commitChange).not.toHaveBeenCalled()
	})

	it('pins a property of an element nested in a group', () => {
		expect(editor.setElementPropertyPinned('inner', 'weight', true)).toBe(true)
		expect(elementById('group0').children[0].pinnedProperties).toContain('weight')
	})

	it('refuses to pin canvas properties, which are button-level', () => {
		expect(editor.setElementPropertyPinned('canvas', 'decoration', true)).toBe(false)
		expect(elementById('canvas').pinnedProperties).toBeUndefined()
	})

	it('ignores an unknown element', () => {
		expect(editor.setElementPropertyPinned('nope', 'color', true)).toBe(false)
	})

	it('resets every element, including nested ones, to its type defaults', () => {
		editor.setElementPropertyPinned('text0', 'color', false)
		editor.setElementPropertyPinned('box0', 'cornerRadius', true)
		editor.setElementPropertyPinned('inner', 'weight', true)

		expect(editor.resetPinnedProperties()).toBe(true)

		expect(elementById('text0').pinnedProperties).toContain('color')
		expect(elementById('box0').pinnedProperties).toEqual(['color'])
		expect(elementById('group0').children[0].pinnedProperties).not.toContain('weight')
	})

	it('will not let the generic option setters overwrite the pins', () => {
		expect(editor.updateOption('text0', 'pinnedProperties', { isExpression: false, value: [] })).toBe(false)
		expect(elementById('text0').pinnedProperties).toContain('text')
	})
})
