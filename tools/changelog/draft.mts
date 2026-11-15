export const FEAT_HEADER = '### 📣 CORE FEATURES AND IMPROVEMENTS'
export const FIX_HEADER = '### 🐞 BUG FIXES'
export const DRAFT_MARKER = '<!-- DRAFT -->'

/** A line of the changelog, from a commit */
export interface ChangelogEntry {
	/** The scope of the commit, eg `link` for `feat(link): ...`, or null when it has none */
	scope: string | null
	message: string
}

export interface ParsedCommits {
	feats: ChangelogEntry[]
	fixes: ChangelogEntry[]
}

/** Scopes which mean the same thing as another */
const SCOPE_ALIASES: Record<string, string> = {
	ui: 'webui',
}

/** Labels for scopes which don't read well as words */
const SCOPE_LABELS: Record<string, string> = {
	webui: 'Web UI',
	'import-export': 'Import / Export',
}

function normaliseScope(scope: string): string {
	const lower = scope.trim().toLowerCase()
	return SCOPE_ALIASES[lower] ?? lower
}

/** The label of a group of entries with a scope, eg `custom-actions` is `Custom Actions` */
export function scopeLabel(scope: string): string {
	return (
		SCOPE_LABELS[scope] ??
		scope
			.split(/[-_\s]+/)
			.filter(Boolean)
			.map((word) => word[0].toUpperCase() + word.slice(1))
			.join(' ')
	)
}

/**
 * Parse the subjects of commits, one per line, into the entries for the changelog
 */
export function parseCommits(log: string): ParsedCommits {
	const feats: ChangelogEntry[] = []
	const fixes: ChangelogEntry[] = []
	const commitRe = /^(feat|fix)(?:\(([^)]+)\))?!?:\s+(.+)$/i

	for (const line of log.split('\n')) {
		const m = commitRe.exec(line.trim())
		if (!m) continue

		const entry: ChangelogEntry = { scope: m[2] ? normaliseScope(m[2]) : null, message: m[3] }
		if (m[1].toLowerCase() === 'feat') feats.push(entry)
		else fixes.push(entry)
	}

	return { feats, fixes }
}

/**
 * The bullets for some entries. A scope with more than one entry, or which is in `existingGroups`, becomes a group
 * of its own, in the order they first appear, before the entries which are not in a group
 * @param entries The entries
 * @param existingGroups The scopes which already have a group, so are grouped even with one entry
 */
function groupEntries(
	entries: ChangelogEntry[],
	existingGroups: ReadonlySet<string>
): { groups: Map<string, string[]>; ungrouped: string[] } {
	const counts = new Map<string, number>()
	for (const entry of entries) {
		if (entry.scope) counts.set(entry.scope, (counts.get(entry.scope) ?? 0) + 1)
	}

	const groups = new Map<string, string[]>()
	const ungrouped: string[] = []
	for (const entry of entries) {
		if (entry.scope && (existingGroups.has(entry.scope) || (counts.get(entry.scope) ?? 0) > 1)) {
			let group = groups.get(entry.scope)
			if (!group) groups.set(entry.scope, (group = []))
			group.push(entry.message)
		} else {
			ungrouped.push(entry.message)
		}
	}

	return { groups, ungrouped }
}

function renderBullets(groups: Map<string, string[]>, ungrouped: string[]): string[] {
	const lines: string[] = []
	for (const [scope, messages] of groups) {
		lines.push(`- ${scopeLabel(scope)}`)
		for (const message of messages) lines.push(`  - ${message}`)
	}
	for (const message of ungrouped) lines.push(`- ${message}`)
	return lines
}

/** Remove the blank lines from the end of some lines */
function trimTrailingBlankLines(lines: string[]): string[] {
	let end = lines.length
	while (end > 0 && lines[end - 1].trim() === '') end--
	return lines.slice(0, end)
}

export function buildDraftBlock(version: string, commits: ParsedCommits): string {
	const lines: string[] = [`## Companion v${version} - Release Notes`, '', DRAFT_MARKER]

	for (const [header, entries] of [
		[FEAT_HEADER, commits.feats],
		[FIX_HEADER, commits.fixes],
	] as const) {
		if (entries.length === 0) continue

		const { groups, ungrouped } = groupEntries(entries, new Set())
		lines.push('', header, '', ...renderBullets(groups, ungrouped))
	}

	lines.push('')
	return lines.join('\n')
}

/**
 * Add entries to a section of the lines of a draft, adding the section if it isn't there. An entry whose scope
 * already has a group in the section is added to the end of that group
 * @param lines The lines of the draft block, without the blank lines at its end
 * @param header The header of the section
 * @param entries The entries to add
 * @param beforeHeader The header of the section which this one goes before, when it has to be added
 */
function mergeSection(
	lines: string[],
	header: string,
	entries: ChangelogEntry[],
	beforeHeader: string | null
): string[] {
	if (entries.length === 0) return lines

	const headerIndex = lines.indexOf(header)
	if (headerIndex === -1) {
		const { groups, ungrouped } = groupEntries(entries, new Set())
		const section = [header, '', ...renderBullets(groups, ungrouped), '']

		const beforeIndex = beforeHeader ? lines.indexOf(beforeHeader) : -1
		if (beforeIndex !== -1) return [...lines.slice(0, beforeIndex), ...section, ...lines.slice(beforeIndex)]
		return [...lines, '', ...section.slice(0, -1)]
	}

	// The section runs to the next section, or the end of the draft
	let sectionEnd = lines.findIndex((line, i) => i > headerIndex && line.startsWith('### '))
	if (sectionEnd === -1) sectionEnd = lines.length
	const before = lines.slice(0, headerIndex + 1)
	const body = lines.slice(headerIndex + 1, sectionEnd)
	const after = lines.slice(sectionEnd)

	// The groups already in the section, by their label
	const labelScopes = new Map<string, string>()
	for (const entry of entries) {
		if (entry.scope) labelScopes.set(`- ${scopeLabel(entry.scope)}`, entry.scope)
	}
	const existingGroups = new Set<string>()
	for (const line of body) {
		const scope = labelScopes.get(line)
		if (scope) existingGroups.add(scope)
	}

	const { groups, ungrouped } = groupEntries(entries, existingGroups)

	// Add to the end of the groups which are already there
	const newGroups = new Map<string, string[]>()
	for (const [scope, messages] of groups) {
		const labelIndex = body.indexOf(`- ${scopeLabel(scope)}`)
		if (labelIndex === -1) {
			newGroups.set(scope, messages)
			continue
		}

		let insertAt = labelIndex + 1
		while (insertAt < body.length && /^\s+\S/.test(body[insertAt])) insertAt++
		body.splice(insertAt, 0, ...messages.map((message) => `  - ${message}`))
	}

	// And the rest after everything in the section
	const content = trimTrailingBlankLines(body)
	const trailing = body.slice(content.length)
	const newBody = [...content, ...renderBullets(newGroups, ungrouped), ...trailing]

	return [...before, ...newBody, ...after]
}

/**
 * Find the draft block for `version`, identified by the DRAFT_MARKER comment, and add the new entries to its
 * sections.
 * @returns The updated changelog text
 */
export function mergeIntoDraft(changelog: string, version: string, commits: ParsedCommits): string {
	const draftHeading = `## Companion v${version} - Release Notes\n\n${DRAFT_MARKER}`
	const draftStart = changelog.indexOf(draftHeading)
	if (draftStart === -1) throw new Error(`Draft block for ${version} not found`)

	// The draft runs to the next release, or the end of the changelog
	const nextBlock = changelog.indexOf('\n## ', draftStart + draftHeading.length)
	const draftEnd = nextBlock === -1 ? changelog.length : nextBlock + 1

	const blockLines = changelog.slice(draftStart, draftEnd).split('\n')
	let lines = trimTrailingBlankLines(blockLines)
	const trailing = blockLines.slice(lines.length)
	lines = mergeSection(lines, FEAT_HEADER, commits.feats, FIX_HEADER)
	lines = mergeSection(lines, FIX_HEADER, commits.fixes, null)

	return changelog.slice(0, draftStart) + [...lines, ...trailing].join('\n') + changelog.slice(draftEnd)
}
