import React from 'react'
import { CAlert, CFormInput, CFormCheck } from '@coreui/react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import type { JsonValue } from 'type-fest'

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
			<div className="indent3">
				<CFormCheck
					label="Enable Admin Password"
					checked={config.admin_lockout}
					onChange={(e) => setValue('admin_lockout', e.currentTarget.checked)}
				/>
				{config.admin_lockout && (
					<div className="indent2, group">
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
