import React from 'react'
import { CAlert, CButton, CInput } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch'
import type { UserConfigModel } from '@companion/shared/Model/UserConfigModel.js'

interface AdminPasswordConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export function AdminPasswordConfig({ config, setValue, resetValue }: AdminPasswordConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Admin UI Password
				</th>
			</tr>
			<tr>
				<td colSpan={3}>
					<CAlert color="danger">
						This does not make an installation secure!
						<br /> This is intended to keep normal users from stumbling upon the settings and changing things. It will
						not keep out someone determined to bypass it.
					</CAlert>
				</td>
			</tr>
			<tr>
				<td>Enable Locking</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.admin_lockout}
							size={'lg'}
							onChange={(e) => setValue('admin_lockout', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('admin_lockout')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>Session Timeout (minutes, 0 for no timeout)</td>
				<td>
					<div className="form-check form-check-inline mr-1">
						<CInput
							type="number"
							value={config.admin_timeout}
							min={0}
							step={1}
							onChange={(e) => setValue('admin_timeout', e.currentTarget.value)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('admin_timeout')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>Password</td>
				<td>
					<div className="form-check form-check-inline mr-1">
						<CInput
							type="text"
							value={config.admin_password}
							onChange={(e) => setValue('admin_password', e.currentTarget.value)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('admin_password')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
}
