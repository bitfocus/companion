import React, { useContext, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

interface ModuleVersionsRefreshProps {
	moduleId: string | null
}
export const ModuleVersionsRefresh = observer(function ModuleVersionsRefresh({ moduleId }: ModuleVersionsRefreshProps) {
	const { socket, moduleStoreRefreshProgress } = useContext(RootAppStoreContext)

	const refreshProgress = (moduleId ? moduleStoreRefreshProgress.get(moduleId) : null) ?? 1

	const doRefreshModules = useCallback(() => {
		if (!moduleId) return
		socket.emitPromise('modules-store:info:refresh', [moduleId]).catch((err) => {
			console.error('Failed to refresh module versions', err)
		})
	}, [moduleId])

	if (refreshProgress === 1) {
		return (
			<div className="float_right" onClick={doRefreshModules}>
				<FontAwesomeIcon icon={faSync} title="Refresh module versions" />
			</div>
		)
	} else {
		return (
			<div className="float_right">
				<FontAwesomeIcon
					icon={faSync}
					spin={true}
					title={`Refreshing module info ${Math.round(refreshProgress * 100)}%`}
				/>
			</div>
		)
	}
})
