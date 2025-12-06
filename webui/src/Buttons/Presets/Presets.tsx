import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CRow } from '@coreui/react'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { PresetsConnectionList } from './PresetsConnectionList.js'
import { PresetsCategoryList } from './PresetsCategoryList.js'
import { PresetDefinitionsStore, usePresetsDefinitions } from './PresetDefinitionsStore.js'

interface ConnectionPresetsProps {
	resetToken: string
}

export const ConnectionPresets = observer(function ConnectionPresets({ resetToken }: ConnectionPresetsProps) {
	const { modules, connections } = useContext(RootAppStoreContext)

	const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
	const clearSelectedConnectionId = useCallback(() => {
		setSelectedConnectionId(null)
	}, [])

	const presetsDefinitionsStore = useMemo(() => new PresetDefinitionsStore(), [])

	const { isReady, loadError, restartSub } = usePresetsDefinitions(presetsDefinitionsStore)

	// Reset selection on resetToken change
	useEffect(() => {
		setSelectedConnectionId(null)
	}, [resetToken])

	if (!isReady) {
		// Show loading or an error
		return (
			<CRow>
				<LoadingRetryOrError error={loadError} dataReady={false} doRetry={restartSub} design="pulse" />
			</CRow>
		)
	}

	if (selectedConnectionId) {
		const connectionInfo = connections.getInfo(selectedConnectionId)
		const moduleInfo = connectionInfo
			? modules.getModuleInfo(connectionInfo.moduleType, connectionInfo.moduleId)
			: undefined

		const presets = presetsDefinitionsStore.presets.get(selectedConnectionId)

		return (
			<PresetsCategoryList
				key={selectedConnectionId}
				presets={presets}
				connectionInfo={connectionInfo}
				moduleInfo={moduleInfo}
				selectedConnectionId={selectedConnectionId}
				clearSelectedConnectionId={clearSelectedConnectionId}
			/>
		)
	} else {
		return (
			<PresetsConnectionList
				presetsDefinitionsStore={presetsDefinitionsStore}
				setConnectionId={setSelectedConnectionId}
			/>
		)
	}
})
