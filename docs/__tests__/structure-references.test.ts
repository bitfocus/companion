import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const docsDir = path.resolve(__dirname, '..')
const structurePath = path.join(docsDir, 'structure.json')

function collectReferencedPaths(obj: any): string[] {
	const results: string[] = []

	function walk(value: any) {
		if (!value && value !== '') return
		if (typeof value === 'string') {
			// normalize by removing common querystrings like ?raw=true
			const cleaned = value.split('?')[0]
			// only consider common asset/document extensions
			if (/\.mdx?$|\.png$|\.jpe?g$|\.gif$/i.test(cleaned)) {
				results.push(cleaned)
			}
			return
		}
		if (Array.isArray(value)) {
			for (const v of value) walk(v)
			return
		}
		if (typeof value === 'object') {
			for (const k of Object.keys(value)) walk(value[k])
			return
		}
	}

	walk(obj)
	return results
}

describe('docs/structure.json', () => {
	/**
	 * The docs/structure.json is used for the https://user.bitfocus.io rendering of the docs
	 * This test ensure that all the files it references are actually present in the docs/ directory, so that it renders without error
	 */
	it('references files that exist under docs/', () => {
		const raw = fs.readFileSync(structurePath, 'utf8')
		const structure = JSON.parse(raw)

		const refs = collectReferencedPaths(structure)

		// Ensure we actually found references (sanity)
		expect(refs.length).toBeGreaterThan(0)

		const missing: string[] = []

		for (const ref of refs) {
			let rel = ref
			// handle Docusaurus alias used in some places
			if (rel.startsWith('@site/')) rel = rel.replace(/^@site\//, '')
			// remove leading slash if present
			if (rel.startsWith('/')) rel = rel.slice(1)

			const abs = path.resolve(docsDir, rel)
			if (!fs.existsSync(abs)) {
				missing.push(rel)
			}
		}

		// Fail the test if any referenced files are missing. This repository
		// currently has broken/missing docs (the test is expected to fail).
		expect(missing).toEqual([])
	})

	/**
	 * Ensure every markdown file in docs/user-guide is referenced from structure.json
	 */
	it('every markdown file under docs/user-guide is referenced by structure.json', () => {
		const raw = fs.readFileSync(structurePath, 'utf8')
		const structure = JSON.parse(raw)

		const refs = collectReferencedPaths(structure)

		// build a normalized set of referenced paths (relative to docs/)
		const referenced = new Set<string>()
		for (let ref of refs) {
			let rel = ref.split('?')[0]
			if (rel.startsWith('@site/')) rel = rel.replace(/^@site\//, '')
			if (rel.startsWith('/')) rel = rel.slice(1)
			// normalize path separators
			rel = rel.split(path.sep).join('/')
			referenced.add(rel)
			// also accept references that omit the .md/.mdx extension
			referenced.add(rel.replace(/\.mdx?$|\.MDX?$/i, ''))
		}

		function listMarkdownFiles(dir: string): string[] {
			const results: string[] = []
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name)
				if (entry.isDirectory()) {
					results.push(...listMarkdownFiles(full))
				} else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
					let rel = path.relative(docsDir, full)
					rel = rel.split(path.sep).join('/')
					results.push(rel)
				}
			}
			return results
		}

		const mdDir = path.join(docsDir, 'user-guide')
		if (!fs.existsSync(mdDir)) {
			// If the directory is missing, fail the test explicitly
			throw new Error('docs/user-guide directory not found')
		}

		const mdFiles = listMarkdownFiles(mdDir)
		// sanity
		expect(mdFiles.length).toBeGreaterThan(0)

		const unreferenced: string[] = []
		for (const f of mdFiles) {
			const noExt = f.replace(/\.mdx?$|\.MDX?$/i, '')
			if (!referenced.has(f) && !referenced.has(noExt)) {
				unreferenced.push(f)
			}
		}

		// Fail the test if any markdown files are not referenced by structure.json
		expect(unreferenced).toEqual([])
	})
})
