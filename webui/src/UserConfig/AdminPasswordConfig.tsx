import React from 'react'
import { CAlert, CButton, CFormInput, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface AdminPasswordConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const AdminPasswordConfig = observer(function AdminPasswordConfig({
	config,
	setValue,
	resetValue,
}: AdminPasswordConfigProps) {
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
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.admin_lockout}
						size="xl"
						onChange={(e) => setValue('admin_lockout', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('admin_lockout')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			{config.admin_lockout && (
				<>
					<tr>
						<td>Session Timeout (minutes, 0 for no timeout)</td>
						<td>
							<CFormInput
								type="number"
								value={config.admin_timeout}
								min={0}
								step={1}
								onChange={(e) => {
									let value = Math.floor(Number(e.currentTarget.value))
									if (isNaN(value)) return

									value = Math.max(value, 0)
									setValue('admin_timeout', value)
								}}
							/>
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
							<CFormInput
								type="text"
								value={config.admin_password}
								onChange={(e) => setValue('admin_password', e.currentTarget.value)}
							/>
						</td>
						<td>
							<CButton onClick={() => resetValue('admin_password')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>
				</>
			)}
		</>
	)
})
