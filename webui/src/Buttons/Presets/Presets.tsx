import React, { useContext, useEffect, useMemo, useState } from 'react'
import { CRow } from '@coreui/react'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { PresetsButtonList } from './PresetsButtonList.js'
import { PresetsConnectionList } from './PresetsConnectionList.js'
import { PresetsCategoryList } from './PresetsCategoryList.js'
import { PresetDefinitionsStore, usePresetsDefinitions } from './PresetDefinitionsStore.js'

interface ConnectionPresetsProps {
	resetToken: string
}

export const ConnectionPresets = observer(function ConnectionPresets({ resetToken }: ConnectionPresetsProps) {
	const { modules, connections } = useContext(RootAppStoreContext)

	const [connectionAndCategory, setConnectionAndCategory] = useState<
		[connectionId: string | null, category: string | null]
	>([null, null])

	const presetsDefinitionsStore = useMemo(() => new PresetDefinitionsStore(), [])

	const { isReady, loadError, restartSub } = usePresetsDefinitions(presetsDefinitionsStore)

	// Reset selection on resetToken change
	useEffect(() => {
		setConnectionAndCategory([null, null])
	}, [resetToken])

	if (!isReady) {
		// Show loading or an error
		return (
			<CRow>
				<LoadingRetryOrError error={loadError} dataReady={false} doRetry={restartSub} design="pulse" />
			</CRow>
		)
	}

	if (connectionAndCategory[0]) {
		const connectionInfo = connections.getInfo(connectionAndCategory[0])
		const moduleInfo = connectionInfo ? modules.modules.get(connectionInfo.instance_type) : undefined

		const presets = presetsDefinitionsStore.presets.get(connectionAndCategory[0])

		if (connectionAndCategory[1]) {
			return (
				<PresetsButtonList
					presets={presets}
					selectedConnectionId={connectionAndCategory[0]}
					selectedConnectionLabel={connectionInfo?.label || connectionAndCategory[0]}
					selectedCategory={connectionAndCategory[1]}
					setConnectionAndCategory={setConnectionAndCategory}
				/>
			)
		} else {
			return (
				<PresetsCategoryList
					presets={presets}
					connectionInfo={connectionInfo}
					moduleInfo={moduleInfo}
					selectedConnectionId={connectionAndCategory[0]}
					setConnectionAndCategory={setConnectionAndCategory}
				/>
			)
		}
	} else {
		return (
			<PresetsConnectionList
				presetsDefinitionsStore={presetsDefinitionsStore}
				setConnectionAndCategory={setConnectionAndCategory}
			/>
		)
	}
})
