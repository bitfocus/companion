import { CAlert, CListGroupItem } from '@coreui/react'
import { useSubscription } from '@trpc/tanstack-react-query'
import classNames from 'classnames'
import { useCallback, useState } from 'react'
import type { CloudRegionState } from '@companion-app/shared/Model/Cloud.js'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { trpc, useMutationExt } from '~/Resources/TRPC'

interface CloudRegionPanelProps {
	regionId: string
	hideDisabled: boolean
}

export function CloudRegionPanel({ regionId, hideDisabled }: CloudRegionPanelProps): React.JSX.Element | null {
	const setEnabledMutation = useMutationExt(trpc.cloud.setRegionEnabled.mutationOptions())

	const cloudSetStateEnabled = useCallback(
		(enabled: boolean) => {
			if (!hideDisabled) {
				setEnabledMutation.mutate({
					regionId,
					enabled,
				})

				// 	// Reset the error message if the user changes the enabled state
				// 	if (newState.enabled !== undefined) {
				// 		this.setState({ error: null })
				// 	}
			}
		},
		[setEnabledMutation, regionId, hideDisabled]
	)

	const regionState = useRegionState(regionId)
	if (!regionState || (hideDisabled && !regionState.enabled)) return null

	return (
		<CListGroupItem className="cloud-region-item">
			<p
				className={classNames('cloud-region-text', {
					online: regionState.connected,
				})}
			>
				<SwitchInputField value={!!regionState.enabled} setValue={cloudSetStateEnabled} disabled={hideDisabled} small />{' '}
				{regionState.name} {regionState.pingResults > -1 ? `(${regionState.pingResults}ms)` : ''}
			</p>

			{regionState.enabled && regionState.error && <CAlert color="danger">{regionState.error}</CAlert>}
		</CListGroupItem>
	)
}

function useRegionState(regionId: string) {
	const [regionState, setRegionState] = useState<CloudRegionState | null>(null)

	useSubscription(
		trpc.cloud.watchRegionState.subscriptionOptions(
			{
				regionId,
			},
			{
				onStarted: () => {
					console.log(`Started watching region state for ${regionId}`)
					setRegionState(null)
				},
				onData: (data) => {
					setRegionState(data)
				},
				onError: (error) => {
					console.error(`Error watching region state for ${regionId}:`, error)
					setRegionState(null)
				},
			}
		)
	)

	return regionState
}
