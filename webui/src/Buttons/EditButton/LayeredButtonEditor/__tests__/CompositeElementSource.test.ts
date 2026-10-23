import { describe, expect, test } from 'vitest'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CompositeElementDefinitionsStore } from '~/Stores/CompositeElementDefinitionsStore.js'
import { ConnectionsStore } from '~/Stores/ConnectionsStore.js'
import { getCompositeElementSource, getMissingCompositeElementReason } from '../CompositeElementSource.js'

function makeStores() {
	const definitions = new CompositeElementDefinitionsStore()
	definitions.updateStore({
		type: 'init',
		definitions: { conn1: { meter: { name: 'Meter', sortKey: null, options: [] } } },
	})

	const connections = new ConnectionsStore()
	connections.connections.set('conn1', { label: 'mixer' } as ClientConnectionConfig)

	return { definitions, connections }
}

function composite(connectionId: string, elementId: string): SomeButtonGraphicsElement {
	return { id: 'el1', name: '', type: 'composite', connectionId, elementId } as SomeButtonGraphicsElement
}

describe('getMissingCompositeElementReason', () => {
	test('a composite with a definition is not missing', () => {
		const { definitions, connections } = makeStores()
		expect(getMissingCompositeElementReason(composite('conn1', 'meter'), definitions, connections)).toBeNull()
	})

	test('a non-composite element is never missing', () => {
		const { definitions, connections } = makeStores()
		const text = { id: 'el1', name: '', type: 'text' } as SomeButtonGraphicsElement
		expect(getMissingCompositeElementReason(text, definitions, connections)).toBeNull()
	})

	test('names the connection when it no longer provides the element', () => {
		const { definitions, connections } = makeStores()
		expect(getMissingCompositeElementReason(composite('conn1', 'fader'), definitions, connections)).toBe(
			'Missing element: connection "mixer" does not provide "fader"'
		)
	})

	test('reports a connection that no longer exists', () => {
		const { definitions, connections } = makeStores()
		expect(getMissingCompositeElementReason(composite('gone', 'meter'), definitions, connections)).toBe(
			'Missing element: the connection it came from no longer exists'
		)
	})
})

describe('getCompositeElementSource', () => {
	test('names the connection and definition', () => {
		const { definitions, connections } = makeStores()
		expect(getCompositeElementSource(composite('conn1', 'meter'), definitions, connections)).toBe('mixer: Meter')
	})

	test('a non-composite element has no source', () => {
		const { definitions, connections } = makeStores()
		const text = { id: 'el1', name: '', type: 'text' } as SomeButtonGraphicsElement
		expect(getCompositeElementSource(text, definitions, connections)).toBeNull()
	})

	test('falls back to the element id when the definition is missing', () => {
		const { definitions, connections } = makeStores()
		expect(getCompositeElementSource(composite('conn1', 'fader'), definitions, connections)).toBe('mixer: fader')
	})

	test('falls back to the connection id when the connection is gone', () => {
		const { definitions, connections } = makeStores()
		expect(getCompositeElementSource(composite('gone', 'meter'), definitions, connections)).toBe('gone: meter')
	})
})
