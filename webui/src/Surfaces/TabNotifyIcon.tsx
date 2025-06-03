import { observer } from 'mobx-react-lite'
import React, { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export const SurfacesTabNotifyIcon = observer(function SurfacesTabNotifyIcon(): JSX.Element | null {
	const { surfaces } = useContext(RootAppStoreContext)

	const updateCount = surfaces.countFirmwareUpdates()
	if (updateCount === 0) return null

	return (
		<span className="notification-count" title={`${updateCount} surfaces have firmware updates available`}>
			{updateCount}
		</span>
	)
})
