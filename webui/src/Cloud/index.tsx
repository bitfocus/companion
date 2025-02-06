import React, { memo, useContext, useEffect, useState } from 'react'
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
import { SocketContext, type CompanionSocketWrapped, LoadingRetryOrError } from '../util.js'
import { CloudControllerState } from '@companion-app/shared/Model/Cloud.js'

export function CloudPage() {
	const socket = useContext(SocketContext)

	const cloudState = useCloudState(socket)

	return (
		<div className="cloud-region-panel">
			<h4>Companion Cloud</h4>
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

			{cloudState ? <CloudPageContent cloudState={cloudState} /> : <LoadingRetryOrError dataReady={false} />}
		</div>
	)
}

function useCloudState(socket: CompanionSocketWrapped) {
	const [cloudState, setCloudState] = useState<CloudControllerState>()

	useEffect(() => {
		const unsubUpdates = socket.on('cloud_state', (newState) => {
			setCloudState(newState)
		})
		socket.emit('cloud_state_get')
		console.log('Mounted CLOUD')
		socket.emit('cloud_state_set', { ping: true })

		return () => {
			socket.emit('cloud_state_set', { ping: false })
			console.log('Unmounted CLOUD')
			unsubUpdates()
		}
	}, [socket])

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
	const socket = useContext(SocketContext)

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
							socket.emit('cloud_logout')
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
	const socket = useContext(SocketContext)

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
						onChange={(e) => socket.emit('cloud_state_set', { cloudActive: !!e.target.checked })}
					/>
				</CCardBody>
			</CCard>
		</CCol>
	)
}

const SecretKeyPanel = memo(function SecretKeyPanel({ uuid }: { uuid: string }) {
	const socket = useContext(SocketContext)

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
				<CButton color="primary" onClick={() => socket.emit('cloud_regenerate_uuid')}>
					Regenerate secret key
				</CButton>
			</p>
		</CCol>
	)
})
