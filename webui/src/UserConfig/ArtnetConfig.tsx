import React from 'react'
import { CButton, CFormInput } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface ArtnetConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const ArtnetConfig = observer(function ArtnetConfig({ config, setValue, resetValue }: ArtnetConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Artnet Listener
				</th>
			</tr>
			<tr>
				<td>Artnet Listener</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.artnet_enabled}
							size={'lg'}
							onChange={(e) => setValue('artnet_enabled', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('artnet_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>

			<tr>
				<td>Artnet Universe (first is 0)</td>
				<td>
					<div className="form-check form-check-inline mr-1">
						<CFormInput
							type="number"
							value={config.artnet_universe}
							onChange={(e) => setValue('artnet_universe', e.currentTarget.value)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('artnet_universe')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>

			<tr>
				<td>Artnet Channel</td>
				<td>
					<div className="form-check form-check-inline mr-1">
						<CFormInput
							type="number"
							value={config.artnet_channel}
							onChange={(e) => setValue('artnet_channel', e.currentTarget.value)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('artnet_channel')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
})
