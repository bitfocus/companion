import { mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { SomeModuleManifest } from '@companion-app/shared/Model/ModuleManifest.js'
import { getNodeJsPermissionArguments } from '../../lib/Instance/NodePath.js'

type Permissions = Record<string, boolean>

function makeConnectionManifest(runtimeType: string, permissions: Permissions = {}): SomeModuleManifest {
	return {
		type: 'connection',
		runtime: { type: runtimeType, permissions },
	} as unknown as SomeModuleManifest
}

function makeSurfaceManifest(runtimeType: string, permissions: Permissions = {}): SomeModuleManifest {
	return {
		type: 'surface',
		runtime: { type: runtimeType, permissions },
	} as unknown as SomeModuleManifest
}

/** Extract the paths granted via --allow-fs-read from the argument list */
function fsReadGrants(args: string[]): string[] {
	const prefix = '--allow-fs-read='
	return args.filter((a) => a.startsWith(prefix)).map((a) => a.slice(prefix.length))
}

const tempDirs: string[] = []

function makeTempDir(prefix: string): string {
	// realpathSync so the base tmp dir (which is itself a symlink on some platforms, e.g. macOS) doesn't
	// leak into the comparison
	const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), prefix)))
	tempDirs.push(dir)
	return dir
}

/** A current api version that supports the permissions model, so the gate is never the thing under test */
const API = '1.13.0'

beforeEach(() => {
	// Pin the ambient env the function reads, so tests don't depend on the host's environment.
	// Empty string is falsy, so system-ca is included and the build is treated as unpackaged (dev) by default.
	vi.stubEnv('COMPANION_SKIP_SYSTEM_CA', '')
	vi.stubEnv('COMPANION_BUNDLED', '')
})

afterEach(() => {
	vi.unstubAllEnvs()
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true })
	}
})

describe('getNodeJsPermissionArguments', () => {
	describe('cases that emit no arguments', () => {
		test('surface modules are never sandboxed', () => {
			const dir = makeTempDir('companion-mod-')
			expect(getNodeJsPermissionArguments(makeSurfaceManifest('node22'), API, dir, false)).toEqual([])
		})

		test('modules that predate the permissions model', () => {
			const dir = makeTempDir('companion-mod-')
			expect(getNodeJsPermissionArguments(makeConnectionManifest('node22'), '1.11.0', dir, false)).toEqual([])
		})

		test('node18 modules without any legacy permissions', () => {
			const dir = makeTempDir('companion-mod-')
			expect(getNodeJsPermissionArguments(makeConnectionManifest('node18'), API, dir, false)).toEqual([])
		})
	})

	describe('node18 runtime', () => {
		test('gets the openssl legacy provider when it requests insecure algorithms, and nothing else', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(
				makeConnectionManifest('node18', { 'insecure-algorithms': true }),
				API,
				dir,
				false
			)
			// node18 is limited: it returns before the permission model / system-ca args are added
			expect(args).toEqual(['--openssl-legacy-provider'])
		})
	})

	describe('insecure algorithms', () => {
		test('adds the openssl legacy provider for a modern runtime alongside the sandbox args', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(
				makeConnectionManifest('node22', { 'insecure-algorithms': true }),
				API,
				dir,
				false
			)
			expect(args).toContain('--openssl-legacy-provider')
			expect(args).toContain('--permission')
			// It comes before the sandbox arguments
			expect(args.indexOf('--openssl-legacy-provider')).toBeLessThan(args.indexOf('--permission'))
		})

		test('is omitted when not requested', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, dir, false)
			expect(args).not.toContain('--openssl-legacy-provider')
		})
	})

	describe('system CA', () => {
		test('uses the system CA store by default', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, dir, false)
			expect(args).toContain('--use-system-ca')
		})

		test('honours COMPANION_SKIP_SYSTEM_CA', () => {
			vi.stubEnv('COMPANION_SKIP_SYSTEM_CA', '1')
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, dir, false)
			expect(args).not.toContain('--use-system-ca')
		})
	})

	describe('inspector enabled', () => {
		test('does not lock down the filesystem, but still configures the CA store', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, dir, true)
			expect(args).toContain('--use-system-ca')
			expect(args).not.toContain('--permission')
			expect(args).not.toContain('--allow-net')
			expect(fsReadGrants(args)).toEqual([])
		})
	})

	describe('sandbox base arguments', () => {
		test('enables the permission model and grants read access to the module and companion code', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, dir, false)

			expect(args).toContain('--no-warnings=SecurityWarning')
			expect(args).toContain('--permission')

			const grants = fsReadGrants(args)
			// module dir, companion code dir, and (unpackaged) the module host package dir
			expect(grants).toContain(dir)
			expect(grants.length).toBe(3)
			expect(grants).not.toContain('*')
		})
	})

	describe('network access', () => {
		test('node22 does not get --allow-net (it is granted implicitly)', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, dir, false)
			expect(args).not.toContain('--allow-net')
		})

		test('node25+ must be granted --allow-net explicitly', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node25'), API, dir, false)
			expect(args).toContain('--allow-net')
		})
	})

	describe('packaged vs development builds', () => {
		test('an unpackaged build also grants read access to the module host package', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, dir, false)
			// module dir + companion code + host package
			expect(fsReadGrants(args).length).toBe(3)
		})

		test('a packaged build does not grant the module host package', () => {
			vi.stubEnv('COMPANION_BUNDLED', '1')
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, dir, false)
			// module dir + companion code only
			expect(fsReadGrants(args).length).toBe(2)
		})
	})

	describe('optional permission flags', () => {
		test('worker-threads grants --allow-worker', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(
				makeConnectionManifest('node22', { 'worker-threads': true }),
				API,
				dir,
				false
			)
			expect(args).toContain('--allow-worker')
			expect(args).not.toContain('--allow-child-process')
		})

		test('child-process grants --allow-child-process only', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(
				makeConnectionManifest('node22', { 'child-process': true }),
				API,
				dir,
				false
			)
			expect(args).toContain('--allow-child-process')
			expect(args).not.toContain('--allow-addons')
			expect(fsReadGrants(args)).not.toContain('*')
		})

		test('native-addons grants child-process, addons, and full filesystem access', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(
				makeConnectionManifest('node22', { 'native-addons': true }),
				API,
				dir,
				false
			)
			expect(args).toContain('--allow-child-process')
			expect(args).toContain('--allow-addons')
			expect(args).toContain('--allow-fs-read=*')
			expect(args).toContain('--allow-fs-write=*')
		})

		test('filesystem grants full read/write without child-process or addons', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22', { filesystem: true }), API, dir, false)
			expect(args).toContain('--allow-fs-read=*')
			expect(args).toContain('--allow-fs-write=*')
			expect(args).not.toContain('--allow-child-process')
			expect(args).not.toContain('--allow-addons')
		})

		test('no optional flags are added when no permissions are requested', () => {
			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, dir, false)
			expect(args).not.toContain('--allow-worker')
			expect(args).not.toContain('--allow-child-process')
			expect(args).not.toContain('--allow-addons')
			expect(args).not.toContain('--allow-fs-read=*')
			expect(args).not.toContain('--allow-fs-write=*')
		})
	})

	describe('symlink resolution (issues #4418 / #3971)', () => {
		test('resolves a symlinked module dir to its real path in the fs-read grant', () => {
			const realDir = makeTempDir('companion-mod-')
			const linkParent = makeTempDir('companion-link-')
			const linkDir = path.join(linkParent, 'module')
			symlinkSync(realDir, linkDir, 'dir')

			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, linkDir, false)
			const grants = fsReadGrants(args)

			// The grant must be the real path, otherwise Node denies the module access to its own files
			expect(grants).toContain(realDir)
			expect(grants).not.toContain(linkDir)
		})

		test('passes a non-symlinked module dir through unchanged', () => {
			const realDir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, realDir, false)
			expect(fsReadGrants(args)).toContain(realDir)
		})

		test('falls back to the given path when it cannot be resolved (e.g. it no longer exists)', () => {
			const missingDir = path.join(makeTempDir('companion-mod-'), 'gone')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, missingDir, false)
			expect(fsReadGrants(args)).toContain(missingDir)
		})
	})

	describe('windows network paths', () => {
		const realPlatform = process.platform

		afterEach(() => {
			Object.defineProperty(process, 'platform', { value: realPlatform })
		})

		test('a UNC module path forces full filesystem access, as node cannot sandbox it', () => {
			Object.defineProperty(process, 'platform', { value: 'win32' })

			const args = getNodeJsPermissionArguments(
				makeConnectionManifest('node22'),
				API,
				'\\\\server\\share\\module',
				false
			)

			expect(args).toContain('--allow-fs-read=*')
			expect(args).toContain('--allow-fs-write=*')
		})

		test('a normal path on windows is still sandboxed', () => {
			Object.defineProperty(process, 'platform', { value: 'win32' })

			const dir = makeTempDir('companion-mod-')
			const args = getNodeJsPermissionArguments(makeConnectionManifest('node22'), API, dir, false)

			expect(args).not.toContain('--allow-fs-write=*')
		})
	})
})
