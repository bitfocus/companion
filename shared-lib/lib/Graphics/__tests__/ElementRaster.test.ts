import { describe, expect, test } from 'vitest'
import type { SomeButtonGraphicsDrawElement } from '../../Model/StyleLayersModel.js'
import { pruneElementsToTarget } from '../ElementRaster.js'

function el(id: string, type: string, extra: Record<string, unknown> = {}): SomeButtonGraphicsDrawElement {
	return { id, type, opacity: 0.5, ...extra } as unknown as SomeButtonGraphicsDrawElement
}

describe('pruneElementsToTarget', () => {
	test('a top-level element', () => {
		const target = el('b', 'text')
		expect(pruneElementsToTarget([el('a', 'box'), target, el('c', 'box')], 'b')).toEqual([{ ...target, opacity: 1 }])
	})

	test('keeps only the path to a nested element, resetting the opacity of it and its parents', () => {
		const target = el('t', 'text')
		const elements = [
			el('a', 'box'),
			el('g1', 'group', {
				rotation: 10,
				children: [el('b', 'box'), el('g2', 'group', { children: [{ ...target, opacity: 1 }] })],
			}),
			el('c', 'box'),
		]

		expect(pruneElementsToTarget(elements, 't')).toEqual([
			el('g1', 'group', {
				rotation: 10,
				opacity: 1,
				children: [el('g2', 'group', { opacity: 1, children: [{ ...target, opacity: 1 }] })],
			}),
		])
	})

	test('an element drawn by a reference, keeping the reference as its parent', () => {
		const target = el('remote-text', 'text')
		const elements = [el('r', 'reference', { x: 0.5, children: [el('remote-box', 'box'), target] })]

		expect(pruneElementsToTarget(elements, 'remote-text')).toEqual([
			el('r', 'reference', { x: 0.5, opacity: 1, children: [{ ...target, opacity: 1 }] }),
		])
	})

	test('null when the element is missing', () => {
		expect(pruneElementsToTarget([el('a', 'box'), el('g', 'group', { children: [] })], 'missing')).toBeNull()
	})
})
