import React from 'react'
import { CFormCheck, CFormLabel } from '@coreui/react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

interface SurfacesStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function SurfacesStep({ config, setValue }: SurfacesStepProps) {
	return (
		<div>
			<h5>USB Surface Detection Configuration</h5>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CFormCheck
						id="userconfig_watch_for_devices"
						checked={config.usb_hotplug}
						onChange={(e) => setValue('usb_hotplug', e.currentTarget.checked)}
					/>
					<CFormLabel htmlFor="userconfig_watch_for_devices">Watch for newly connected USB devices</CFormLabel>
				</div>
			</div>
			<div className="indent4">
				<p>Stream Deck USB Hardware</p>
				<div className="form-check form-check-inline mr-1">
					<CFormCheck
						type="radio"
						id="userconfig_elgato_plugin_disable"
						checked={!config.elgato_plugin_enable}
						onChange={() => setValue('elgato_plugin_enable', false)}
					/>
					<CFormLabel htmlFor="userconfig_elgato_plugin_disable">
						Use Companion natively (requires Stream Deck software to be closed)
					</CFormLabel>
				</div>
				<div className="form-check form-check-inline mr-1">
					<CFormCheck
						type="radio"
						id="userconfig_elgato_plugin_enable"
						checked={config.elgato_plugin_enable}
						onChange={() => setValue('elgato_plugin_enable', true)}
					/>
					<CFormLabel htmlFor="userconfig_elgato_plugin_enable">
						Use Stream Deck software via Companion plugin
					</CFormLabel>
				</div>
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CFormCheck
						id="userconfig_xkeys_enable"
						checked={config.xkeys_enable}
						onChange={(e) => setValue('xkeys_enable', e.currentTarget.checked)}
					/>
					<CFormLabel htmlFor="userconfig_xkeys_enable">X-keys USB Keypads</CFormLabel>
				</div>
			</div>

			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CFormCheck
						id="userconfig_loupedeck_enable"
						checked={config.loupedeck_enable}
						onChange={(e) => setValue('loupedeck_enable', e.currentTarget.checked)}
					/>
					<CFormLabel htmlFor="userconfig_loupedeck_enable">
						Loupedeck and Razer Stream Controller USB Devices
					</CFormLabel>
				</div>
			</div>

			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CFormCheck
						id="userconfig_contour_shuttle_enable"
						checked={config.contour_shuttle_enable}
						onChange={(e) => setValue('contour_shuttle_enable', e.currentTarget.checked)}
					/>
					<CFormLabel htmlFor="userconfig_contour_shuttle_enable">Contour Shuttle USB Devices</CFormLabel>
				</div>
			</div>

			<br />
			<h5>IP Surface Listeners</h5>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CFormCheck
						id="userconfig_videohub_panel_enabled"
						checked={config.videohub_panel_enabled}
						onChange={(e) => setValue('videohub_panel_enabled', e.currentTarget.checked)}
					/>
					<CFormLabel htmlFor="userconfig_videohub_panel_enabled">Videohub Panel Listener</CFormLabel>
				</div>
			</div>
		</div>
	)
}
