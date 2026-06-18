import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { useUdevRulesStatus } from '~/Hooks/useUdevRulesStatus'
import { useMissingVersionsCount } from '~/Instances/MissingVersionsWarning'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export const SurfacesTabNotifyIcon = observer(function SurfacesTabNotifyIcon(): JSX.Element | null {
	const { surfaces, surfaceInstances } = useContext(RootAppStoreContext)

	const updateCount = surfaces.countFirmwareUpdates()
	const missingCount = useMissingVersionsCount(ModuleInstanceType.Surface, surfaceInstances.instances)

	const udevStatus = useUdevRulesStatus()
	const udevNeedsApply = !!udevStatus?.supported && udevStatus.needsApply

	const count = updateCount + missingCount + (udevNeedsApply ? 1 : 0)
	if (count === 0) return null

	const lines = [
		updateCount > 0 ? `${updateCount} surfaces have firmware updates available` : null,
		missingCount > 0 ? `Missing ${missingCount} needed modules` : null,
		udevNeedsApply ? `USB permissions need updating` : null,
	].filter(Boolean)

	return (
		<span className="notification-count" title={lines.join(', ')}>
			{count}
		</span>
	)
})

export const ConnectionsTabNotifyIcon = observer(function ConnectionsTabNotifyIcon(): JSX.Element | null {
	const { connections } = useContext(RootAppStoreContext)

	const missingCount = useMissingVersionsCount(ModuleInstanceType.Connection, connections.connections)
	if (missingCount === 0) return null

	return (
		<span className="notification-count" title={`Missing ${missingCount} needed modules`}>
			{missingCount}
		</span>
	)
})
