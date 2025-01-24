import type { ClientModuleInfo, ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'

export function getModuleVersionInfoForConnection(
	moduleInfo: ClientModuleInfo | null | undefined,
	moduleVersionId: string | null
): ClientModuleVersionInfo | null | undefined {
	if (moduleVersionId === null) return null
	if (moduleVersionId === 'dev') return moduleInfo?.devVersion

	return moduleInfo?.installedVersions.find((v) => v.versionId === moduleVersionId)
}
