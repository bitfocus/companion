#!/usr/bin/env node
import { $, fs } from 'zx'
import { buildDraftBlock, DRAFT_MARKER, mergeIntoDraft, parseCommits } from './changelog/draft.mts'
import { goSilent } from './lib.mts'

const CHANGELOG_PATH = new URL('../CHANGELOG.md', import.meta.url)
const PACKAGE_JSON_PATH = new URL('../package.json', import.meta.url)

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

	const commits = parseCommits(log)
	const totalNew = commits.feats.length + commits.fixes.length

	if (totalNew === 0) {
		console.log(
			`Nothing new: no feat/fix commits found in range ${rangeBase}..HEAD (target version: v${targetVersion})`
		)
		process.exit(0)
	}

	// --- 6. Write changelog ---
	let updatedChangelog: string
	if (draftExists) {
		updatedChangelog = mergeIntoDraft(changelog, targetVersion, commits)
	} else {
		const draftBlock = buildDraftBlock(targetVersion, commits)
		// Insert after the first line ("# Bitfocus Companion")
		const firstNewline = changelog.indexOf('\n')
		const insertAt = firstNewline === -1 ? changelog.length : firstNewline + 1
		updatedChangelog = changelog.slice(0, insertAt) + '\n' + draftBlock + '\n' + changelog.slice(insertAt)
	}

	await fs.writeFile(CHANGELOG_PATH, updatedChangelog, 'utf-8')

	const action = draftExists ? 'Appended to existing draft' : 'Created new draft'
	console.log(`${action} for Companion v${targetVersion} (${branch})`)
	console.log(`  Range: ${rangeBase}..HEAD`)
	console.log(`  Added: ${commits.feats.length} feat(s), ${commits.fixes.length} fix(es)`)
})
