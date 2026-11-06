import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { resolveHelpAssetPath } from '../../lib/Instance/HelpAsset.js'

describe('resolveHelpAssetPath', () => {
	let tempDir: string
	let helpDir: string
	let outsideDir: string

	beforeEach(() => {
		// realpathSync so the base tmp dir (which is itself a symlink on some platforms, e.g. macOS) doesn't
		// leak into the comparison
		tempDir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'companion-help-')))
		helpDir = path.join(tempDir, 'module', 'companion')
		outsideDir = path.join(tempDir, 'outside')
		mkdirSync(path.join(helpDir, 'images'), { recursive: true })
		mkdirSync(outsideDir)

		writeFileSync(path.join(helpDir, 'HELP.md'), '# Help')
		writeFileSync(path.join(helpDir, 'images', 'logo.png'), 'png')
		writeFileSync(path.join(helpDir, 'main.js'), 'code')
		writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret')
		writeFileSync(path.join(outsideDir, 'secret.md'), 'secret')
	})

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true })
	})

	test('resolves a plain file', async () => {
		expect(await resolveHelpAssetPath(helpDir, 'HELP.md')).toEqual({ root: helpDir, relativePath: 'HELP.md' })
	})

	test('resolves a file in a subdirectory', async () => {
		expect(await resolveHelpAssetPath(helpDir, 'images/logo.png')).toEqual({
			root: helpDir,
			relativePath: path.join('images', 'logo.png'),
		})
	})

	test('rejects a disallowed extension', async () => {
		expect(await resolveHelpAssetPath(helpDir, 'main.js')).toBeNull()
	})

	test('rejects a missing file', async () => {
		expect(await resolveHelpAssetPath(helpDir, 'missing.md')).toBeNull()
	})

	test('rejects a lexical traversal', async () => {
		expect(await resolveHelpAssetPath(helpDir, '../../outside/secret.md')).toBeNull()
	})

	test('rejects a symlinked file pointing outside the help dir', async () => {
		symlinkSync(path.join(outsideDir, 'secret.txt'), path.join(helpDir, 'leak.md'), 'file')
		expect(await resolveHelpAssetPath(helpDir, 'leak.md')).toBeNull()
	})

	test('rejects a symlinked directory pointing outside the help dir', async () => {
		symlinkSync(outsideDir, path.join(helpDir, 'linked'), 'dir')
		expect(await resolveHelpAssetPath(helpDir, 'linked/secret.md')).toBeNull()
	})

	test('rejects a symlink to a disallowed file inside the help dir', async () => {
		symlinkSync(path.join(helpDir, 'main.js'), path.join(helpDir, 'code.md'), 'file')
		expect(await resolveHelpAssetPath(helpDir, 'code.md')).toBeNull()
	})

	test('allows a symlink to an allowed file inside the help dir', async () => {
		symlinkSync(path.join(helpDir, 'images', 'logo.png'), path.join(helpDir, 'alias.png'), 'file')
		expect(await resolveHelpAssetPath(helpDir, 'alias.png')).toEqual({
			root: helpDir,
			relativePath: path.join('images', 'logo.png'),
		})
	})

	test('resolves through a symlinked help dir', async () => {
		const linkedModule = path.join(tempDir, 'linked-module')
		symlinkSync(path.join(tempDir, 'module'), linkedModule, 'dir')
		expect(await resolveHelpAssetPath(path.join(linkedModule, 'companion'), 'HELP.md')).toEqual({
			root: helpDir,
			relativePath: 'HELP.md',
		})
	})
})
