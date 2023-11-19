import React from 'react'
import { CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch'
import type { UserConfigModel } from '@companion/shared/Model/UserConfigModel'

interface RosstalkConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export function RosstalkConfig({ config, setValue, resetValue }: RosstalkConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					RossTalk
				</th>
			</tr>
			<tr>
				<td>RossTalk Listener</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.rosstalk_enabled}
							size={'lg'}
							onChange={(e) => setValue('rosstalk_enabled', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('rosstalk_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>Rosstalk Listen Port</td>
				<td>7788</td>
				<td></td>
			</tr>
		</>
	)
}
