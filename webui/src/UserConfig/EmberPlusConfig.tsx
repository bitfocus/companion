import React from 'react'
import { CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch'
import type { UserConfigModel } from '@companion/shared/Model/UserConfigModel'

interface EmberPlusConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export function EmberPlusConfig({ config, setValue, resetValue }: EmberPlusConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Ember+
				</th>
			</tr>
			<tr>
				<td>Ember+ Listener</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.emberplus_enabled}
							size={'lg'}
							onChange={(e) => setValue('emberplus_enabled', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('emberplus_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>Ember+ Listen Port</td>
				<td>9092</td>
				<td></td>
			</tr>
		</>
	)
}
