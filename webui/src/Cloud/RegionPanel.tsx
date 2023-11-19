import React, { Component } from 'react'
import { CAlert, CListGroupItem, CSwitch } from '@coreui/react'
import type { Socket } from 'socket.io-client'

// The cloud part is written in old fashioned Class-components
// because even if the hipsters say it's slow and retarted, i think it's prettier.

const onlineServerStyle: React.CSSProperties = { color: 'green' }

interface CloudRegionPanelProps {
	socket: Socket
	id: string
	disabled: boolean
}
interface CloudRegionPanelState {
	connected: boolean
	enabled: boolean
	error: string | null
	name: string
	pingResults: number
}

export class CloudRegionPanel extends Component<CloudRegionPanelProps, CloudRegionPanelState> {
	constructor(props: CloudRegionPanelProps) {
		super(props)

		this.state = {
			connected: false,
			enabled: false,
			error: null,
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

	private cloudStateDidUpdate(id: string, newState: CloudRegionPanelState) {
		if (id === this.props.id) {
			this.setState({ ...newState })
		}
	}

	private cloudSetState(newState: Partial<CloudRegionPanelState>) {
		if (!this.props.disabled) {
			this.props.socket.emit('cloud_region_state_set', this.props.id, newState)
			// Reset the error message if the user changes the enabled state
			if (newState.enabled !== undefined) {
				this.setState({ error: null })
			}
		}
	}

	render() {
		const styleText: React.CSSProperties = {
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
						onChange={(e) => this.cloudSetState({ enabled: e.currentTarget.checked })}
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
				{this.state.enabled && this.state.error && (
					<CAlert color="danger" style={{ marginTop: '10px', marginBottom: 0 }}>
						{this.state.error}
					</CAlert>
				)}
			</CListGroupItem>
		) : null
	}
}
