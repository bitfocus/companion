import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { ADVANCED_ITEMS } from '../AdvancedDefinitions.js'
import { PROTOCOLS } from '../ProtocolDefinitions.js'
import type { SettingsItemDefinition } from '../SettingsItems.js'

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

describe.each<[string, readonly SettingsItemDefinition[]]>([
	['PROTOCOLS', PROTOCOLS],
	['ADVANCED_ITEMS', ADVANCED_ITEMS],
])('%s', (_name, items) => {
	test('ids are unique', () => {
		const ids = items.map((item) => item.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	test.each(items.filter((item) => typeof item.docs === 'string'))(
		'$id links to an existing user guide page',
		(item) => {
			expect(findUserGuidePage(item.docs as string)).not.toBeNull()
		}
	)
})
