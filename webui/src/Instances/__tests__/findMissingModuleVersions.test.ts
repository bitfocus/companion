import { describe, expect, it } from 'vitest'
import type { ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo, ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { findMissingModuleVersions } from '../MissingVersionsWarning.js'

function instance(moduleId: string, moduleVersionId: string | null): ClientInstanceConfigBase {
	return { moduleId, moduleVersionId } as ClientInstanceConfigBase
}

function version(versionId: string): ClientModuleVersionInfo {
	return { versionId } as ClientModuleVersionInfo
}

function moduleInfo(info: Partial<ClientModuleInfo>): ClientModuleInfo {
	return { devVersion: null, builtinVersion: null, installedVersions: [], ...info } as ClientModuleInfo
}

describe('findMissingModuleVersions', () => {
	it('finds nothing when every version is available', () => {
		const modules: Record<string, ClientModuleInfo> = {
			store: moduleInfo({ installedVersions: [version('1.0.0')] }),
			local: moduleInfo({ devVersion: version('dev') }),
			shipped: moduleInfo({ builtinVersion: version('builtin') }),
		}

		const result = findMissingModuleVersions(
			[instance('store', '1.0.0'), instance('local', 'dev'), instance('shipped', 'builtin')],
			(id) => modules[id]
		)

		expect(result).toEqual({ installable: 0, notLoaded: [] })
	})

	it('counts store versions that are not installed, or not chosen yet, as installable', () => {
		const modules: Record<string, ClientModuleInfo> = {
			store: moduleInfo({ installedVersions: [version('1.0.0')] }),
		}

		const result = findMissingModuleVersions(
			[instance('store', '2.0.0'), instance('unknown', '1.0.0'), instance('store', null)],
			(id) => modules[id]
		)

		expect(result).toEqual({ installable: 3, notLoaded: [] })
	})

	it('reports dev and builtin versions that are not loaded as not installable, once per module', () => {
		const result = findMissingModuleVersions(
			[instance('local', 'dev'), instance('local', 'dev'), instance('shipped', 'builtin')],
			() => undefined
		)

		expect(result).toEqual({
			installable: 0,
			notLoaded: [
				{ moduleId: 'local', versionId: 'dev' },
				{ moduleId: 'shipped', versionId: 'builtin' },
			],
		})
	})

	it('does not treat an installed store version as a loaded dev version', () => {
		const modules: Record<string, ClientModuleInfo> = {
			local: moduleInfo({ installedVersions: [version('1.0.0')] }),
		}

		const result = findMissingModuleVersions([instance('local', 'dev')], (id) => modules[id])

		expect(result).toEqual({ installable: 0, notLoaded: [{ moduleId: 'local', versionId: 'dev' }] })
	})
})
