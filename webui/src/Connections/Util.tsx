import { ClientConnectionConfig } from '@companion-app/shared/Model/Common.js'
import { NewClientModuleInfo, NewClientModuleVersionInfo2 } from '@companion-app/shared/Model/ModuleInfo.js'

export function getModuleVersionInfoForConnection(
	moduleInfo: NewClientModuleInfo | null | undefined,
	connection: Pick<ClientConnectionConfig, 'moduleVersionMode' | 'moduleVersionId'>
): NewClientModuleVersionInfo2 | null | undefined {
	switch (connection.moduleVersionMode) {
		case 'stable':
			return moduleInfo?.stableVersion
		case 'prerelease':
			return moduleInfo?.prereleaseVersion
		case 'specific-version':
			return moduleInfo?.installedVersions.find((v) => v.version.id === connection.moduleVersionId)
		default:
			return undefined
	}
}
