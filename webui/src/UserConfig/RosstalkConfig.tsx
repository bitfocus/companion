import React from 'react'
import { CButton, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface RosstalkConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const RosstalkConfig = observer(function RosstalkConfig({ config, setValue, resetValue }: RosstalkConfigProps) {
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
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.rosstalk_enabled}
						size="xl"
						onChange={(e) => setValue('rosstalk_enabled', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('rosstalk_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			{config.rosstalk_enabled && (
				<tr>
					<td>Rosstalk Listen Port</td>
					<td>7788</td>
					<td></td>
				</tr>
			)}
		</>
	)
})
