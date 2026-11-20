import { describe, expect, test, vi } from 'vitest'
import type { QuarantinedRender } from '@companion-app/shared/Model/RenderStall.js'
import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { makeReferencePlaceholder } from '../../lib/Graphics/ConvertGraphicsElements.js'
import {
	CachedRenderQuarantineStore,
	RenderQuarantine,
	renderQuarantineKey,
	type CachedRenderQuarantine,
	type RenderQuarantineStore,
} from '../../lib/Graphics/RenderQuarantine.js'

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
	return {
		key: renderQuarantineKey(drawStyle),
		location: { pageNumber: 1, row: 0, column: 0 },
		description: 'button 1/0/0',
		texts: [],
		time: 1000,
	}
}

function makeStore(initial: QuarantinedRender[] = []): RenderQuarantineStore & { saved: QuarantinedRender[][] } {
	const saved: QuarantinedRender[][] = []
	return { saved, load: () => initial, save: (entries) => saved.push(entries) }
}

function makeCacheTable(initial: CachedRenderQuarantine | undefined) {
	let value = initial
	return {
		get: () => value as any,
		set: (_id: string, newValue: any) => {
			value = newValue
			return true
		},
		value: () => value,
	}
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
		const quarantine = new RenderQuarantine(makeStore())
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
		const quarantine = new RenderQuarantine(makeStore())
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
		const quarantine = new RenderQuarantine(makeStore())
		const stalled = makeDrawStyle('a', true)
		quarantine.add(makeEntry(stalled))

		const applied = quarantine.apply(stalled)

		expect(applied).toEqual({ ...stalled, elements: makeReferencePlaceholder('render-stalled', 'Draw\nstalled') })
	})

	test('leaves other draws alone', () => {
		const quarantine = new RenderQuarantine(makeStore())
		quarantine.add(makeEntry(makeDrawStyle('a')))

		const other = makeDrawStyle('b')
		expect(quarantine.apply(other)).toBe(other)
	})
})

describe('RenderQuarantine persistence', () => {
	test('loads what was quarantined before', () => {
		const entry = makeEntry(makeDrawStyle('a'))
		const quarantine = new RenderQuarantine(makeStore([entry]))

		expect(quarantine.has(entry.key)).toBe(true)
	})

	test('saves each change', () => {
		const store = makeStore()
		const quarantine = new RenderQuarantine(store)
		const entry = makeEntry(makeDrawStyle('a'))

		quarantine.add(entry)
		quarantine.add(entry)
		quarantine.remove(entry.key)

		expect(store.saved).toEqual([[entry], []])
	})
})

describe('CachedRenderQuarantineStore', () => {
	const entry = makeEntry(makeDrawStyle('a'))

	test('loads what was saved by the same build', () => {
		const table = makeCacheTable({ build: '5.2.0+1', entries: [entry] })

		expect(new CachedRenderQuarantineStore(table, '5.2.0+1').load()).toEqual([entry])
	})

	test('discards what was saved by another build', () => {
		const table = makeCacheTable({ build: '5.2.0+1', entries: [entry] })

		expect(new CachedRenderQuarantineStore(table, '5.2.0+2').load()).toEqual([])
	})

	test('loads nothing when nothing was saved', () => {
		expect(new CachedRenderQuarantineStore(makeCacheTable(undefined), '5.2.0+1').load()).toEqual([])
	})

	test('saves with the build', () => {
		const table = makeCacheTable(undefined)
		new CachedRenderQuarantineStore(table, '5.2.0+1').save([entry])

		expect(table.value()).toEqual({ build: '5.2.0+1', entries: [entry] })
	})
})
