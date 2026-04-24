#!/usr/bin/env node
import { $, fs } from 'zx'
import { goSilent } from './lib.mts'

const CHANGELOG_PATH = new URL('../CHANGELOG.md', import.meta.url)
const PACKAGE_JSON_PATH = new URL('../package.json', import.meta.url)

const FEAT_HEADER = '### 📣 CORE FEATURES AND IMPROVEMENTS'
const FIX_HEADER = '### 🐞 BUG FIXES'
const DRAFT_MARKER = '<!-- DRAFT -->'

interface ParsedCommits {
	feats: string[]
	fixes: string[]
}

function parseCommits(log: string): ParsedCommits {
	const feats: string[] = []
	const fixes: string[] = []
	const commitRe = /^(feat|fix)(\([^)]+\))?!?:\s+(.+)$/i

	for (const line of log.split('\n')) {
		const trimmed = line.trim()
		if (!trimmed) continue
		const m = commitRe.exec(trimmed)
		if (!m) continue
		const type = m[1].toLowerCase()
		const message = m[3]
		if (type === 'feat') feats.push(message)
		else if (type === 'fix') fixes.push(message)
	}

	return { feats, fixes }
}

function buildDraftBlock(version: string, feats: string[], fixes: string[]): string {
	const lines: string[] = []
	lines.push(`## Companion v${version} - Release Notes`)
	lines.push(DRAFT_MARKER)

	if (feats.length > 0) {
		lines.push('')
		lines.push(FEAT_HEADER)
		lines.push('')
		for (const f of feats) lines.push(`- ${f}`)
	}

	if (fixes.length > 0) {
		lines.push('')
		lines.push(FIX_HEADER)
		lines.push('')
		for (const f of fixes) lines.push(`- ${f}`)
	}

	lines.push('')
	return lines.join('\n')
}

/**
 * Find the draft block for `version` — identified by the DRAFT_MARKER comment — and splice
 * the new bullets into the appropriate sections.
 * Returns the updated changelog text.
 */
function mergeIntoDraft(changelog: string, version: string, feats: string[], fixes: string[]): string {
	const draftHeading = `## Companion v${version} - Release Notes\n\n${DRAFT_MARKER}`
	const draftStart = changelog.indexOf(draftHeading)
	if (draftStart === -1) throw new Error(`Draft block for ${version} not found`)

	// Find the end of the draft block: next ## heading or end of string
	const afterHeading = draftStart + draftHeading.length
	const nextBlockMatch = /\n## /g
	nextBlockMatch.lastIndex = afterHeading
	const nextBlock = nextBlockMatch.exec(changelog)
	const draftEnd = nextBlock ? nextBlock.index : changelog.length

	let draftBlock = changelog.slice(draftStart, draftEnd)

	if (feats.length > 0) {
		const featIdx = draftBlock.indexOf(FEAT_HEADER)
		if (featIdx === -1) {
			// Insert feat section before the fix section or before end
			const fixIdx = draftBlock.indexOf(FIX_HEADER)
			const insertAt = fixIdx === -1 ? draftBlock.length : fixIdx
			const newSection = `${FEAT_HEADER}\n\n${feats.map((f) => `- ${f}`).join('\n')}\n\n`
			draftBlock = draftBlock.slice(0, insertAt) + newSection + draftBlock.slice(insertAt)
		} else {
			// Append bullets after the last existing feat bullet
			const featSectionStart = featIdx + FEAT_HEADER.length
			// Find the end of the feat section (next ### or end of block)
			const nextSectionMatch = /\n### /g
			nextSectionMatch.lastIndex = featSectionStart
			const nextSection = nextSectionMatch.exec(draftBlock)
			const featSectionEnd = nextSection ? nextSection.index : draftBlock.length
			const bullets = '\n' + feats.map((f) => `- ${f}`).join('\n')
			draftBlock = draftBlock.slice(0, featSectionEnd) + bullets + draftBlock.slice(featSectionEnd)
		}
	}

	if (fixes.length > 0) {
		const fixIdx = draftBlock.indexOf(FIX_HEADER)
		if (fixIdx === -1) {
			// Append fix section at end of draft block
			const newSection = `\n${FIX_HEADER}\n\n${fixes.map((f) => `- ${f}`).join('\n')}\n`
			draftBlock = draftBlock.trimEnd() + '\n' + newSection
		} else {
			// Append bullets after the last existing fix bullet
			const fixSectionStart = fixIdx + FIX_HEADER.length
			const nextSectionMatch = /\n### /g
			nextSectionMatch.lastIndex = fixSectionStart
			const nextSection = nextSectionMatch.exec(draftBlock)
			const fixSectionEnd = nextSection ? nextSection.index : draftBlock.length
			const bullets = '\n' + fixes.map((f) => `- ${f}`).join('\n')
			draftBlock = draftBlock.slice(0, fixSectionEnd) + bullets + draftBlock.slice(fixSectionEnd)
		}
	}

	return changelog.slice(0, draftStart) + draftBlock + changelog.slice(draftEnd)
}

await goSilent(async () => {
	// --- 1. Determine branch (used only for context in output) ---
	const branchRaw = await $`git rev-parse --abbrev-ref HEAD`
	const branch = branchRaw.stdout.trim()

	if (branch !== 'main' && !/^stable-[\d.]+$/.test(branch)) {
		console.error(`Error: branch "${branch}" is not "main" or "stable-<X.Y>". Refusing to update changelog.`)
		process.exit(1)
	}

	// --- 2. Target version comes from package.json ---
	const packageJsonStr = await fs.readFile(PACKAGE_JSON_PATH, 'utf-8')
	const packageJson = JSON.parse(packageJsonStr) as { version: string }
	let targetVersion = packageJson.version
	if (/^stable-/.test(branch)) {
		// Strip prerelease suffix and bump patch (e.g. 4.3.0-rc.1 → 4.3.1)
		const [major, minor, patch] = targetVersion.split('-')[0].split('.').map(Number)
		targetVersion = `${major}.${minor}.${patch + 1}`
	}

	// --- 3. Get last tag (used only for the commit range when no draft exists) ---
	// Use --sort=-version:refname so we get the highest semver tag across ALL branches,
	// not just tags reachable from the current commit (which git describe would do).
	let lastTag: string
	const tagListRaw = await $`git tag --list 'v*' --sort=-version:refname`
	const lastTagCandidate = tagListRaw.stdout.trim().split('\n')[0]?.trim()
	if (!lastTagCandidate) {
		console.error('Error: no git tags found. Cannot determine commit range.')
		process.exit(1)
	}
	lastTag = lastTagCandidate

	// --- 4. Read changelog and detect existing draft (identified by DRAFT_MARKER) ---
	const changelog = await fs.readFile(CHANGELOG_PATH, 'utf-8')
	const draftHeading = `## Companion v${targetVersion} - Release Notes\n\n${DRAFT_MARKER}`
	const draftExists = changelog.includes(draftHeading)

	// --- 5. Determine commit range ---
	let rangeBase: string
	if (draftExists) {
		// Use the commit that last touched CHANGELOG.md as the base
		const lastChangeRaw = await $`git log -1 --pretty=format:%H -- CHANGELOG.md`
		const lastChangeHash = lastChangeRaw.stdout.trim()
		if (!lastChangeHash) {
			console.error('Error: could not determine last CHANGELOG.md commit.')
			process.exit(1)
		}
		rangeBase = lastChangeHash
	} else {
		rangeBase = lastTag
	}

	// --- 5. Get and parse commits ---
	const logRaw = await $`git log ${rangeBase}..HEAD --pretty=format:%s`
	const log = logRaw.stdout.trim()

	const { feats, fixes } = parseCommits(log)
	const totalNew = feats.length + fixes.length

	if (totalNew === 0) {
		console.log(
			`Nothing new: no feat/fix commits found in range ${rangeBase}..HEAD (target version: v${targetVersion})`
		)
		process.exit(0)
	}

	// --- 6. Write changelog ---
	let updatedChangelog: string
	if (draftExists) {
		updatedChangelog = mergeIntoDraft(changelog, targetVersion, feats, fixes)
	} else {
		const draftBlock = buildDraftBlock(targetVersion, feats, fixes)
		// Insert after the first line ("# Bitfocus Companion")
		const firstNewline = changelog.indexOf('\n')
		const insertAt = firstNewline === -1 ? changelog.length : firstNewline + 1
		updatedChangelog = changelog.slice(0, insertAt) + '\n' + draftBlock + '\n' + changelog.slice(insertAt)
	}

	await fs.writeFile(CHANGELOG_PATH, updatedChangelog, 'utf-8')

	const action = draftExists ? 'Appended to existing draft' : 'Created new draft'
	console.log(`${action} for Companion v${targetVersion} (${branch})`)
	console.log(`  Range: ${rangeBase}..HEAD`)
	console.log(`  Added: ${feats.length} feat(s), ${fixes.length} fix(es)`)
})
