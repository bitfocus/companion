import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import React, { Component } from 'react'
import { CInput, CButton, CCallout, CCard, CCardBody, CCardHeader, CListGroup } from '@coreui/react'
import { CloudRegionPanel } from './RegionPanel'
import { CloudUserPass } from './UserPass'
import CSwitch from '../CSwitch'
import type { Socket } from 'socket.io-client'

// The cloud part is written in old fashioned Class-components because I am most
// familiar with it

interface CloudControllerProps {
	socket: Socket
}

interface CloudControllerState {
	uuid: string // the machine UUID
	authenticating: boolean // is the cloud authenticating
	authenticated: boolean // is the cloud authenticated
	authenticatedAs: string | undefined // the cloud username
	ping: boolean // is someone watching ping info?
	regions: string[] // the cloud regions
	error: null | string // the error message
	cloudActive: boolean // is the cloud active
	canActivate: boolean // can the cloud be activated
}

export class Cloud extends Component<CloudControllerProps, CloudControllerState> {
	state = {
		uuid: '',
		authenticating: false,
		authenticated: false,
		authenticatedAs: undefined,
		ping: false,
		regions: [],
		enabled: false,
		error: null,
		cloudActive: false,
		canActivate: false,
	}

	constructor(props: CloudControllerProps) {
		super(props)

		this.cloudStateDidUpdate = this.cloudStateDidUpdate.bind(this)
		this.cloudSetState = this.cloudSetState.bind(this)
	}

	componentDidMount() {
		this.props.socket.on('cloud_state', this.cloudStateDidUpdate)
		this.props.socket.emit('cloud_state_get')
		console.log('Mounted CLOUD')
		this.cloudSetState({ ping: true })
	}

	componentWillUnmount() {
		this.cloudSetState({ ping: false })
		console.log('Unmounted CLOUD')
		this.props.socket.off('cloud_state', this.cloudStateDidUpdate)
	}

	private cloudStateDidUpdate(newState: Partial<CloudControllerState>) {
		console.log('cloud state did update to:', { ...this.state, ...newState })
		this.setState({ ...this.state, ...newState })
	}

	/**
	 * Set a new state for the cloud controller
	 */
	private cloudSetState(newState: Partial<CloudControllerState>) {
		this.props.socket.emit('cloud_state_set', newState)
	}

	private cloudLogin(user: string, pass: string) {
		this.props.socket.emit('cloud_login', user, pass)
	}

	/**
	 * Regenerate the UUID for the cloud controller
	 */
	private cloudRegenerateUUID() {
		this.props.socket.emit('cloud_regenerate_uuid')
	}

	shouldComponentUpdate(_nextProps: CloudControllerProps, nextState: CloudControllerState) {
		const a = JSON.stringify(nextState)
		const b = JSON.stringify(this.state)
		if (a !== b) {
			return true
		}
		return false
	}

	render() {
		const regions = this.state.regions || []

		return (
			<div
				style={{
					maxWidth: 1000,
				}}
			>
				<h4>Companion Cloud</h4>
				<p>
					Access your Companion buttons from your Bitfocus Cloud account, or create a sophisticated network of Companion
					installations that work together over the internet for all your remote production needs.
				</p>
				<div
					style={{
						marginBottom: 16,
					}}
				>
					<div>
						When enabled, Companion will make several persistent secure connections to different Bitfocus Cloud regions
						for redundancy. You can learn more about the service, the service provider and the safety of your data in
						the Companion Cloud documentation{' '}
						<a target="_new" href="https://user.bitfocus.io/docs/companion-cloud">
							here
						</a>
						.
					</div>
				</div>

				{!this.state.authenticated ? (
					<div>
						<CloudUserPass
							working={this.state.authenticating}
							username={this.state.authenticatedAs}
							onAuth={(user, pass) => {
								this.cloudLogin(user, pass)
							}}
							onClearError={() => {
								this.setState({ error: null })
							}}
						/>
						<div
							style={{
								backgroundColor: 'rgba(100,200,0,0.15)',
								display: 'block',
								borderRadius: 4,
								padding: '10px 15px',
								marginTop: 40,
								fontSize: 15,
								fontWeight: 'bold',
								marginBottom: 16,
							}}
						>
							<FontAwesomeIcon icon={faInfoCircle} /> &nbsp;Companion Cloud is a premium service. Learn more and sign up{' '}
							<a target="_new" href="http://bitfocus.io/companion-cloud">
								here
							</a>
							.
						</div>
					</div>
				) : (
					<div>
						<div
							style={{
								fontWeight: 'bold',
								marginBottom: 16,
							}}
						>
							<div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>Logged in as</div>
							<CInput
								readOnly
								type="text"
								style={{
									width: 500,
								}}
								value={this.state.authenticatedAs}
							/>
							{!this.state.cloudActive && (
								<div style={{ marginTop: 10, marginBottom: 20 }}>
									<CButton
										color="success"
										onClick={() => {
											this.setState({ error: null })
											this.props.socket.emit('cloud_logout')
										}}
									>
										Log out
									</CButton>
								</div>
							)}
						</div>
						{this.state.authenticated && (
							<CCard>
								<CCardHeader style={{ backgroundColor: '#eee', fontWeight: 600 }}>Cloud regions</CCardHeader>
								{!this.state.cloudActive ? (
									<CCardBody style={this.state.cloudActive ? { opacity: 0.5 } : {}}>
										Please select the regions that is closest to you. You need to select at least <b>two regions</b>{' '}
										which will give you redundancy.
									</CCardBody>
								) : null}
								<CListGroup flush>
									{regions.map((region) => (
										<CloudRegionPanel
											key={region}
											disabled={this.state.cloudActive}
											id={region}
											socket={this.props.socket}
										/>
									))}
								</CListGroup>
								<CCardBody>
									{this.state.cloudActive ? (
										<CCallout color={this.state.cloudActive ? 'info' : 'success'}>
											<div style={{ fontSize: 14, clear: 'both' }}>
												Companion Cloud is currently activated. Deactivate to change regions.
											</div>
										</CCallout>
									) : null}
									<span style={{ display: 'inline-block', float: 'left' }}>
										<CSwitch
											color="success"
											disabled={!this.state.cloudActive && !this.state.canActivate}
											title="Activate Companion Cloud"
											checked={this.state.cloudActive}
											onChange={(e) => this.cloudSetState({ cloudActive: e.target.checked })}
										/>
									</span>

									<span style={{ marginLeft: 10, fontSize: 15, fontWeight: 'bold' }}>Activate Companion Cloud</span>
								</CCardBody>
							</CCard>
						)}

						{this.state.authenticated && (
							<div style={{ marginTop: 15 }}>
								<div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>Super secret key</div>
								<div
									style={{
										color: 'rgba(50,100,50,0.9)',
										backgroundColor: 'rgba(0,200,0,0.1)',
										display: 'inline-block',
										padding: '4px 8px',
										fontFamily: 'monospace',
										fontWeight: 'bold',
										fontSize: 17,
										border: '1px solid rgba(0,200,0,0.3)',
										borderRadius: 5,
									}}
								>
									{this.state.uuid}
								</div>
								<div style={{ marginTop: 5 }}>
									When you have successfully connected to two or more regions, you can use this key in another remote
									companion to control this companion. Go to the connections tab in another companion and search for
									"companion cloud", and add it with the key above to start controlling this companion via internet.
								</div>
								<div style={{ marginTop: 5 }}>
									<CButton color="primary" onClick={() => this.cloudRegenerateUUID()}>
										Change UUID
									</CButton>
								</div>
							</div>
						)}
					</div>
				)}

				{this.state.error !== null && this.state.error !== '' && (
					<CCallout
						style={{ fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(255,0,0,0.2)', padding: 10 }}
						color="danger"
					>
						{this.state.error}
					</CCallout>
				)}
			</div>
		)
	}
}
