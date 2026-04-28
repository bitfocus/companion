import { CAlert, CFormInput } from '@coreui/react'
import type { JsonValue } from 'type-fest'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'

interface PasswordStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: JsonValue) => void
}

export function PasswordStep({ config, setValue }: PasswordStepProps): React.JSX.Element {
	return (
		<div>
			<h5>Admin GUI Password</h5>
			<p>
				Optionally, you can restrict this interface using a password. This is intended to keep normal users from
				stumbling upon the settings and changing things. It will not keep out someone determined to bypass it.
			</p>
			<CAlert color="danger">This does not make an installation more secure!</CAlert>
			<div className="ms-3 mb-1">
				<CheckboxInputFieldWithLabel
					label="Enable Admin Password"
					value={!!config.admin_lockout}
					setValue={(val) => setValue('admin_lockout', val)}
				/>
				{config.admin_lockout && (
					<div className="ms-3 mb-2">
						<div className="col-left">Password</div>
						<div className="col-right">
							<CFormInput
								type="text"
								value={config.admin_password}
								onChange={(e) => setValue('admin_password', e.currentTarget.value)}
							/>
						</div>
						<br />
						<div className="col-left">
							Session Timeout
							<br />
							(minutes, 0 for none)
						</div>
						<div className="col-right">
							<CFormInput
								type="number"
								value={config.admin_timeout}
								min={0}
								step={1}
								onChange={(e) => setValue('admin_timeout', e.currentTarget.value)}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
