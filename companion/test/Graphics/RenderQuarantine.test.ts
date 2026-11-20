import { describe, expect, test, vi } from 'vitest'
import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { makeReferencePlaceholder } from '../../lib/Graphics/ConvertGraphicsElements.js'
import { RenderQuarantine, renderQuarantineKey, type QuarantinedRender } from '../../lib/Graphics/RenderQuarantine.js'

function makeDrawStyle(text: string, pushed = false): DrawStyleLayeredButtonModel {
	return {
		style: 'button-layered',
		drawType: 'button',
		elements: makeReferencePlaceholder('el', text),
		pushed,
		stepCurrent: 1,
		stepCount: 1,
		button_status: undefined,
		action_running: false,
	}
}

function makeEntry(drawStyle: DrawStyleLayeredButtonModel): QuarantinedRender {
	return { key: renderQuarantineKey(drawStyle), description: 'button 1/0/0', texts: [], time: 1000 }
}

describe('renderQuarantineKey', () => {
	test('is the same for the same content, in any state', () => {
		expect(renderQuarantineKey(makeDrawStyle('a', true))).toBe(renderQuarantineKey(makeDrawStyle('a', false)))
	})

	test('differs for different content', () => {
		expect(renderQuarantineKey(makeDrawStyle('a'))).not.toBe(renderQuarantineKey(makeDrawStyle('b')))
	})
})

describe('RenderQuarantine', () => {
	test('adds each draw once', () => {
		const quarantine = new RenderQuarantine()
		const changed = vi.fn()
		quarantine.on('changed', changed)

		const entry = makeEntry(makeDrawStyle('a'))
		expect(quarantine.add(entry)).toBe(true)
		expect(quarantine.add({ ...entry, description: 'button 1/0/1' })).toBe(false)

		expect(quarantine.has(entry.key)).toBe(true)
		expect(quarantine.list()).toEqual([entry])
		expect(changed).toHaveBeenCalledTimes(1)
	})

	test('removes a draw', () => {
		const quarantine = new RenderQuarantine()
		const entry = makeEntry(makeDrawStyle('a'))
		quarantine.add(entry)

		const changed = vi.fn()
		quarantine.on('changed', changed)

		expect(quarantine.remove(entry.key)).toBe(true)
		expect(quarantine.remove(entry.key)).toBe(false)

		expect(quarantine.has(entry.key)).toBe(false)
		expect(quarantine.list()).toEqual([])
		expect(changed).toHaveBeenCalledTimes(1)
	})

	test('replaces the elements of a quarantined draw with a placeholder', () => {
		const quarantine = new RenderQuarantine()
		const stalled = makeDrawStyle('a', true)
		quarantine.add(makeEntry(stalled))

		const applied = quarantine.apply(stalled)

		expect(applied).toEqual({ ...stalled, elements: makeReferencePlaceholder('render-stalled', 'Draw\nstalled') })
	})

	test('leaves other draws alone', () => {
		const quarantine = new RenderQuarantine()
		quarantine.add(makeEntry(makeDrawStyle('a')))

		const other = makeDrawStyle('b')
		expect(quarantine.apply(other)).toBe(other)
	})
})
