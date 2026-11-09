import { describe, expect, it } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { FuzzyProduct } from '~/Hooks/useFilteredProducts.js'
import {
	formatModuleProduct,
	getModuleProductEntries,
	getModuleProductName,
	getModuleProducts,
	groupModuleCatalog,
} from '../ModuleCatalog.js'

function product(
	moduleId: string,
	manufacturer: string | null,
	products: string[],
	matchedProduct = products[0]
): FuzzyProduct {
	return {
		moduleType: ModuleInstanceType.Connection,
		moduleId,
		name: moduleId,
		manufacturer,
		product: matchedProduct ?? moduleId,
		label: matchedProduct ?? moduleId,
		installedInfo: null,
		storeInfo: {
			id: moduleId,
			name: moduleId,
			shortname: moduleId,
			manufacturer,
			products,
			keywords: [],
			storeUrl: '',
			githubUrl: null,
			helpUrl: null,
			legacyIds: [],
			deprecationReason: null,
		},
		shortname: moduleId,
		keywords: '',
		bugUrl: undefined,
		helpUrl: undefined,
	}
}

describe('shared module catalog', () => {
	it('groups manufacturers case-insensitively and puts modules without one last', () => {
		const groups = groupModuleCatalog(
			[
				product('generic', null, ['Generic TCP']),
				product('sony-b', 'Sony', ['Z']),
				product('sony-a', 'SONY', ['A']),
				product('atem', 'Blackmagic Design', ['ATEM']),
			],
			false
		)
		expect(groups.map(([key]) => key)).toEqual(['blackmagic design', 'sony', 'other'])
		expect(groups[1][1].modules.map((module) => module.moduleId)).toEqual(['sony-a', 'sony-b'])
	})

	it('groups by the manufacturer field, not the module name', () => {
		const groups = groupModuleCatalog([product('Elgato Stream Deck', 'Elgato', ['Stream Deck'])], false)
		expect(groups.map(([key]) => key)).toEqual(['elgato'])
	})

	it('keeps the best product match and search order within a manufacturer', () => {
		const best = product('atem', 'Blackmagic Design', ['ATEM Mini', 'ATEM Television Studio'], 'ATEM Mini')
		const groups = groupModuleCatalog(
			[
				best,
				product('atem', 'Blackmagic Design', ['ATEM Mini', 'ATEM Television Studio'], 'ATEM Television Studio'),
				product('audio', 'Blackmagic Design', ['Audio']),
			],
			true
		)
		expect(groups[0][1].modules).toEqual([best, expect.objectContaining({ moduleId: 'audio' })])
	})

	it('orders groups by their best search match when searching', () => {
		const groups = groupModuleCatalog(
			[
				product('vmix', 'StudioCoast', ['vMix']),
				product('generic', null, ['Generic vMix thing']),
				product('atem', 'Blackmagic Design', ['ATEM vMix bridge']),
				product('vmix-2', 'StudioCoast', ['vMix 2']),
			],
			true
		)
		expect(groups.map(([key]) => key)).toEqual(['studiocoast', 'other', 'blackmagic design'])
		expect(groups[0][1].modules.map((module) => module.moduleId)).toEqual(['vmix', 'vmix-2'])
	})

	it('titles a module by its products, or its name when it declares none', () => {
		expect(getModuleProductName(product('atem', 'Blackmagic Design', ['ATEM Mini', 'ATEM 2']))).toBe(
			'ATEM Mini; ATEM 2'
		)
		expect(getModuleProductName(product('generic-tcp', 'Generic', []))).toBe('generic-tcp')
	})
})

describe('module products', () => {
	it('merges installed and store products, preferring the installed manufacturer', () => {
		const info = getModuleProducts(
			{
				id: 'm',
				name: 'M',
				helpPath: '',
				bugUrl: '',
				shortname: 'm',
				manufacturer: null,
				products: ['A'],
				keywords: [],
			},
			product('m', 'Acme', ['A', 'B']).storeInfo
		)
		expect(info).toEqual({ manufacturer: 'Acme', products: ['A', 'B'] })
	})

	it('formats a product with its manufacturer, when there is one', () => {
		expect(formatModuleProduct('Acme', 'Widget')).toBe('Acme: Widget')
		expect(formatModuleProduct(null, 'Widget')).toBe('Widget')
	})

	it('lists a module with no products by its name', () => {
		expect(getModuleProductEntries({ manufacturer: 'Acme', products: [] }, 'Acme Thing')).toEqual([
			{ product: 'Acme Thing', label: 'Acme Thing' },
		])
		expect(getModuleProductEntries({ manufacturer: 'Acme', products: ['A'] }, 'Acme Thing')).toEqual([
			{ product: 'A', label: 'Acme: A' },
		])
	})
})
