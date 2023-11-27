import React from 'react'
import { CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch'
import type { UserConfigModel } from '@companion/shared/Model/UserConfigModel'

interface VideohubServerConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export function VideohubServerConfig({ config, setValue, resetValue }: VideohubServerConfigProps) {
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
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.videohub_panel_enabled}
							size={'lg'}
							onChange={(e) => setValue('videohub_panel_enabled', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('videohub_panel_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
}
