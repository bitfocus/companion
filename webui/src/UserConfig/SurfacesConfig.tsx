import React from 'react'
import { CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch'
import type { UserConfigModel } from '@companion/shared/Model/UserConfigModel'

interface SurfacesConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export function SurfacesConfig({ config, setValue, resetValue }: SurfacesConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Surfaces
				</th>
			</tr>
			<tr>
				<td>Watch for new USB Devices</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.usb_hotplug}
							size={'lg'}
							onChange={(e) => setValue('usb_hotplug', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('usb_hotplug')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>
					Enable connected Streamdecks
					<br />
					When disabled support for the Elgato software Plugin will be enabled
					<br />
					<em>(Requires Companion restart)</em>
				</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={!config.elgato_plugin_enable}
							size={'lg'}
							onChange={(e) => setValue('elgato_plugin_enable', !e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('elgato_plugin_enable')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>
					Enable connected X-keys
					<br />
					<em>(Requires Companion restart)</em>
				</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.xkeys_enable}
							size={'lg'}
							onChange={(e) => setValue('xkeys_enable', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('xkeys_enable')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>
					Use old layout for X-keys
					<br />
					<em>(Requires Companion restart)</em>
				</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.xkeys_legacy_layout}
							size={'lg'}
							onChange={(e) => setValue('xkeys_legacy_layout', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('xkeys_legacy_layout')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>
					Enable connected Loupedeck and Razer Stream Controller devices
					<br />
					<em>(Requires Companion restart)</em>
				</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.loupedeck_enable}
							size={'lg'}
							onChange={(e) => setValue('loupedeck_enable', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('loupedeck_enable')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>
					Enable connected Contour Shuttle
					<br />
					<em>(Requires Companion restart)</em>
				</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.contour_shuttle_enable}
							size={'lg'}
							onChange={(e) => setValue('contour_shuttle_enable', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('contour_shuttle_enable')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
}
