import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CAlert, CFormSwitch, CListGroupItem } from '@coreui/react'
import { SocketContext, type CompanionSocketWrapped } from '../util.js'
import { CloudRegionState } from '@companion-app/shared/Model/Cloud.js'
import classNames from 'classnames'

interface CloudRegionPanelProps {
	regionId: string
	hideDisabled: boolean
}

export function CloudRegionPanel({ regionId, hideDisabled }: CloudRegionPanelProps) {
	const socket = useContext(SocketContext)

	const cloudSetStateEnabled = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const enabled = !!e.currentTarget.checked
			if (!hideDisabled) {
				socket.emit('cloud_region_state_set', regionId, { enabled })

				// 	// Reset the error message if the user changes the enabled state
				// 	if (newState.enabled !== undefined) {
				// 		this.setState({ error: null })
				// 	}
			}
		},
		[socket, regionId, hideDisabled]
	)

	const regionState = useRegionState(socket, regionId)
	if (!regionState || (hideDisabled && !regionState.enabled)) return null

	return (
		<CListGroupItem className="cloud-region-item">
			<p
				className={classNames('cloud-region-text', {
					online: regionState.connected,
				})}
			>
				<CFormSwitch
					color={regionState.connected ? 'success' : 'danger'}
					checked={!!regionState.enabled}
					onChange={cloudSetStateEnabled}
					disabled={hideDisabled}
					width={100}
				/>{' '}
				{regionState.name} {regionState.pingResults > -1 ? `(${regionState.pingResults}ms)` : ''}
			</p>

			{regionState.enabled && regionState.error && <CAlert color="danger">{regionState.error}</CAlert>}
		</CListGroupItem>
	)
}

function useRegionState(socket: CompanionSocketWrapped, regionId: string) {
	const [regionState, setRegionState] = useState<CloudRegionState>()

	useEffect(() => {
		console.log(`Mounted CLOUD REGION ${regionId}`)
		const unsubUpdates = socket.on('cloud_region_state', (updateRegionId, newState) => {
			if (regionId === updateRegionId) {
				setRegionState(newState)
			}
		})
		socket.emit('cloud_region_state_get', regionId)

		return () => {
			console.log(`Unmounted CLOUD REGION ${regionId}`)
			unsubUpdates()
		}
	}, [socket, regionId])

	return regionState
}
