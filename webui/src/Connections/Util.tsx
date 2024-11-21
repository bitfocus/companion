import type { NewClientModuleInfo, NewClientModuleVersionInfo2 } from '@companion-app/shared/Model/ModuleInfo.js'

export function getModuleVersionInfoForConnection(
	moduleInfo: NewClientModuleInfo | null | undefined,
	moduleVersionId: string | null
): NewClientModuleVersionInfo2 | null | undefined {
	if (moduleVersionId === null) return null
	if (moduleVersionId === 'dev') return moduleInfo?.devVersion

	return moduleInfo?.installedVersions.find((v) => v.versionId === moduleVersionId)
}
