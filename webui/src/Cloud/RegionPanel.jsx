import React, { Component } from 'react'
import { CSwitch } from '@coreui/react'

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
			console.log(`cloud region ${id} state did update to:`, newState)
			this.setState({ ...newState })
		}
	}

	cloudSetState(newState) {
		this.props.socket.emit('cloud_region_state_set', this.props.id, newState)
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
		const styleText = {
			marginLeft: 6,
			marginTop: -10,
			display: 'inline-block',
			height: 20,
			paddingTop: 19,
		}

		return (
			<div style={{ clear: 'both' }}>
				<span style={{ display: 'inline-block', paddingTop: 5, float: 'left' }}>
					<CSwitch
						variant="3d"
						color={this.state.connected ? 'success' : 'danger'}
						checked={!!this.state.enabled}
						onChange={(e) => this.cloudSetState({ enabled: e.target.checked })}
						labelOff={'Off'}
						labelOn={'On'}
						width={100}
					/>{' '}
				</span>
				<span style={{ ...styleText, ...(this.state.connected ? onlineServerStyle : {}) }}>
					{this.state.name} {this.state.pingResults > -1 ? `(${this.state.pingResults}ms)` : ''}
				</span>
				{this.state.error !== '' && (
					<span
						style={{
							backgroundColor: 'red',
							color: 'white',
							padding: '0.2em 0.5em',
							borderRadius: '0.25em',
							margin: '0.5em',
						}}
					>
						{this.state.error}
					</span>
				)}
			</div>
		)
	}
}
