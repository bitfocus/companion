import { describe, expect, test } from 'vitest'
import { isModuleApiVersionCompatible } from '../lib/ModuleApiVersionCheck.js'
import { createRequire } from 'module'
import semver from 'semver'

const require = createRequire(import.meta.url)
const moduleBasePkg = require('@companion-module/base/package.json')

describe('isModuleApiVersionCompatible', () => {
	test('check current installed lib', () => {
		expect(isModuleApiVersionCompatible(moduleBasePkg.version)).toBe(true)
	})
	test('check patch version bump', () => {
		const version = semver.parse(moduleBasePkg.version)
		expect(version).not.toBe(null)
		version!.patch++
		version!.prerelease = []

		const versionStr = version!.format()
		expect(versionStr).toBeTruthy()
		expect(versionStr).not.toBe(moduleBasePkg.version)

		expect(isModuleApiVersionCompatible(versionStr)).toBe(true)
	})
	test('check minor version bump', () => {
		const version = semver.parse(moduleBasePkg.version)
		expect(version).not.toBe(null)
		version!.minor++

		const versionStr = version!.format()
		expect(versionStr).toBeTruthy()
		expect(versionStr).not.toBe(moduleBasePkg.version)

		expect(isModuleApiVersionCompatible(versionStr)).toBe(false)
	})
	test('check major version bump', () => {
		const version = semver.parse(moduleBasePkg.version)
		expect(version).not.toBe(null)
		version!.major++

		const versionStr = version!.format()
		expect(versionStr).toBeTruthy()
		expect(versionStr).not.toBe(moduleBasePkg.version)

		expect(isModuleApiVersionCompatible(versionStr)).toBe(false)
	})
	test('check previous minor version', () => {
		const version = semver.parse(moduleBasePkg.version)
		expect(version).not.toBe(null)
		version!.minor--
		version!.prerelease = []

		const versionStr = version!.format()
		expect(versionStr).toBeTruthy()
		expect(versionStr).not.toBe(moduleBasePkg.version)

		expect(isModuleApiVersionCompatible(versionStr)).toBe(true)
	})
	test('check previous major version', () => {
		const version = semver.parse(moduleBasePkg.version)
		expect(version).not.toBe(null)
		version!.major--

		const versionStr = version!.format()
		expect(versionStr).toBeTruthy()
		expect(versionStr).not.toBe(moduleBasePkg.version)

		expect(isModuleApiVersionCompatible(versionStr)).toBe(false)
	})

	test('prerelease of next major version', () => {
		const version = semver.parse(moduleBasePkg.version)
		expect(version).not.toBe(null)

		const versionStr = `${version!.major + 1}.0.0-0`
		expect(isModuleApiVersionCompatible(versionStr)).toBe(false)
	})
	test('prerelease of next minor version', () => {
		const version = semver.parse(moduleBasePkg.version)
		expect(version).not.toBe(null)

		const versionStr = `${version!.major}.${version!.minor + 1}.0-0`
		expect(isModuleApiVersionCompatible(versionStr)).toBe(false)
	})
	// test('prerelease of current version', () => {
	// 	const versionStr = `${moduleBasePkg.version}-0`
	// 	expect(isModuleApiVersionCompatible(versionStr)).toBe(true)
	// })

	/**
	 * The following tests may need revisiting when the api version is bumped to 2.0.0
	 */
	test('check 0.6.0 compatibility', () => {
		expect(isModuleApiVersionCompatible('0.6.0')).toBe(true)
	})
	test('check 0.5.0 compatibility', () => {
		expect(isModuleApiVersionCompatible('0.5.0')).toBe(false)
	})
	test('check 1.2.5 compatibility', () => {
		expect(isModuleApiVersionCompatible('1.2.5')).toBe(true)
	})
})
