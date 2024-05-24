import React from 'react'
import { CButton, CFormInput, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
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
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.artnet_enabled}
						size="xl"
						onChange={(e) => setValue('artnet_enabled', e.currentTarget.checked)}
					/>
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
					<CFormInput
						type="number"
						value={config.artnet_universe}
						onChange={(e) => setValue('artnet_universe', e.currentTarget.value)}
					/>
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
					<CFormInput
						type="number"
						value={config.artnet_channel}
						onChange={(e) => setValue('artnet_channel', e.currentTarget.value)}
					/>
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
