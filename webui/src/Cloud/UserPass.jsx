import React, { Component } from 'react'
import { CButton, CInput } from '@coreui/react'

// The cloud part is written in old fashioned Class-components
// because even if the hipsters say it's slow and retarted, i think it's prettier.

export class CloudUserPass extends Component {
	constructor(props) {
		super(props)

		this.state = {
			username: props.username || '',
			password: '',
		}
	}

	componentDidMount() {}

	componentWillUnmount() {}

	render() {
		return (
			<form
				onSubmit={(e) => {
					e.preventDefault()
					if (this.props.onClearError) {
						console.log('onClearError')
						this.props.onClearError()
					}
					if (this.state.username === '' || this.state.password === '') return
					this.props.onAuth(this.state.username, this.state.password)
				}}
			>
				<div
					style={{
						fontWeight: 'bold',
						marginBottom: 16,
					}}
				>
					<label>Email address</label>
					<CInput
						type="text"
						value={this.state.username}
						onChange={(e) => this.setState({ username: e.target.value })}
						style={{
							width: 500,
						}}
					/>
				</div>
				<div
					style={{
						fontWeight: 'bold',
						marginBottom: 16,
					}}
				>
					<label>Password</label>
					<CInput
						type="password"
						value={this.state.password}
						onChange={(e) => this.setState({ password: e.target.value })}
						style={{
							width: 500,
						}}
					/>
				</div>
				<CButton
					color="success"
					type="submit"
					loading={this.props.working}
					disabled={this.props.working || this.state.username === '' || this.state.password === ''}
				>
					Log in
				</CButton>
			</form>
		)
	}
}
