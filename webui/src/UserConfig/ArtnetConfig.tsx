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
					Artnet II Listener
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

			{config.artnet_enabled && (
				<>
					<tr>
						<td>Artnet Universe (first is 0)</td>
						<td>
							<CFormInput
								type="number"
								value={config.artnet_universe}
								min={0}
								max={20055}
								onChange={(e) => {
									let value = Math.floor(Number(e.currentTarget.value))
									if (isNaN(value)) return

									value = Math.min(value, 255)
									value = Math.max(value, 0)
									setValue('artnet_universe', value)
								}}
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
								min={1}
								max={509}
								onChange={(e) => {
									let value = Math.floor(Number(e.currentTarget.value))
									if (isNaN(value)) return

									value = Math.min(value, 509)
									value = Math.max(value, 1)
									setValue('artnet_channel', value)
								}}
							/>
						</td>
						<td>
							<CButton onClick={() => resetValue('artnet_channel')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>
				</>
			)}
		</>
	)
})
