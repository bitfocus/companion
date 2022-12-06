import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import React, { Component } from 'react'
import { CInput, CButton, CCallout } from '@coreui/react'
import { CloudRegionPanel } from './RegionPanel'
import { CloudUserPass } from './UserPass'

// The cloud part is written in old fashioned Class-components because I am most
// familiar with it

export class Cloud extends Component {
	constructor(props) {
		super(props)

		this.state = {
			enabled: false,
			error: null,
			authenticated: false,
			uuid: '',
			authenticating: false,
		}

		this.regions = {}

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

	cloudStateDidUpdate(newState) {
		console.log('cloud state did update to:', { ...this.state, ...newState })
		this.setState({ ...newState })
	}

	cloudSetState(newState) {
		this.props.socket.emit('cloud_state_set', newState)
	}

	cloudLogin(user, pass) {
		this.props.socket.emit('cloud_login', user, pass)
	}

	shouldComponentUpdate(_nextProps, nextState) {
		const a = JSON.stringify(nextState)
		const b = JSON.stringify(this.state)
		if (a !== b) {
			return true
		}
		return false
	}

	render() {
		const regions = []
		for (let id in this.state.regions) {
			let region = this.state.regions[id]

			regions.push(<CloudRegionPanel key={id} id={region} socket={this.props.socket} />)
		}
		console.log('Render: state:', this.state)
		return (
			<div
				style={{
					maxWidth: 600,
				}}
			>
				<h4>Companion Cloud</h4>
				<p>
					Access the Companion GUI from your Bitfocus Cloud account, or create a sophisticated network of Companion
					installations that work together over the internet for all your remote production needs.
				</p>
				<div
					style={{
						marginBottom: 16,
					}}
				>
					<div>
						When enabled, Companion will make several persistent secure connections to different Bitfocus Cloud regions
						for redundancy. You can learn more about the service, the service provider and the safety of your data{' '}
						<a target="_new" href="https://cloud.bitfocus.io/product/companion-cloud">
							here
						</a>
						.
					</div>
				</div>

				{!this.state.authenticated ? (
					<div>
						<CloudUserPass
							working={this.state.authenticating}
							user={this.state.user}
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
							<label>Logged in as</label>
							<CInput
								readOnly
								type="text"
								style={{
									width: 500,
								}}
								value={this.state.authenticatedAs}
							/>
						</div>

						{this.state.authenticated && <div>{regions}</div>}

						<div style={{ marginTop: 20 }}>
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
									This key should now be online and reachable for companion cloud instances. Go to the connections tab
									in another companion and search for "companion cloud", and add it with the key above to start
									controlling this companion via internet.
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
