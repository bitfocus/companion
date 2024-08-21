import React from 'react'
import { CButton, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface SurfacesConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const SurfacesConfig = observer(function SurfacesConfig({ config, setValue, resetValue }: SurfacesConfigProps) {
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
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.usb_hotplug}
						size="xl"
						onChange={(e) => setValue('usb_hotplug', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('usb_hotplug')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>Watch for Discoverable Companion Satellite Installations</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.discoveryEnabled}
						size="xl"
						onChange={(e) => setValue('discoveryEnabled', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('discoveryEnabled')} title="Reset to default">
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
					<CFormSwitch
						className="float-right"
						color="success"
						checked={!config.elgato_plugin_enable}
						size="xl"
						onChange={(e) => setValue('elgato_plugin_enable', !e.currentTarget.checked)}
					/>
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
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.xkeys_enable}
						size="xl"
						onChange={(e) => setValue('xkeys_enable', e.currentTarget.checked)}
					/>
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
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.xkeys_legacy_layout}
						size="xl"
						onChange={(e) => setValue('xkeys_legacy_layout', e.currentTarget.checked)}
					/>
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
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.loupedeck_enable}
						size="xl"
						onChange={(e) => setValue('loupedeck_enable', e.currentTarget.checked)}
					/>
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
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.contour_shuttle_enable}
						size="xl"
						onChange={(e) => setValue('contour_shuttle_enable', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('contour_shuttle_enable')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
			<tr>
				<td>
					Enable connected VEC Footpedal
					<br />
					<em>(Requires Companion restart)</em>
				</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.vec_footpedal_enable}
						size="xl"
						onChange={(e) => setValue('vec_footpedal_enable', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('vec_footpedal_enable')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
})
