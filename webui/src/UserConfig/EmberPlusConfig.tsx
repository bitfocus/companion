import React from 'react'
import { CButton, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface EmberPlusConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const EmberPlusConfig = observer(function EmberPlusConfig({
	config,
	setValue,
	resetValue,
}: EmberPlusConfigProps) {
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
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.emberplus_enabled}
						size="xl"
						onChange={(e) => setValue('emberplus_enabled', e.currentTarget.checked)}
					/>
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
})
