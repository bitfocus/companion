import React from 'react'
import { CButton, CFormInput, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface TcpConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const TcpConfig = observer(function TcpConfig({ config, setValue, resetValue }: TcpConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					TCP
				</th>
			</tr>
			<tr>
				<td>TCP Listener</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.tcp_enabled}
						size="xl"
						onChange={(e) => setValue('tcp_enabled', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('tcp_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>

			{config.tcp_enabled && (
				<>
					<tr>
						<td>TCP Listen Port</td>
						<td>
							<CFormInput
								type="number"
								value={config.tcp_listen_port}
								min={1024}
								max={65535}
								step={1}
								onChange={(e) => {
									let value = Math.floor(Number(e.currentTarget.value))
									if (isNaN(value)) return

									value = Math.min(value, 65535)
									value = Math.max(value, 1024)
									setValue('tcp_listen_port', value)
								}}
							/>
						</td>
						<td>
							<CButton onClick={() => resetValue('tcp_listen_port')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>
					<tr>
						<td>
							Deprecated TCP API
							<br />
							<em>(This portion of the API will be removed in a future release)</em>
						</td>
						<td>
							<CFormSwitch
								className="float-right"
								color="success"
								checked={config.tcp_legacy_api_enabled}
								size="xl"
								onChange={(e) => setValue('tcp_legacy_api_enabled', e.currentTarget.checked)}
							/>
						</td>
						<td>
							<CButton onClick={() => resetValue('tcp_legacy_api_enabled')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>
				</>
			)}
		</>
	)
})
