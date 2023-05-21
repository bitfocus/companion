import React, { Component } from 'react'
import { CAlert, CListGroupItem, CSwitch } from '@coreui/react'

// The cloud part is written in old fashioned Class-components
// because even if the hipsters say it's slow and retarted, i think it's prettier.

const onlineServerStyle = { color: 'green' }

export class CloudRegionPanel extends Component {
	constructor(props) {
		super(props)

		this.state = {
			connected: false,
			enabled: false,
			error: '',
			name: '',
			pingResults: -1,
		}

		this.cloudStateDidUpdate = this.cloudStateDidUpdate.bind(this)
		this.cloudSetState = this.cloudSetState.bind(this)
	}

	componentDidMount() {
		this.props.socket.on('cloud_region_state', this.cloudStateDidUpdate)
		this.props.socket.emit('cloud_region_state_get', this.props.id)
		console.log(`Mounted CLOUD REGION ${this.props.id}`)
	}

	componentWillUnmount() {
		console.log(`Unmounted CLOUD REGION ${this.props.id}`)
		this.props.socket.off('cloud_region_state', this.cloudStateDidUpdate)
	}

	cloudStateDidUpdate(id, newState) {
		if (id === this.props.id) {
			this.setState({ ...newState })
		}
	}

	cloudSetState(newState) {
		if (!this.props.disabled) {
			this.props.socket.emit('cloud_region_state_set', this.props.id, newState)
			// Reset the error message if the user changes the enabled state
			if (newState.enabled !== undefined) {
				this.setState({ error: '' })
			}
		}
	}

	render() {
		const styleText = {
			marginLeft: 6,
			marginTop: -10,
			display: 'inline-block',
			height: 20,
			paddingTop: 19,
		}

		return !this.props.disabled || this.state.enabled ? (
			<CListGroupItem>
				<span style={{ display: 'inline-block', paddingTop: 5, float: 'left' }}>
					<CSwitch
						color={this.state.connected ? 'success' : 'danger'}
						checked={!!this.state.enabled}
						onChange={(e) => this.cloudSetState({ enabled: e.target.checked })}
						disabled={this.props.disabled}
						width={100}
					/>{' '}
				</span>
				<span
					style={{
						...styleText,
						...(this.state.connected ? onlineServerStyle : this.props.disabled ? { opacity: 0.5 } : {}),
					}}
				>
					{this.state.name} {this.state.pingResults > -1 ? `(${this.state.pingResults}ms)` : ''}
				</span>
				{this.state.enabled && this.state.error !== '' && (
					<CAlert color="danger" style={{ marginTop: '10px', marginBottom: 0 }}>
						{this.state.error}
					</CAlert>
				)}
			</CListGroupItem>
		) : null
	}
}
