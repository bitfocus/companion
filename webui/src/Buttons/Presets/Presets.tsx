import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CRow } from '@coreui/react'
import { LoadingRetryOrError, applyPatchOrReplaceSubObject } from '~/util.js'
import { nanoid } from 'nanoid'
import type { UIPresetDefinition } from '@companion-app/shared/Model/Presets.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { PresetsButtonList } from './PresetsButtonList.js'
import { PresetsConnectionList } from './PresetsConnectionList.js'
import { PresetsCategoryList } from './PresetsCategoryList.js'

interface ConnectionPresetsProps {
	resetToken: string
}

export const ConnectionPresets = observer(function ConnectionPresets({ resetToken }: ConnectionPresetsProps) {
	const { socket, modules, connections } = useContext(RootAppStoreContext)

	const [connectionAndCategory, setConnectionAndCategory] = useState<
		[connectionId: string | null, category: string | null]
	>([null, null])
	const [presetsMap, setPresetsMap] = useState<Record<string, Record<string, UIPresetDefinition> | undefined> | null>(
		null
	)
	const [presetsError, setPresetsError] = useState<string | null>(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const doRetryPresetsLoad = useCallback(() => setReloadToken(nanoid()), [])

	// Reset selection on resetToken change
	useEffect(() => {
		setConnectionAndCategory([null, null])
	}, [resetToken])

	useEffect(() => {
		setPresetsMap(null)
		setPresetsError(null)

		socket
			.emitPromise('presets:subscribe', [])
			.then((data) => {
				console.log('presets:subscribe', data)
				setPresetsMap(data)
			})
			.catch((e) => {
				console.error('Failed to load presets', e)
				setPresetsError('Failed to load presets')
			})

		const unsubUpdates = socket.on('presets:update', (id, patch) => {
			setPresetsMap((oldPresets) =>
				oldPresets
					? applyPatchOrReplaceSubObject<Record<string, UIPresetDefinition> | undefined>(oldPresets, id, patch, {})
					: null
			)
		})

		return () => {
			unsubUpdates()

			socket.emitPromise('presets:unsubscribe', []).catch(() => {
				console.error('Failed to unsubscribe to presets')
			})
		}
	}, [socket, reloadToken])

	if (!presetsMap) {
		// Show loading or an error
		return (
			<CRow>
				<LoadingRetryOrError error={presetsError} dataReady={false} doRetry={doRetryPresetsLoad} design="pulse" />
			</CRow>
		)
	}

	if (connectionAndCategory[0]) {
		const connectionInfo = connections.getInfo(connectionAndCategory[0])
		const moduleInfo = connectionInfo ? modules.modules.get(connectionInfo.instance_type) : undefined

		const presets = presetsMap[connectionAndCategory[0]] ?? {}

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
		return <PresetsConnectionList presets={presetsMap} setConnectionAndCategory={setConnectionAndCategory} />
	}
})
