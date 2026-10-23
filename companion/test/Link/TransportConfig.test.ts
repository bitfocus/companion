import { describe, expect, test } from 'vitest'
import type { LinkTransportConfigField } from '@companion-app/shared/Model/Link.js'
import { getDefaultLinkTransportConfig, resolveLinkTransportConfig } from '../../lib/Link/TransportConfig.js'

const fields: LinkTransportConfigField[] = [
	{ id: 'info', type: 'static-text', label: 'Info', value: 'Hello' },
	{ id: 'port', type: 'number', label: 'Port', default: 1000, min: 1, max: 2000 },
	{ id: 'url', type: 'textinput', label: 'Url', default: 'a', regex: '/^[a-z]+$/' },
	{ id: 'secret', type: 'secret-text', label: 'Secret', default: '' },
]

describe('getDefaultLinkTransportConfig', () => {
	test('uses the defaults of the fields', () => {
		expect(getDefaultLinkTransportConfig(fields)).toEqual({ port: 1000, url: 'a', secret: '' })
	})
})

describe('resolveLinkTransportConfig', () => {
	test('fills in missing values and drops unknown ones', () => {
		const result = resolveLinkTransportConfig(fields, { url: 'b', unknown: 1 })
		expect(result).toEqual({ config: { port: 1000, url: 'b', secret: '' }, errors: {} })
	})

	test('reports invalid values', () => {
		const result = resolveLinkTransportConfig(fields, { port: 5000, url: 'NOT VALID' })
		expect(Object.keys(result.errors).sort()).toEqual(['port', 'url'])
	})
})
