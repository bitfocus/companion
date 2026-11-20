import fs from 'node:fs'
import path from 'node:path'
import type { Root, RootContent } from 'mdast'
import { toString } from 'mdast-util-to-string'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, test } from 'vitest'

// The website (bitfocus/website) builds its What's New landing page from these pages, in
// src/plugins/whats-new-index.ts, and orders its sidebar by the version in the filename. These checks mirror its rules.

const whatsNewDir = path.resolve(import.meta.dirname, '../../docs/user-guide/9_whatsnew')

const files = fs.readdirSync(whatsNewDir).filter((f) => f.endsWith('.md'))

/** Same regex and `key: value` parsing as the website */
function splitFrontMatter(source: string): { frontMatter: Record<string, string>; body: string } | null {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
	if (!match) return null

	const frontMatter: Record<string, string> = {}
	for (const line of match[1].split(/\r?\n/)) {
		const kv = line.match(/^([\w-]+):\s*(.*)$/)
		if (kv) frontMatter[kv[1]] = kv[2].replace(/^(['"])(.*)\1$/, '$2')
	}

	return { frontMatter, body: source.slice(match[0].length) }
}

function hasProse(node: RootContent): boolean {
	if (node.type === 'image' || node.type === 'imageReference') return false
	if (node.type === 'text') return !!node.value.trim()
	if ('children' in node) return node.children.some((c) => hasProse(c as RootContent))
	return true
}

function parsePage(file: string) {
	const parsed = splitFrontMatter(fs.readFileSync(path.join(whatsNewDir, file), 'utf8'))
	if (!parsed) throw new Error(`${file} has no front matter`)

	const tree = unified().use(remarkParse).use(remarkGfm).parse(parsed.body) as Root
	const firstH2 = tree.children.findIndex((n) => n.type === 'heading' && n.depth === 2)
	const summary = firstH2 === -1 ? tree.children : tree.children.slice(0, firstH2)
	const highlights = tree.children
		.filter((n) => n.type === 'heading' && n.depth === 2)
		.map((n) => toString(n).trim())
		.filter((t) => !/^and more$/i.test(t))

	return { frontMatter: parsed.frontMatter, summary, highlights }
}

function fileVersion(file: string): string {
	return file.replace(/\.md$/, '').replace(/^v/, '').replace(/-/g, '.')
}

function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map(Number)
	const pb = b.split('.').map(Number)
	for (let i = 0; i < 3; i++) {
		if (pa[i] !== pb[i]) return pa[i] - pb[i]
	}
	return 0
}

describe("What's New pages", () => {
	test('there are pages', () => {
		expect(files.length).toBeGreaterThan(0)
	})

	describe.each(files)('%s', (file) => {
		test('is named for its version, eg v5-1-0.md', () => {
			expect(file).toMatch(/^v\d+-\d+-\d+\.md$/)
		})

		test('has a title, date and description', () => {
			const { frontMatter } = parsePage(file)

			expect(frontMatter.title).toBe(`Companion v${fileVersion(file)}`)
			expect(frontMatter.description).toBeTruthy()

			expect(frontMatter.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
			expect(new Date(frontMatter.date).toISOString().slice(0, 10)).toBe(frontMatter.date)
		})

		test('has no sidebar_position, as the sidebar is ordered by version', () => {
			expect(parsePage(file).frontMatter).not.toHaveProperty('sidebar_position')
		})

		test('opens with a summary before the first ## heading', () => {
			// The landing page only shows the paragraphs, lists and quotes of the summary, without images
			const prose = parsePage(file).summary.filter(
				(n) => n.type === 'paragraph' || n.type === 'list' || n.type === 'blockquote'
			)
			expect(prose.some(hasProse)).toBe(true)
		})

		test('has ## headings to list as highlights', () => {
			expect(parsePage(file).highlights.length).toBeGreaterThan(0)
		})
	})

	test('newer versions have later dates', () => {
		const pages = files
			.map((file) => ({ version: fileVersion(file), date: parsePage(file).frontMatter.date }))
			.sort((a, b) => compareVersions(a.version, b.version))

		const dates = pages.map((p) => p.date)
		expect(dates).toEqual([...dates].sort())
	})
})
