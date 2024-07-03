import React from 'react'
import { CButton, CInput } from '@coreui/react'
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
					Artnet II Listener
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

			{config.artnet_enabled && (
				<>
					<tr>
						<td>Artnet Universe (first is 0)</td>
						<td>
							<div className="form-check form-check-inline mr-1">
								<CInput
									type="number"
									value={config.artnet_universe}
									min={0}
									max={20055}
									onChange={(e) => {
										let value = Math.floor(e.currentTarget.value)
										value = Math.min(value, 255)
										value = Math.max(value, 0)
										setValue('artnet_universe', value)
									}}
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
								<CInput
									type="number"
									value={config.artnet_channel}
									min={1}
									max={509}
									onChange={(e) => {
										let value = Math.floor(e.currentTarget.value)
										value = Math.min(value, 509)
										value = Math.max(value, 1)
										setValue('artnet_channel', value)
									}}
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
			)}
		</>
	)
})
