import React from 'react'
import { CButton, CInput } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch'

export function UdpConfig({ config, setValue, resetValue }) {
	return (
		<>
			<tr>
				<th colSpan="3" className="settings-category">
					UDP
				</th>
			</tr>
			<tr>
				<td>UDP Listener</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.udp_enabled}
							size={'lg'}
							onChange={(e) => setValue('udp_enabled', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('udp_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>UDP Listen Port</td>
				<td>
					<div className="form-check form-check-inline mr-1">
						<CInput
							type="number"
							value={config.udp_listen_port}
							onChange={(e) => setValue('udp_listen_port', e.currentTarget.value)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('udp_listen_port')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
}
