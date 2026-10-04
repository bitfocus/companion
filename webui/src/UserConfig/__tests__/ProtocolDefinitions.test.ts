import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { PROTOCOLS } from '../ProtocolDefinitions.js'

const userGuideDir = path.resolve(import.meta.dirname, '../../../../docs/user-guide')

/** Resolve a `/user-guide/...` link to its markdown file, allowing for docusaurus' numeric ordering prefixes */
function findUserGuidePage(link: string): string | null {
	const segments = link
		.replace(/^\/user-guide\//, '')
		.split('#')[0]
		.split('/')

	let dir = userGuideDir
	for (const [index, segment] of segments.entries()) {
		const isLast = index === segments.length - 1
		const match = fs
			.readdirSync(dir)
			.find(
				(entry) => entry.replace(/^\d+_/, '').replace(/\.md$/, '') === segment && (!isLast || entry.endsWith('.md'))
			)
		if (!match) return null
		dir = path.join(dir, match)
	}
	return dir
}

describe('PROTOCOLS', () => {
	test('ids are unique', () => {
		const ids = PROTOCOLS.map((protocol) => protocol.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	test.each(PROTOCOLS.filter((protocol) => typeof protocol.docs === 'string'))(
		'$id links to an existing user guide page',
		(protocol) => {
			expect(findUserGuidePage(protocol.docs as string)).not.toBeNull()
		}
	)
})
