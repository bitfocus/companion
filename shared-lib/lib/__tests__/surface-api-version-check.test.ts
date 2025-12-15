import { describe, expect, test } from 'vitest'
import { isSurfaceApiVersionCompatible } from '../ModuleApiVersionCheck.js'
import { createRequire } from 'module'
import semver from 'semver'

const require = createRequire(import.meta.url)
const surfaceBasePkg = require('@companion-surface/base/package.json')

describe('isSurfaceApiVersionCompatible', () => {
	test('check current installed lib', () => {
		expect(isSurfaceApiVersionCompatible(surfaceBasePkg.version)).toBe(true)
	})
	test('check patch version bump', () => {
		const version = semver.parse(surfaceBasePkg.version)
		expect(version).not.toBe(null)
		version!.patch++
		version!.prerelease = []

		const versionStr = version!.format()
		expect(versionStr).toBeTruthy()
		expect(versionStr).not.toBe(surfaceBasePkg.version)

		expect(isSurfaceApiVersionCompatible(versionStr)).toBe(true)
	})
	test('check minor version bump', () => {
		const version = semver.parse(surfaceBasePkg.version)
		expect(version).not.toBe(null)
		version!.minor++

		const versionStr = version!.format()
		expect(versionStr).toBeTruthy()
		expect(versionStr).not.toBe(surfaceBasePkg.version)

		expect(isSurfaceApiVersionCompatible(versionStr)).toBe(false)
	})
	test('check major version bump', () => {
		const version = semver.parse(surfaceBasePkg.version)
		expect(version).not.toBe(null)
		version!.major++

		const versionStr = version!.format()
		expect(versionStr).toBeTruthy()
		expect(versionStr).not.toBe(surfaceBasePkg.version)

		expect(isSurfaceApiVersionCompatible(versionStr)).toBe(false)
	})
	test('check previous minor version', () => {
		const version = semver.parse(surfaceBasePkg.version)
		expect(version).not.toBe(null)
		// TODO - undo this once we have api versions beyond 1.0.0
		expect(version?.minor).toBe(0)
		// version!.minor--
		// version!.prerelease = []

		// const versionStr = version!.format()
		// expect(versionStr).toBeTruthy()
		// expect(versionStr).not.toBe(surfaceBasePkg.version)

		// expect(isSurfaceApiVersionCompatible(versionStr)).toBe(true)
	})
	test('check previous major version', () => {
		const version = semver.parse(surfaceBasePkg.version)
		expect(version).not.toBe(null)
		version!.major--

		const versionStr = version!.format()
		expect(versionStr).toBeTruthy()
		expect(versionStr).not.toBe(surfaceBasePkg.version)

		expect(isSurfaceApiVersionCompatible(versionStr)).toBe(false)
	})

	test('prerelease of next major version', () => {
		const version = semver.parse(surfaceBasePkg.version)
		expect(version).not.toBe(null)

		const versionStr = `${version!.major + 1}.0.0-0`
		expect(isSurfaceApiVersionCompatible(versionStr)).toBe(false)
	})
	test('prerelease of next minor version', () => {
		const version = semver.parse(surfaceBasePkg.version)
		expect(version).not.toBe(null)

		const versionStr = `${version!.major}.${version!.minor + 1}.0-0`
		expect(isSurfaceApiVersionCompatible(versionStr)).toBe(false)
	})
	// test('prerelease of current version', () => {
	// 	const versionStr = `${surfaceBasePkg.version}-0`
	// 	expect(isSurfaceApiVersionCompatible(versionStr)).toBe(true)
	// })

	/**
	 * The following tests may need revisiting when the api version is bumped to 2.0.0
	 */
	test('check 0.5.0 compatibility', () => {
		expect(isSurfaceApiVersionCompatible('0.5.0')).toBe(false)
	})
	test('check 1.0.3 compatibility', () => {
		expect(isSurfaceApiVersionCompatible('1.0.3')).toBe(true)
	})
})
