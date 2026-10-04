import { describe, expect, test } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo, ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
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

describe('isSurfaceInstanceLimitReached', () => {
	test('not reached when there are no existing instances', () => {
		const v1 = makeVersion('1.0.0', false)
		expect(isSurfaceInstanceLimitReached(makeInfo({ stableVersion: v1, installedVersions: [v1] }), 0)).toBe(false)
	})

	test('not reached when nothing is installed', () => {
		expect(isSurfaceInstanceLimitReached(undefined, 1)).toBe(false)
		expect(isSurfaceInstanceLimitReached(makeInfo({}), 1)).toBe(false)
	})

	test('reached when no installed version allows multiples', () => {
		const v1 = makeVersion('1.0.0', false)
		const v2 = makeVersion('2.0.0', false)
		expect(isSurfaceInstanceLimitReached(makeInfo({ stableVersion: v2, installedVersions: [v1, v2] }), 1)).toBe(true)
	})

	test('not reached when a non-preferred installed version allows multiples', () => {
		const v1 = makeVersion('1.0.0', true)
		const v2 = makeVersion('2.0.0', false)
		expect(isSurfaceInstanceLimitReached(makeInfo({ stableVersion: v2, installedVersions: [v1, v2] }), 1)).toBe(false)
	})

	test('considers the dev and builtin versions', () => {
		const v1 = makeVersion('1.0.0', false)
		expect(
			isSurfaceInstanceLimitReached(
				makeInfo({ stableVersion: v1, installedVersions: [v1], devVersion: makeVersion('dev', true) }),
				1
			)
		).toBe(false)
		expect(
			isSurfaceInstanceLimitReached(
				makeInfo({ stableVersion: v1, installedVersions: [v1], builtinVersion: makeVersion('builtin', true) }),
				1
			)
		).toBe(false)
	})
})
