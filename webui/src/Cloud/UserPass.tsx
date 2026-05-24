import { CCol, CRow } from '@coreui/react'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { memo, useId, useState } from 'react'
import { StaticAlert } from '~/Components/Alert'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import { SecretTextInputField } from '~/Components/SecretTextInputField'
import { TextInputFieldSimple } from '~/Components/TextInputField'
import { trpc, useMutationExt } from '~/Resources/TRPC'

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
	const [email, setEmail] = useState(defaultUsername || '')
	const [password, setPassword] = useState('')

	const loginMutation = useMutationExt(trpc.cloud.login.mutationOptions())

	const emailFieldId = useId()
	const passwordFieldId = useId()

	return (
		<Form
			className="cloud-auth-form"
			onSubmit={(e) => {
				e.preventDefault()

				if (onClearError) {
					console.log('onClearError')
					onClearError()
				}

				if (email === '' || password === '') return

				loginMutation.mutate({ email, password })
			}}
		>
			<CRow>
				<CCol sm={6}>
					<FormLabel htmlFor={emailFieldId}>Email address</FormLabel>
					<TextInputFieldSimple id={emailFieldId} value={email} setValue={setEmail} immediateValue />
				</CCol>
				<CCol sm={6}></CCol>

				<CCol sm={6}>
					<FormLabel htmlFor={passwordFieldId}>Password</FormLabel>
					<SecretTextInputField id={passwordFieldId} value={password} setValue={setPassword} immediateValue />
				</CCol>
				<CCol sm={6}></CCol>

				<CCol sm={6}>
					<Button color="success" type="submit" disabled={working || !email || !password}>
						Log in
					</Button>
				</CCol>

				<CCol sm={12}>
					<StaticAlert color="info">
						<FontAwesomeIcon icon={faInfoCircle} /> &nbsp;Companion Cloud is a premium service. Learn more and sign up{' '}
						<a target="_blank" href="https://bfoc.us/ezzaf9tfeg">
							here
						</a>
						.
					</StaticAlert>
				</CCol>
			</CRow>
		</Form>
	)
})
