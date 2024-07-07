import React from 'react'
import { CButton, CFormInput, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface UdpConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const UdpConfig = observer(function UdpConfig({ config, setValue, resetValue }: UdpConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					UDP
				</th>
			</tr>
			<tr>
				<td>UDP Listener</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.udp_enabled}
						size={'lg'}
						onChange={(e) => setValue('udp_enabled', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('udp_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>

			{config.udp_enabled && (
				<>
					<tr>
						<td>UDP Listen Port</td>
						<td>
							<CFormInput
								type="number"
								value={config.udp_listen_port}
								min={1024}
								max={65535}
								step={1}
								onChange={(e) => {
									let value = Math.floor(Number(e.currentTarget.value))
									if (isNaN(value)) return

									value = Math.min(value, 65535)
									value = Math.max(value, 1024)
									setValue('udp_listen_port', value)
								}}
							/>
						</td>
						<td>
							<CButton onClick={() => resetValue('udp_listen_port')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>
					<tr>
						<td>
							Deprecated UDP API
							<br />
							<em>(This portion of the API will be removed in a future release)</em>
						</td>
						<td>
							<CFormSwitch
								className="float-right"
								color="success"
								checked={config.udp_legacy_api_enabled}
								size={'lg'}
								onChange={(e) => setValue('udp_legacy_api_enabled', e.currentTarget.checked)}
							/>
						</td>
						<td>
							<CButton onClick={() => resetValue('udp_legacy_api_enabled')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>
				</>
			)}
		</>
	)
})
