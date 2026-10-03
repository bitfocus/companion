import { describe, expect, it } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { FuzzyProduct } from '~/Hooks/useFilteredProducts.js'
import { getModuleProductName, groupModuleCatalog } from '../ModuleCatalog.js'

function product(moduleId: string, name: string, matchedProduct = name): FuzzyProduct {
	return {
		moduleType: ModuleInstanceType.Connection,
		moduleId,
		name,
		product: matchedProduct,
		installedInfo: null,
		storeInfo: null,
		shortname: name,
		keywords: '',
		bugUrl: undefined,
		helpUrl: undefined,
	}
}

describe('shared module catalog', () => {
	it('groups manufacturers case-insensitively and puts unprefixed modules last', () => {
		const groups = groupModuleCatalog(
			[
				product('generic', 'Generic TCP'),
				product('sony-b', 'Sony: Z'),
				product('sony-a', 'SONY: A'),
				product('atem', 'Blackmagic Design: ATEM'),
			],
			false
		)
		expect(groups.map(([key]) => key)).toEqual(['blackmagic design', 'sony', 'other'])
		expect(groups[1][1].modules.map((module) => module.moduleId)).toEqual(['sony-a', 'sony-b'])
	})

	it('keeps the best product match and search order within a manufacturer', () => {
		const best = product('atem', 'Blackmagic Design: ATEM', 'ATEM Mini')
		const groups = groupModuleCatalog(
			[
				best,
				product('atem', 'Blackmagic Design: ATEM', 'ATEM Television Studio'),
				product('audio', 'Blackmagic Design: Audio'),
			],
			true
		)
		expect(groups[0][1].modules).toEqual([best, expect.objectContaining({ moduleId: 'audio' })])
	})

	it('removes only the manufacturer prefix and preserves unprefixed names', () => {
		expect(getModuleProductName(product('atem', 'Blackmagic Design: ATEM'))).toBe('ATEM')
		expect(getModuleProductName(product('tcp', 'Generic TCP'))).toBe('Generic TCP')
	})
})
