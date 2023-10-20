import React from 'react'
import { CButton, CInput } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch'

export function VideohubServerConfig({ config, setValue, resetValue }) {
	return (
		<>
			<tr>
				<th colSpan="3" className="settings-category">
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
