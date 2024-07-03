import React from 'react'
import { CButton, CFormInput, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface PinLockoutConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const PinLockoutConfig = observer(function PinLockoutConfig({
	config,
	setValue,
	resetValue,
}: PinLockoutConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					PIN Lockout
				</th>
			</tr>
			<tr>
				<td>Enable Pin Codes</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.pin_enable}
						size="xl"
						onChange={(e) => setValue('pin_enable', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('pin_enable')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>

			{config.pin_enable && (
				<>
					<tr>
						<td>Link Lockouts</td>
						<td>
							<CFormSwitch
								color="success"
								checked={config.link_lockouts}
								size={'lg'}
								onChange={(e) => setValue('link_lockouts', e.currentTarget.checked)}
							/>
						</td>
						<td>
							<CButton onClick={() => resetValue('link_lockouts')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>

					<tr>
						<td>Pin Code</td>
						<td>
							<CFormInput type="text" value={config.pin} onChange={(e) => setValue('pin', e.currentTarget.value)} />
						</td>
						<td>
							<CButton onClick={() => resetValue('pin')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>

					<tr>
						<td>Pin Timeout (seconds, 0 to turn off)</td>
						<td>
							<CFormInput
								type="number"
								value={config.pin_timeout}
								min={0}
								step={1}
								onChange={(e) => {
									let value = Math.floor(Number(e.currentTarget.value))
									if (isNaN(value)) return

									value = Math.max(value, 0)
									setValue('pin_timeout', value)
								}}
							/>
						</td>
						<td>
							<CButton onClick={() => resetValue('pin_timeout')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>
				</>
			)}
		</>
	)
})
