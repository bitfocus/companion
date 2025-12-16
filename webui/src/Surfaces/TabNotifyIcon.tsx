import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { observer } from 'mobx-react-lite'
import React, { useContext } from 'react'
import { useMissingVersionsCount } from '~/Instances/MissingVersionsWarning'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export const SurfacesTabNotifyIcon = observer(function SurfacesTabNotifyIcon(): JSX.Element | null {
	const { surfaces, surfaceInstances } = useContext(RootAppStoreContext)

	const updateCount = surfaces.countFirmwareUpdates()
	const missingCount = useMissingVersionsCount(ModuleInstanceType.Surface, surfaceInstances.instances)

	if (updateCount === 0 && missingCount === 0) return null

	const lines = [
		updateCount > 0 ? `${updateCount} surfaces have firmware updates available` : null,
		missingCount > 0 ? `Missing ${missingCount} needed modules` : null,
	].filter(Boolean)

	return (
		<span className="notification-count" title={lines.join(', ')}>
			{updateCount + missingCount}
		</span>
	)
})

export const SurfacesConfiguredTabNotifyIcon = observer(function SurfacesConfiguredTabNotifyIcon(): JSX.Element | null {
	const { surfaces } = useContext(RootAppStoreContext)

	const updateCount = surfaces.countFirmwareUpdates()
	if (updateCount === 0) return null

	return (
		<span className="notification-count" title={`${updateCount} surfaces have firmware updates available`}>
			{updateCount}
		</span>
	)
})

export const SurfacesInstancesTabNotifyIcon = observer(function SurfacesInstancesTabNotifyIcon(): JSX.Element | null {
	const { surfaceInstances } = useContext(RootAppStoreContext)

	const missingCount = useMissingVersionsCount(ModuleInstanceType.Surface, surfaceInstances.instances)
	if (missingCount === 0) return null

	return (
		<span className="notification-count" title={`Missing ${missingCount} needed modules`}>
			{missingCount}
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
