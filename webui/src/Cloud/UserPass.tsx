import React, { memo, useContext, useState } from 'react'
import { CAlert, CButton, CCol, CForm, CFormInput, CFormLabel, CRow } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { SocketContext } from '../util.js'

interface CloudUserPassProps {
	username: string | undefined
	working: boolean
	onClearError?: () => void
}

export const CloudUserPass = memo(function CloudUserPass({
	username: defaultUsername,
	working,
	onClearError,
}: CloudUserPassProps) {
	const socket = useContext(SocketContext)
	const [username, setUsername] = useState(defaultUsername || '')
	const [password, setPassword] = useState('')

	return (
		<CForm
			className="cloud-auth-form"
			onSubmit={(e) => {
				e.preventDefault()

				if (onClearError) {
					console.log('onClearError')
					onClearError()
				}

				if (username === '' || password === '') return

				socket.emit('cloud_login', username, password)
			}}
		>
			<CRow>
				<CCol sm={6}>
					<CFormLabel>Email address</CFormLabel>
					<CFormInput type="text" value={username} onChange={(e) => setUsername(e.currentTarget.value)} />
				</CCol>
				<CCol sm={6}></CCol>

				<CCol sm={6}>
					<CFormLabel>Password</CFormLabel>
					<CFormInput type="password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
				</CCol>
				<CCol sm={6}></CCol>

				<CCol sm={6}>
					<CButton color="success" type="submit" disabled={working || !username || !password}>
						Log in
					</CButton>
				</CCol>

				<CCol sm={12}>
					<CAlert color="info">
						<FontAwesomeIcon icon={faInfoCircle} /> &nbsp;Companion Cloud is a premium service. Learn more and sign up{' '}
						<a target="_blank" href="https://bfoc.us/ezzaf9tfeg">
							here
						</a>
						.
					</CAlert>
				</CCol>
			</CRow>
		</CForm>
	)
})
