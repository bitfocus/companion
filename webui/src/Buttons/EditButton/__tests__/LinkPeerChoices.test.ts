import { describe, expect, it } from 'vitest'
import type { LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import { linkPeerChoices } from '../LinkPeerChoices.js'

function peer(id: string, name: string, overrides: Partial<LinkPeerInfo> = {}): LinkPeerInfo {
	return {
		id,
		fingerprint: `${id}-fp`,
		name,
		announcedName: name,
		alias: null,
		companionVersion: '5.2.0',
		protocolVersions: ['1.0.0'],
		protocolVersion: '1.0.0',
		compatible: true,
		routes: [],
		online: true,
		lastSeen: 0,
		sharedByUs: { buttons: false },
		sharedWithUs: { buttons: true },
		sharesLinkId: false,
		...overrides,
	}
}

describe('linkPeerChoices', () => {
	it('lists installations by name, saying why one cannot be used now', () => {
		expect(
			linkPeerChoices(
				[
					peer('d', 'Delta', { sharedWithUs: { buttons: false } }),
					peer('a', 'Alpha'),
					peer('c', 'Charlie', { online: false }),
					peer('b', 'Bravo', { compatible: false, online: false }),
				],
				''
			)
		).toEqual([
			{ id: 'a', label: 'Alpha' },
			{ id: 'b', label: 'Bravo - incompatible' },
			{ id: 'c', label: 'Charlie - offline' },
			{ id: 'd', label: 'Delta - not shared' },
		])
	})

	it('tells installations with the same name apart by their fingerprint', () => {
		expect(linkPeerChoices([peer('a', 'studio'), peer('b', 'studio'), peer('c', 'other')], '')).toEqual([
			{ id: 'c', label: 'other' },
			{ id: 'a', label: 'studio (a-fp)' },
			{ id: 'b', label: 'studio (b-fp)' },
		])
	})

	it('keeps the chosen installation when it has not been found, by its fingerprint', () => {
		expect(linkPeerChoices([peer('a', 'Alpha')], 'abcdEF0123456789ffff')).toEqual([
			{ id: 'abcdEF0123456789ffff', label: 'Unknown installation (abcd-EF01-2345-6789)' },
			{ id: 'a', label: 'Alpha' },
		])
	})
})
