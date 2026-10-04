import { useContext } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { useUdevRulesStatus } from '~/Hooks/useUdevRulesStatus'
import { useMissingVersionsCount } from '~/Instances/MissingVersionsWarning'
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
	const missingCount = useMissingVersionsCount(ModuleInstanceType.Surface, surfaceInstances.instances)

	const udevStatus = useUdevRulesStatus()
	const udevNeedsApply = !!udevStatus?.supported && udevStatus.needsApply

	return {
		count: updateCount + missingCount + (udevNeedsApply ? 1 : 0),
		lines: [
			updateCount > 0 ? `${updateCount} surfaces have firmware updates available` : null,
			missingCount > 0 ? `Missing ${missingCount} needed modules` : null,
			udevNeedsApply ? `USB permissions need updating` : null,
		].filter((line) => line !== null),
	}
}

/** What needs attention on the connections page. Must be called from an `observer` component. */
export function useConnectionsNotifications(): TabNotifications {
	const { connections } = useContext(RootAppStoreContext)

	const missingCount = useMissingVersionsCount(ModuleInstanceType.Connection, connections.connections)

	return {
		count: missingCount,
		lines: missingCount > 0 ? [`Missing ${missingCount} needed modules`] : [],
	}
}
