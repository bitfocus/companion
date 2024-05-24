import React from 'react'
import { CButton, CFormInput, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface OscConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const OscConfig = observer(function OscConfig({ config, setValue, resetValue }: OscConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					OSC
				</th>
			</tr>
			<tr>
				<td>OSC Listener</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.osc_enabled}
						size="xl"
						onChange={(e) => setValue('osc_enabled', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('osc_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>OSC Listen Port</td>
				<td>
					<CFormInput
						type="number"
						value={config.osc_listen_port}
						onChange={(e) => setValue('osc_listen_port', e.currentTarget.value)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('osc_listen_port')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>
					Deprecated OSC API
					<br />
					<em>(This portion of the API will be removed in a future release)</em>
				</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.osc_legacy_api_enabled}
						size="xl"
						onChange={(e) => setValue('osc_legacy_api_enabled', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('osc_legacy_api_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
})
