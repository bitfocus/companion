import type { ClientModuleInfo, ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'

/** The version a module is described by: dev first, to highlight pending changes, then by stability. */
export function getPreferredModuleVersion(info: ClientModuleInfo | null | undefined): ClientModuleVersionInfo | null {
	return info?.devVersion ?? info?.stableVersion ?? info?.betaVersion ?? info?.builtinVersion ?? null
}

/** Whether any version of the module can be used without installing one first. */
export function isModuleInstalled(info: ClientModuleInfo | null | undefined): boolean {
	return !!info && (info.installedVersions.length > 0 || !!info.devVersion || !!info.builtinVersion)
}

export type ModuleInstallationKind = 'Development' | 'Installed' | 'Built-in' | 'Available'

export function getModuleInstallationKind(info: ClientModuleInfo | null | undefined): ModuleInstallationKind {
	if (info?.devVersion) return 'Development'
	if (info?.installedVersions.length) return 'Installed'
	if (info?.builtinVersion) return 'Built-in'
	return 'Available'
}

/** "3 versions" or "v1.2.3". Nothing for a dev or built-in module, which its installation kind already says. */
export function getModuleVersionLabel(info: ClientModuleInfo | null | undefined): string | undefined {
	if (!info || info.devVersion) return undefined
	if (info.installedVersions.length > 1) return `${info.installedVersions.length} versions`

	const version = getPreferredModuleVersion(info)
	if (!version || version === info.builtinVersion) return undefined
	return `v${version.versionId}`
}
