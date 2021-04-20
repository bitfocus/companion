import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import React, { Component } from 'react'
import { CInput, CSwitch, CButton } from '@coreui/react'
import { CloudUserPass } from './UserPass'

// The cloud part is written in old fashioned Class-components
// because even if the hipsters say it's slow and retarted, i think it's prettier.

export class Cloud extends Component {
	constructor(props) {
		super(props)

		this.state = {
			enabled: false,
			error: null,
			authenticated: false,
			secret: '',
			gui: '',
		}

		this.cloudStateDidUpdate = this.cloudStateDidUpdate.bind(this)
		this.cloudSetState = this.cloudSetState.bind(this)
	}

	componentDidMount() {
		this.props.socket.on('cloud_state', this.cloudStateDidUpdate)
		this.props.socket.emit('cloud_state_get')
	}

	componentWillUnmount() {
		this.props.socket.off('cloud_state', this.cloudStateDidUpdate)
	}

	cloudStateDidUpdate(newState) {
		console.log('cloud state did update to:', newState)
		this.setState({ ...newState })
	}

	cloudSetState(newState) {
		this.props.socket.emit('cloud_state_set', newState)
		let localDraft = { ...this.state, ...newState }
		const a = JSON.stringify(localDraft)
		const b = JSON.stringify(this.state)
		if (a !== b) {
			this.setState({ ...newState })
		}
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
		return (
			<div
				style={{
					maxWidth: 600,
				}}
			>
				<div className="clearfix">
					<div
						style={{
							marginTop: 10,
							float: 'left',
						}}
					>
						<CSwitch
							variant="3d"
							color="success"
							checked={!!this.state.enabled}
							onChange={(e) => this.cloudSetState({ enabled: e.target.checked })}
							label="Enable cloud"
							labelOff={'Off'}
							labelOn={'On'}
							width={100}
						/>
					</div>
					<span
						style={{
							float: 'left',
							marginTop: 11,
							marginLeft: 10,
						}}
					>
						<h4>Companion Cloud</h4>
					</span>
				</div>
				<p>
					Access the companion GUI from your Bitfocus Cloud account, or create a sofisticated network of companions that
					work together over the internet for all your remote production needs.
				</p>
				<div
					style={{
						fontWeight: 'bold',
						marginBottom: 16,
					}}
				>
					<div>
						<small>
							When enabled, companion will make two persistent HTTPS connections to Bitfocus Cloud. Learn more about the
							service, the service provider and the safety of your data{' '}
							<a href="http://bitfocus.io/companion-cloud-info">here</a>.
						</small>
					</div>
				</div>
				{!this.state.authenticated ? (
					<CloudUserPass onAuth={(user, pass) => this.props.socket.emit('cloud_login', user, pass)} />
				) : (
					<div>
						<CButton color="success" onClick={() => this.props.socket.emit('cloud_logout')}>
							Log out
						</CButton>
						<div
							style={{
								fontWeight: 'bold',
								marginBottom: 16,
							}}
						>
							<label>Cloud Secret</label>
							<CInput
								readOnly
								type="text"
								style={{
									width: 500,
								}}
								value="lol"
							/>
						</div>

						<div
							style={{
								fontWeight: 'bold',
								marginBottom: 16,
							}}
						>
							<label>Cloud GUI URL</label>
							<CInput
								readOnly
								type="text"
								style={{
									width: 500,
								}}
								value="lol"
							/>
						</div>
					</div>
				)}
				<div
					style={{
						backgroundColor: 'rgba(100,200,0,0.15)',
						display: 'inline-block',
						borderRadius: 4,
						padding: '10px 15px',
						marginTop: 40,
						fontSize: 15,
						fontWeight: 'bold',
						marginBottom: 16,
					}}
				>
					<FontAwesomeIcon icon={faInfoCircle} /> &nbsp;Companion Cloud is a premium service. Learn more and sign up{' '}
					<a href="http://bitfocus.io/companion-cloud">here</a>.
				</div>
			</div>
		)
	}
}
