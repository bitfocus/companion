import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { ADVANCED_ITEMS } from '../AdvancedDefinitions.js'
import { PROTOCOLS } from '../ProtocolDefinitions.js'
import type { SettingsItemDefinition } from '../SettingsItems.js'

const userGuideDir = path.resolve(import.meta.dirname, '../../../../docs/user-guide')

/**
 * The url of each user guide page, relative to `/user-guide`, as docusaurus gives it: from its `slug` front matter if
 * it has one, otherwise its path without the numeric ordering prefixes (an `index.md` being its folder)
 */
function collectUserGuidePages(): Map<string, string> {
	const pages = new Map<string, string>()

	const visit = (dir: string, urlSegments: string[]) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const name = entry.name.replace(/^\d+_/, '')
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				visit(fullPath, [...urlSegments, name])
			} else if (entry.name.endsWith('.md')) {
				const slug = readSlug(fs.readFileSync(fullPath, 'utf8'))
				const page = name.replace(/\.md$/, '')
				// A slug without a leading slash is relative to the folder of the page
				const url = slug?.startsWith('/')
					? slug
					: `/${[...urlSegments, ...(slug ? [slug] : page === 'index' ? [] : [page])].join('/')}`
				pages.set(url.replace(/\/$/, ''), fullPath)
			}
		}
	}
	visit(userGuideDir, [])

	return pages
}

/** The `slug` in the front matter at the top of a page, if it has one */
function readSlug(content: string): string | undefined {
	const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(content)?.[1]
	return frontMatter ? /^slug:\s*(.+?)\s*$/m.exec(frontMatter)?.[1] : undefined
}

const userGuidePages = collectUserGuidePages()

/** Resolve a `/user-guide/...` link to its markdown file */
function findUserGuidePage(link: string): string | null {
	const url = link
		.replace(/^\/user-guide/, '')
		.split('#')[0]
		.replace(/\/$/, '')
	return userGuidePages.get(url) ?? null
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
