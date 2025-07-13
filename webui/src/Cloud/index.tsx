import React, { memo, useState } from 'react'
import {
	CFormInput,
	CButton,
	CCallout,
	CCard,
	CCardBody,
	CCardHeader,
	CListGroup,
	CFormSwitch,
	CAlert,
	CCol,
	CFormLabel,
} from '@coreui/react'
import { CloudRegionPanel } from './RegionPanel.js'
import { CloudUserPass } from './UserPass.js'
import { LoadingRetryOrError } from '~/util.js'
import { CloudControllerState } from '@companion-app/shared/Model/Cloud.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc, useMutationExt } from '~/TRPC.js'

export function CloudPage(): React.JSX.Element {
	const cloudState = useCloudState()

	return (
		<div className="cloud-region-panel">
			<h4>Companion Cloud</h4>

			<CAlert color="danger">
				This service is deprecated and will be removed in a future version of Companion. <br />
				We hope that before it is removed, an equivalent system will be made available in <i>Bitfocus Buttons</i> <br />
				As an alternative you can use the new <i>companion-satellite</i> module over a local network or vpn.
			</CAlert>
			<p>
				Access your Companion buttons from your Bitfocus Cloud account, or create a sophisticated network of Companion
				installations that work together over the internet for all your remote production needs.
			</p>
			<p>
				When enabled, Companion will make several persistent secure connections to different Bitfocus Cloud regions for
				redundancy. You can learn more about the service, the service provider and the safety of your data in the
				Companion Cloud documentation{' '}
				<a target="_blank" href="https://user.bitfocus.io/docs/companion-cloud">
					here
				</a>
				.
			</p>

			{cloudState ? (
				<CloudPageContent cloudState={cloudState} />
			) : (
				<LoadingRetryOrError dataReady={false} design="pulse" />
			)}
		</div>
	)
}

function useCloudState() {
	const [cloudState, setCloudState] = useState<CloudControllerState | null>(null)

	useSubscription(
		trpc.cloud.watchState.subscriptionOptions(undefined, {
			onStarted: () => {
				console.log('Started cloud state subscription')
				setCloudState(null)
			},
			onData: (newState) => {
				setCloudState(newState)
			},
			onError: (err) => {
				console.error('Error in cloud state subscription', err)
				setCloudState(null)
			},
		})
	)

	return cloudState
}

function CloudPageContent({ cloudState }: { cloudState: CloudControllerState }) {
	return (
		<>
			{!!cloudState.error && <CAlert color="danger">{cloudState.error}</CAlert>}

			{!cloudState.authenticated ? (
				<CloudUserPass
					working={cloudState.authenticating}
					username={cloudState.authenticatedAs}
					onClearError={() => {
						// TODO: reimplement
						// this.setState({ error: null })
					}}
				/>
			) : (
				<>
					<AuthState
						authenticatedAs={cloudState.authenticatedAs}
						cloudActive={cloudState.cloudActive}
						clearError={() => {
							// TODO: reimplement
							// this.setState({ error: null })
						}}
					/>

					<RegionsList
						regionIds={cloudState.regions || []}
						cloudActive={cloudState.cloudActive}
						canActivate={cloudState.canActivate}
					/>

					<SecretKeyPanel uuid={cloudState.uuid} />
				</>
			)}
		</>
	)
}

interface AuthStateProps {
	authenticatedAs: string | undefined
	cloudActive: boolean
	clearError: () => void
}

function AuthState({ authenticatedAs, cloudActive, clearError }: AuthStateProps) {
	const logoutMutation = useMutationExt(trpc.cloud.logout.mutationOptions())

	return (
		<CCol sm={6} className="cloud-auth-state">
			<CFormLabel>Logged in as</CFormLabel>
			<CFormInput readOnly type="text" value={authenticatedAs} />
			{!cloudActive && (
				<p>
					<CButton
						color="success"
						onClick={() => {
							clearError()
							logoutMutation.mutate()
						}}
					>
						Log out
					</CButton>
				</p>
			)}
		</CCol>
	)
}

interface RegionsListProps {
	regionIds: string[]
	cloudActive: boolean
	canActivate: boolean
}

function RegionsList({ regionIds, cloudActive, canActivate }: RegionsListProps) {
	const setCloudActiveMutation = useMutationExt(trpc.cloud.setCloudActive.mutationOptions())

	return (
		<CCol sm={12}>
			<CCard>
				<CCardHeader>Cloud regions</CCardHeader>

				{!cloudActive && (
					<CCardBody>
						Please select the regions that is closest to you. You need to select at least <b>two regions</b> which will
						give you redundancy.
					</CCardBody>
				)}

				<CListGroup flush>
					{regionIds.map((regionId) => (
						<CloudRegionPanel key={regionId} hideDisabled={cloudActive} regionId={regionId} />
					))}
				</CListGroup>

				<CCardBody>
					{cloudActive && (
						<CCallout color={'info'}>Companion Cloud is currently activated. Deactivate to change regions.</CCallout>
					)}

					<CFormSwitch
						label="Activate Companion Cloud"
						color="success"
						disabled={!cloudActive && !canActivate}
						title="Activate Companion Cloud"
						checked={cloudActive}
						onChange={(e) => setCloudActiveMutation.mutate({ active: !!e.target.checked })}
					/>
				</CCardBody>
			</CCard>
		</CCol>
	)
}

const SecretKeyPanel = memo(function SecretKeyPanel({ uuid }: { uuid: string }) {
	const regenerateUUIDMutation = useMutationExt(trpc.cloud.regenerateUUID.mutationOptions())

	return (
		<CCol sm={12} className="super-secret-key">
			<h5>Super secret key</h5>

			<p>
				When you have successfully connected to two or more regions, you can use this key in another remote companion to
				control this companion. Go to the connections tab in another companion and search for "companion cloud", and add
				it with the key above to start controlling this companion via internet.
			</p>

			<CAlert color="success">{uuid}</CAlert>

			<p>
				<CButton color="primary" onClick={() => regenerateUUIDMutation.mutate()}>
					Regenerate secret key
				</CButton>
			</p>
		</CCol>
	)
})
