import React from 'react'
import { CButton, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface VideohubServerConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const VideohubServerConfig = observer(function VideohubServerConfig({
	config,
	setValue,
	resetValue,
}: VideohubServerConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Videohub Panel
				</th>
			</tr>
			<tr>
				<td>Videohub Panel Listener</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.videohub_panel_enabled}
						size="xl"
						onChange={(e) => setValue('videohub_panel_enabled', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('videohub_panel_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
})
