import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { assertNever } from '@companion-app/shared/Util.js'
import { Grid } from '~/Components/Grid'
import './Presets.css'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { LinkPresetsPages } from './LinkPresetsPages.js'
import { PresetDefinitionsStore, usePresetsDefinitions } from './PresetDefinitionsStore.js'
import { PresetsConnectionList } from './PresetsConnectionList.js'
import { PresetsSectionsList } from './PresetsSectionsList.js'

/** What the presets are being chosen from: a connection, or another installation (as remote buttons) */
type PresetsSelection = { kind: 'connection'; connectionId: string } | { kind: 'installation'; peerId: string }

interface ConnectionPresetsProps {
	resetToken: string
}

export const ConnectionPresets = observer(function ConnectionPresets({ resetToken }: ConnectionPresetsProps) {
	const { connections } = useContext(RootAppStoreContext)

	const [selection, setSelection] = useState<PresetsSelection | null>(null)
	const clearSelection = useCallback(() => setSelection(null), [])
	const selectConnection = useCallback((connectionId: string) => setSelection({ kind: 'connection', connectionId }), [])
	const selectInstallation = useCallback((peerId: string) => setSelection({ kind: 'installation', peerId }), [])

	const presetsDefinitionsStore = useMemo(() => new PresetDefinitionsStore(), [])

	const { isReady, loadError, restartSub } = usePresetsDefinitions(presetsDefinitionsStore)

	// Reset selection on resetToken change
	useEffect(() => {
		setSelection(null)
	}, [resetToken])

	if (!isReady) {
		// Show loading or an error
		return (
			<Grid.Row>
				<LoadingRetryOrError error={loadError} dataReady={false} doRetry={restartSub} design="pulse" />
			</Grid.Row>
		)
	}

	switch (selection?.kind) {
		case 'connection': {
			const { connectionId } = selection
			return (
				<PresetsSectionsList
					key={connectionId}
					presets={presetsDefinitionsStore.presets.get(connectionId)}
					connectionInfo={connections.getInfo(connectionId)}
					selectedConnectionId={connectionId}
					clearSelectedConnectionId={clearSelection}
				/>
			)
		}
		case 'installation':
			return <LinkPresetsPages key={selection.peerId} peerId={selection.peerId} clearSelection={clearSelection} />
		case undefined:
			return (
				<PresetsConnectionList
					presetsDefinitionsStore={presetsDefinitionsStore}
					setConnectionId={selectConnection}
					setPeerId={selectInstallation}
				/>
			)
		default:
			assertNever(selection)
			return null
	}
})
