import { useContext } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { useUdevRulesStatus } from '~/Hooks/useUdevRulesStatus'
import { useMissingModuleVersions, type MissingModuleVersions } from '~/Instances/MissingVersionsWarning'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export interface TabNotifications {
	count: number
	/** One line per kind of problem, to explain the count */
	lines: string[]
}

/** What needs attention on the surfaces page. Must be called from an `observer` component. */
export function useSurfacesNotifications(): TabNotifications {
	const { surfaces, surfaceInstances } = useContext(RootAppStoreContext)

	const updateCount = surfaces.countFirmwareUpdates()
	const missing = useMissingModuleVersions(ModuleInstanceType.Surface, surfaceInstances.instances)

	const udevStatus = useUdevRulesStatus()
	const udevNeedsApply = !!udevStatus?.supported && udevStatus.needsApply

	return {
		count: updateCount + missingModulesCount(missing) + (udevNeedsApply ? 1 : 0),
		lines: [
			updateCount > 0 ? `${updateCount} surfaces have firmware updates available` : null,
			...missingModulesLines(missing),
			udevNeedsApply ? `USB permissions need updating` : null,
		].filter((line) => line !== null),
	}
}

/** What needs attention on the connections page. Must be called from an `observer` component. */
export function useConnectionsNotifications(): TabNotifications {
	const { connections } = useContext(RootAppStoreContext)

	const missing = useMissingModuleVersions(ModuleInstanceType.Connection, connections.connections)

	return {
		count: missingModulesCount(missing),
		lines: missingModulesLines(missing),
	}
}

function missingModulesCount(missing: MissingModuleVersions): number {
	return missing.installable + missing.notLoaded.length
}

function missingModulesLines(missing: MissingModuleVersions): string[] {
	return [
		missing.installable > 0 ? `Missing ${missing.installable} needed modules` : null,
		missing.notLoaded.length > 0 ? `${missing.notLoaded.length} dev or built-in modules not loaded` : null,
	].filter((line) => line !== null)
}
