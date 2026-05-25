import { useId } from 'react'
import type { JsonValue } from 'type-fest'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { StaticAlert } from '~/Components/Alert'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'
import { FormLabel } from '~/Components/Form'
import { Grid } from '~/Components/Grid'
import { NumberInputField } from '~/Components/NumberInputField'
import { SecretTextInputField } from '~/Components/SecretTextInputField'

interface PasswordStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: JsonValue) => void
}

export function PasswordStep({ config, setValue }: PasswordStepProps): React.JSX.Element {
	const passwordFieldId = useId()
	const timeoutFieldId = useId()

	return (
		<Grid.Row>
			<Grid.Col sm={12}>
				<h5>Admin GUI Password</h5>
				<p>
					Optionally, you can restrict this interface using a password. This is intended to keep normal users from
					stumbling upon the settings and changing things. It will not keep out someone determined to bypass it.
				</p>
				<StaticAlert color="danger">This does not make an installation more secure!</StaticAlert>
			</Grid.Col>

			<Grid.Col xs={12} className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Enable Admin Password"
					value={!!config.admin_lockout}
					setValue={(val) => setValue('admin_lockout', val)}
				/>
			</Grid.Col>

			{config.admin_lockout && (
				<>
					<FormLabel htmlFor={passwordFieldId} className="col-sm-4 offset-sm-1 col-form-label col-form-label-sm mb-2">
						Password
					</FormLabel>
					<Grid.Col sm={5} className="mb-2">
						<SecretTextInputField
							id={passwordFieldId}
							value={config.admin_password || ''}
							setValue={(val) => setValue('admin_password', val)}
							immediateValue
						/>
					</Grid.Col>
					<Grid.Col sm={2}></Grid.Col>

					<FormLabel htmlFor={timeoutFieldId} className="col-sm-4 offset-sm-1 col-form-label col-form-label-sm mb-2">
						Session Timeout
					</FormLabel>
					<Grid.Col sm={5} className="mb-2">
						<NumberInputField
							id={timeoutFieldId}
							value={config.admin_timeout}
							min={0}
							step={1}
							setValue={(val) => setValue('admin_timeout', val)}
							immediateValue
						/>
						<span className="text-muted">(minutes, 0 for none)</span>
					</Grid.Col>
					<Grid.Col sm={2}></Grid.Col>
				</>
			)}
		</Grid.Row>
	)
}
