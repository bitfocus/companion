import { describe, expect, test } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo, ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type {
	ModuleStoreModuleInfoStore,
	ModuleStoreModuleInfoVersion,
} from '@companion-app/shared/Model/ModulesStore.js'
import { isSurfaceInstanceLimitReached } from '../AddInstanceLimit.js'

function makeVersion(versionId: string, allowMultipleInstances: boolean): ClientModuleVersionInfo {
	return {
		displayName: `v${versionId}`,
		isLegacy: false,
		isBeta: false,
		helpPath: '',
		versionId,
		allowMultipleInstances,
	}
}

function makeInfo(overrides: Partial<ClientModuleInfo>): ClientModuleInfo {
	return {
		moduleType: ModuleInstanceType.Surface,
		display: { id: 'test', name: 'Test', helpPath: '', bugUrl: '', shortname: 'test', products: [], keywords: [] },
		devVersion: null,
		builtinVersion: null,
		stableVersion: null,
		betaVersion: null,
		installedVersions: [],
		...overrides,
	}
}

function makeStoreVersion(id: string, releaseChannel: 'stable' | 'beta'): ModuleStoreModuleInfoVersion {
	return {
		id,
		releaseChannel,
		releasedAt: 0,
		tarUrl: null,
		tarSha: null,
		deprecationReason: null,
		apiVersion: '1.4.0',
		helpUrl: null,
	}
}

function makeStoreInfo(versions: ModuleStoreModuleInfoVersion[]): ModuleStoreModuleInfoStore {
	return {
		id: 'test',
		moduleType: ModuleInstanceType.Surface,
		lastUpdated: 0,
		lastUpdateAttempt: 0,
		updateWarning: null,
		versions,
	}
}

describe('isSurfaceInstanceLimitReached', () => {
	test('not reached when there are no existing instances', () => {
		const v1 = makeVersion('1.0.0', false)
		expect(isSurfaceInstanceLimitReached(makeInfo({ stableVersion: v1, installedVersions: [v1] }), null, 0)).toBe(false)
	})

	test('not reached when nothing is installed', () => {
		expect(isSurfaceInstanceLimitReached(undefined, null, 1)).toBe(false)
		expect(isSurfaceInstanceLimitReached(makeInfo({}), null, 1)).toBe(false)
	})

	test('reached when no installed version allows multiples', () => {
		const v1 = makeVersion('1.0.0', false)
		const v2 = makeVersion('2.0.0', false)
		expect(isSurfaceInstanceLimitReached(makeInfo({ stableVersion: v2, installedVersions: [v1, v2] }), null, 1)).toBe(
			true
		)
	})

	test('not reached when a non-preferred installed version allows multiples', () => {
		const v1 = makeVersion('1.0.0', true)
		const v2 = makeVersion('2.0.0', false)
		expect(isSurfaceInstanceLimitReached(makeInfo({ stableVersion: v2, installedVersions: [v1, v2] }), null, 1)).toBe(
			false
		)
	})

	test('considers the dev and builtin versions', () => {
		const v1 = makeVersion('1.0.0', false)
		expect(
			isSurfaceInstanceLimitReached(
				makeInfo({ stableVersion: v1, installedVersions: [v1], devVersion: makeVersion('dev', true) }),
				null,
				1
			)
		).toBe(false)
		expect(
			isSurfaceInstanceLimitReached(
				makeInfo({ stableVersion: v1, installedVersions: [v1], builtinVersion: makeVersion('builtin', true) }),
				null,
				1
			)
		).toBe(false)
	})

	test('not reached when the store offers a newer stable version', () => {
		const v1 = makeVersion('1.0.0', false)
		const info = makeInfo({ stableVersion: v1, installedVersions: [v1] })
		expect(isSurfaceInstanceLimitReached(info, makeStoreInfo([makeStoreVersion('2.0.0', 'stable')]), 1)).toBe(false)
	})

	test('not reached when the store offers a beta version', () => {
		const v1 = makeVersion('1.0.0', false)
		const info = makeInfo({ stableVersion: v1, installedVersions: [v1] })
		expect(isSurfaceInstanceLimitReached(info, makeStoreInfo([makeStoreVersion('2.0.0-beta.1', 'beta')]), 1)).toBe(
			false
		)
	})

	test('reached when the store only has versions the selector does not offer', () => {
		const v1 = makeVersion('1.0.0', false)
		const v2 = makeVersion('2.0.0', false)
		const info = makeInfo({ stableVersion: v2, installedVersions: [v1, v2] })
		const storeInfo = makeStoreInfo([
			// Already installed
			makeStoreVersion('2.0.0', 'stable'),
			// Older than the installed stable
			makeStoreVersion('1.5.0', 'stable'),
		])
		expect(isSurfaceInstanceLimitReached(info, storeInfo, 1)).toBe(true)
	})

	test('reached when the newer store version is incompatible', () => {
		const v1 = makeVersion('1.0.0', false)
		const info = makeInfo({ stableVersion: v1, installedVersions: [v1] })
		const incompatible = { ...makeStoreVersion('2.0.0', 'stable'), apiVersion: '99.0.0' }
		expect(isSurfaceInstanceLimitReached(info, makeStoreInfo([incompatible]), 1)).toBe(true)
	})
})
