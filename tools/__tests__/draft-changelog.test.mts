import { describe, expect, test } from 'vitest'
import { buildDraftBlock, mergeIntoDraft, parseCommits, scopeLabel } from '../changelog/draft.mts'

describe('parseCommits', () => {
	test('keeps the scope of each feat and fix, and skips the other commits', () => {
		const commits = parseCommits(
			[
				'feat(link): add transports',
				'fix: keep the selection',
				'chore: update dependencies',
				'Fix(WebUI)!: show the tabs',
				'refactor(webui): share one list page',
			].join('\n')
		)

		expect(commits).toEqual({
			feats: [{ scope: 'link', message: 'add transports' }],
			fixes: [
				{ scope: null, message: 'keep the selection' },
				{ scope: 'webui', message: 'show the tabs' },
			],
		})
	})

	test('treats the ui scope as the webui', () => {
		expect(parseCommits('fix(ui): a').fixes).toEqual([{ scope: 'webui', message: 'a' }])
	})
})

describe('scopeLabel', () => {
	test('names a scope in words', () => {
		expect(scopeLabel('link')).toBe('Link')
		expect(scopeLabel('custom-actions')).toBe('Custom Actions')
		expect(scopeLabel('webui')).toBe('Web UI')
	})
})

describe('buildDraftBlock', () => {
	test('groups the entries of a scope with more than one, before the rest', () => {
		const block = buildDraftBlock(
			'5.2.0',
			parseCommits(
				[
					'feat(link): add transports',
					'feat: allow modules using api 1.16',
					'feat(link): show installations',
					'feat(graphics): rotate elements',
					'fix(webui): show the tabs',
				].join('\n')
			)
		)

		expect(block).toBe(
			[
				'## Companion v5.2.0 - Release Notes',
				'',
				'<!-- DRAFT -->',
				'',
				'### 📣 CORE FEATURES AND IMPROVEMENTS',
				'',
				'- Link',
				'  - add transports',
				'  - show installations',
				'- allow modules using api 1.16',
				'- rotate elements',
				'',
				'### 🐞 BUG FIXES',
				'',
				'- show the tabs',
				'',
			].join('\n')
		)
	})

	test('makes a draft which can be merged into', () => {
		const changelog = `# Bitfocus Companion\n\n${buildDraftBlock('5.2.0', parseCommits('fix: a'))}`

		expect(() => mergeIntoDraft(changelog, '5.2.0', parseCommits('fix: b'))).not.toThrow()
	})
})

describe('mergeIntoDraft', () => {
	const DRAFT = [
		'# Bitfocus Companion',
		'',
		'## Companion v5.2.0 - Release Notes',
		'',
		'<!-- DRAFT -->',
		'',
		'### 📣 CORE FEATURES AND IMPROVEMENTS',
		'',
		'- Link',
		'  - add transports',
		'- allow modules using api 1.16',
		'',
		'### 🐞 BUG FIXES',
		'',
		'- keep the selection',
		'',
		'## Companion v5.1.3 - Release Notes',
		'',
		'- an old fix',
		'',
	].join('\n')

	test('adds to an existing group, even with one entry, and the rest after the section', () => {
		const merged = mergeIntoDraft(
			DRAFT,
			'5.2.0',
			parseCommits(
				[
					'feat(link): show installations',
					'feat(graphics): rotate elements',
					'feat(graphics): fill width',
					'fix(webui): show the tabs',
				].join('\n')
			)
		)

		expect(merged).toBe(
			[
				'# Bitfocus Companion',
				'',
				'## Companion v5.2.0 - Release Notes',
				'',
				'<!-- DRAFT -->',
				'',
				'### 📣 CORE FEATURES AND IMPROVEMENTS',
				'',
				'- Link',
				'  - add transports',
				'  - show installations',
				'- allow modules using api 1.16',
				'- Graphics',
				'  - rotate elements',
				'  - fill width',
				'',
				'### 🐞 BUG FIXES',
				'',
				'- keep the selection',
				'- show the tabs',
				'',
				'## Companion v5.1.3 - Release Notes',
				'',
				'- an old fix',
				'',
			].join('\n')
		)
	})

	test('adds a missing section, keeping the blank line before the next release', () => {
		const changelog = [
			'## Companion v5.2.0 - Release Notes',
			'',
			'<!-- DRAFT -->',
			'',
			'### 🐞 BUG FIXES',
			'',
			'- keep the selection',
			'',
			'## Companion v5.1.3 - Release Notes',
		].join('\n')

		expect(mergeIntoDraft(changelog, '5.2.0', parseCommits('feat: a\nfix: b'))).toBe(
			[
				'## Companion v5.2.0 - Release Notes',
				'',
				'<!-- DRAFT -->',
				'',
				'### 📣 CORE FEATURES AND IMPROVEMENTS',
				'',
				'- a',
				'',
				'### 🐞 BUG FIXES',
				'',
				'- keep the selection',
				'- b',
				'',
				'## Companion v5.1.3 - Release Notes',
			].join('\n')
		)
	})

	test('adds a missing fixes section to a draft at the end of the changelog', () => {
		const changelog = [
			'## Companion v5.2.0 - Release Notes',
			'',
			'<!-- DRAFT -->',
			'',
			'### 📣 CORE FEATURES AND IMPROVEMENTS',
			'',
			'- a',
			'',
		].join('\n')

		expect(mergeIntoDraft(changelog, '5.2.0', parseCommits('fix: b'))).toBe(
			[
				'## Companion v5.2.0 - Release Notes',
				'',
				'<!-- DRAFT -->',
				'',
				'### 📣 CORE FEATURES AND IMPROVEMENTS',
				'',
				'- a',
				'',
				'### 🐞 BUG FIXES',
				'',
				'- b',
				'',
			].join('\n')
		)
	})

	test('refuses a changelog without the draft', () => {
		expect(() => mergeIntoDraft('# Bitfocus Companion\n', '5.2.0', parseCommits('fix: a'))).toThrow()
	})
})
