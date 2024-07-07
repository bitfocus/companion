import React from 'react'
import { CButton, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface HttpConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const HttpConfig = observer(function HttpConfig({ config, setValue, resetValue }: HttpConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					HTTP
				</th>
			</tr>
			<tr>
				<td>HTTP API</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.http_api_enabled}
						size="xl"
						onChange={(e) => setValue('http_api_enabled', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('http_api_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>
					Deprecated HTTP API
					<br />
					<em>(This portion of the API will be removed in a future release)</em>
				</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.http_legacy_api_enabled}
						size="xl"
						onChange={(e) => setValue('http_legacy_api_enabled', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('http_legacy_api_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
})
