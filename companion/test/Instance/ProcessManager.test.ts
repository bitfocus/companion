import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { resolveModuleEntrypoint } from '../../lib/Instance/ProcessManager.js'

const tempDirs: string[] = []

// realpathSync so a symlinked system tmp dir (e.g. macOS) doesn't leak into path comparisons
function makeTempDir(prefix: string): string {
	const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), prefix)))
	tempDirs.push(dir)
	return dir
}

// Write a loadable module at <baseDir>/companion/<entrypoint> that reads one of its own files
function writeModule(baseDir: string, entrypoint = 'main.js'): string {
	const full = path.join(baseDir, 'companion', entrypoint)
	mkdirSync(path.dirname(full), { recursive: true })
	writeFileSync(full, `require('fs').readFileSync(__dirname + '/../package.json', 'utf8'); process.exit(0)`)
	writeFileSync(path.join(baseDir, 'package.json'), '{"name":"m"}')
	return full
}

/** Try to load `entrypoint` in a sandboxed node granted read to `grant`; true if it exits cleanly */
function loadsUnderSandbox(entrypoint: string, grant: string): boolean {
	try {
		execFileSync(process.execPath, ['--permission', `--allow-fs-read=${grant}`, entrypoint], { stdio: 'pipe' })
		return true
	} catch {
		return false
	}
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true })
	}
})

describe('resolveModuleEntrypoint', () => {
	describe('path resolution', () => {
		test('resolves a plain (non-symlinked) module dir', async () => {
			const base = makeTempDir('companion-mod-')
			const entry = writeModule(base)
			expect(await resolveModuleEntrypoint(base, 'main.js')).toEqual({ entrypoint: entry })
		})

		test('returns the real path when the module dir itself is a symlink', async () => {
			const realDir = makeTempDir('companion-mod-')
			const realEntry = writeModule(realDir)
			const linkDir = path.join(makeTempDir('companion-link-'), 'module')
			symlinkSync(realDir, linkDir, 'dir')
			expect(await resolveModuleEntrypoint(linkDir, 'main.js')).toEqual({ entrypoint: realEntry })
		})

		test('returns the real path when an ancestor (config) dir is a symlink', async () => {
			const realConfig = makeTempDir('companion-cfg-')
			const realEntry = writeModule(path.join(realConfig, 'modules', 'acme'))
			const configLink = path.join(makeTempDir('companion-link-'), 'config')
			symlinkSync(realConfig, configLink, 'dir')
			const result = await resolveModuleEntrypoint(path.join(configLink, 'modules', 'acme'), 'main.js')
			expect(result).toEqual({ entrypoint: realEntry })
		})

		test('reports a missing entrypoint', async () => {
			const base = makeTempDir('companion-mod-')
			expect(await resolveModuleEntrypoint(base, 'main.js')).toEqual({
				entrypoint: path.join(base, 'companion', 'main.js'),
				error: 'missing',
			})
		})

		test('rejects an entrypoint that escapes the module dir', async () => {
			const base = makeTempDir('companion-mod-')
			expect(await resolveModuleEntrypoint(base, '../../evil.js')).toMatchObject({ error: 'outside' })
		})
	})

	// The point of resolving to a real path: a sandboxed node can actually load it. These prove the
	// permission behaviour, not just string resolution. #4418 #3971
	describe('sandbox loading (companion-pi symlinked config dir)', () => {
		test('a symlinked-config entrypoint fails to load unresolved, but succeeds resolved', async () => {
			const realConfig = makeTempDir('companion-cfg-')
			const moduleDir = path.join(realConfig, 'modules', 'acme')
			writeModule(moduleDir)
			const configLink = path.join(makeTempDir('companion-link-'), 'config')
			symlinkSync(realConfig, configLink, 'dir')

			const basePathViaLink = path.join(configLink, 'modules', 'acme')
			const grant = realpathSync(basePathViaLink) // == the realPathOrSelf(moduleDir) fs-read grant

			// Unresolved (symlink-spelled) entrypoint: node must read the config symlink, which is not granted
			const unresolved = path.join(basePathViaLink, 'companion', 'main.js')
			expect(loadsUnderSandbox(unresolved, grant)).toBe(false)

			// Resolved entrypoint from the SUT: no symlink is traversed, so it loads
			const resolved = await resolveModuleEntrypoint(basePathViaLink, 'main.js')
			expect(resolved.error).toBeUndefined()
			expect(loadsUnderSandbox(resolved.entrypoint, grant)).toBe(true)
		})
	})
})
