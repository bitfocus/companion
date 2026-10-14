import { describe, expect, it } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo, ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import {
	getModuleInstallationKind,
	getModuleVersionLabel,
	getPreferredModuleVersion,
	isModuleInstalled,
} from '../ModuleInstallState.js'

function version(versionId: string): ClientModuleVersionInfo {
	return {
		displayName: `v${versionId}`,
		isLegacy: false,
		isBeta: false,
		helpPath: '',
		versionId,
		allowMultipleInstances: false,
	}
}

function moduleInfo(overrides: Partial<ClientModuleInfo>): ClientModuleInfo {
	return {
		moduleType: ModuleInstanceType.Connection,
		display: {
			id: 'm',
			name: 'M',
			helpPath: '',
			bugUrl: '',
			shortname: 'm',
			manufacturer: null,
			products: [],
			keywords: [],
		},
		devVersion: null,
		builtinVersion: null,
		stableVersion: null,
		betaVersion: null,
		installedVersions: [],
		...overrides,
	}
}

const stable = version('1.2.0')
const beta = version('1.3.0-beta')
const dev = version('dev')
const builtin = version('builtin')

describe('getPreferredModuleVersion', () => {
	it('prefers dev, then stable, beta and built-in', () => {
		expect(getPreferredModuleVersion(moduleInfo({ devVersion: dev, stableVersion: stable }))).toBe(dev)
		expect(getPreferredModuleVersion(moduleInfo({ stableVersion: stable, betaVersion: beta }))).toBe(stable)
		expect(getPreferredModuleVersion(moduleInfo({ betaVersion: beta, builtinVersion: builtin }))).toBe(beta)
		expect(getPreferredModuleVersion(moduleInfo({ builtinVersion: builtin }))).toBe(builtin)
	})

	it('is null when nothing is installed', () => {
		expect(getPreferredModuleVersion(moduleInfo({}))).toBeNull()
		expect(getPreferredModuleVersion(undefined)).toBeNull()
	})
})

describe('isModuleInstalled', () => {
	it('counts installed, dev and built-in versions', () => {
		expect(isModuleInstalled(moduleInfo({ installedVersions: [stable] }))).toBe(true)
		expect(isModuleInstalled(moduleInfo({ devVersion: dev }))).toBe(true)
		expect(isModuleInstalled(moduleInfo({ builtinVersion: builtin }))).toBe(true)
	})

	it('is false for a module with no versions, or none at all', () => {
		expect(isModuleInstalled(moduleInfo({}))).toBe(false)
		expect(isModuleInstalled(null)).toBe(false)
	})
})

describe('getModuleInstallationKind', () => {
	it('ranks development over installed over built-in', () => {
		expect(getModuleInstallationKind(moduleInfo({ devVersion: dev, installedVersions: [stable] }))).toBe('Development')
		expect(getModuleInstallationKind(moduleInfo({ installedVersions: [stable], builtinVersion: builtin }))).toBe(
			'Installed'
		)
		expect(getModuleInstallationKind(moduleInfo({ builtinVersion: builtin }))).toBe('Built-in')
	})

	it('is available when nothing is installed', () => {
		expect(getModuleInstallationKind(moduleInfo({}))).toBe('Available')
		expect(getModuleInstallationKind(undefined)).toBe('Available')
	})
})

describe('getModuleVersionLabel', () => {
	it('shows the version of a single installed version', () => {
		expect(getModuleVersionLabel(moduleInfo({ installedVersions: [stable], stableVersion: stable }))).toBe('v1.2.0')
	})

	it('counts several installed versions', () => {
		expect(
			getModuleVersionLabel(moduleInfo({ installedVersions: [stable, beta], stableVersion: stable, betaVersion: beta }))
		).toBe('2 versions')
	})

	it('shows the installed version alongside a built-in one', () => {
		expect(
			getModuleVersionLabel(moduleInfo({ installedVersions: [stable], stableVersion: stable, builtinVersion: builtin }))
		).toBe('v1.2.0')
	})

	it('has none for dev, built-in only, or uninstalled modules', () => {
		expect(getModuleVersionLabel(moduleInfo({ devVersion: dev, installedVersions: [stable, beta] }))).toBeUndefined()
		expect(getModuleVersionLabel(moduleInfo({ builtinVersion: builtin }))).toBeUndefined()
		expect(getModuleVersionLabel(moduleInfo({}))).toBeUndefined()
		expect(getModuleVersionLabel(null)).toBeUndefined()
	})
})
