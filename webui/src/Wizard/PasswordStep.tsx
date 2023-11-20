import React from 'react'
import { CAlert, CInput, CInputCheckbox, CLabel } from '@coreui/react'
import type { UserConfigModel } from '@companion/shared/Model/UserConfigModel'

interface PasswordStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function PasswordStep({ config, setValue }: PasswordStepProps) {
	return (
		<div>
			<h5>Admin GUI Password</h5>
			<p>
				Optionally, you can restrict this interface using a password. This is intended to keep normal users from
				stumbling upon the settings and changing things. It will not keep out someone determined to bypass it.
			</p>
			<CAlert color="danger">This does not make an installation more secure!</CAlert>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="userconfig_admin_lockout"
						checked={config.admin_lockout}
						onChange={(e) => setValue('admin_lockout', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="userconfig_admin_lockout">Enable Admin Password</CLabel>
				</div>
				{config.admin_lockout && (
					<div className="indent2, group">
						<div className="col-left">Password</div>
						<div className="col-right">
							<div className="form-check form-check-inline mr-1">
								<CInput
									type="text"
									value={config.admin_password}
									onChange={(e) => setValue('admin_password', e.currentTarget.value)}
								/>
							</div>
						</div>
						<br />
						<div className="col-left">
							Session Timeout
							<br />
							(minutes, 0 for none)
						</div>
						<div className="col-right">
							<div className="form-check form-check-inline mr-1">
								<CInput
									type="number"
									value={config.admin_timeout}
									min={0}
									step={1}
									onChange={(e) => setValue('admin_timeout', e.currentTarget.value)}
								/>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
