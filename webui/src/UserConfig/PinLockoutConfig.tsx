import React from 'react'
import { CButton, CInput } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch'
import type { UserConfigModel } from '@companion/shared/Model/UserConfigModel'

interface PinLockoutConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export function PinLockoutConfig({ config, setValue, resetValue }: PinLockoutConfigProps) {
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
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.pin_enable}
							size={'lg'}
							onChange={(e) => setValue('pin_enable', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('pin_enable')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>

			<tr>
				<td>Link Lockouts</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.link_lockouts}
							size={'lg'}
							onChange={(e) => setValue('link_lockouts', e.currentTarget.checked)}
						/>
					</div>
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
					<div className="form-check form-check-inline mr-1">
						<CInput type="text" value={config.pin} onChange={(e) => setValue('pin', e.currentTarget.value)} />
					</div>
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
					<div className="form-check form-check-inline mr-1">
						<CInput
							type="number"
							value={config.pin_timeout}
							min={0}
							step={1}
							onChange={(e) => setValue('pin_timeout', e.currentTarget.value)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('pin_timeout')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
}
