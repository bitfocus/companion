import React from 'react'
import { CFormCheck } from '@coreui/react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

interface SurfacesStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function SurfacesStep({ config, setValue }: SurfacesStepProps): React.JSX.Element {
	return (
		<div>
			<h5>USB Surface Detection Configuration</h5>
			<div className="indent3">
				<CFormCheck
					label="Watch for newly connected USB devices"
					checked={config.usb_hotplug}
					onChange={(e) => setValue('usb_hotplug', e.currentTarget.checked)}
				/>
			</div>
			<div className="indent4">
				<p>Stream Deck USB Hardware</p>
				<CFormCheck
					type="radio"
					label="Use Companion natively (requires Stream Deck software to be closed)"
					checked={!config.elgato_plugin_enable}
					onChange={() => setValue('elgato_plugin_enable', false)}
				/>
				<CFormCheck
					type="radio"
					label="Use Stream Deck software via Companion plugin"
					checked={config.elgato_plugin_enable}
					onChange={() => setValue('elgato_plugin_enable', true)}
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					label="X-keys USB Keypads"
					checked={config.xkeys_enable}
					onChange={(e) => setValue('xkeys_enable', e.currentTarget.checked)}
				/>
			</div>

			<div className="indent3">
				<CFormCheck
					label="Loupedeck and Razer Stream Controller USB Devices"
					checked={config.loupedeck_enable}
					onChange={(e) => setValue('loupedeck_enable', e.currentTarget.checked)}
				/>
			</div>

			<div className="indent3">
				<CFormCheck
					label="Mirabox Stream Dock USB Devices"
					checked={config.mirabox_streamdock_enable}
					onChange={(e) => setValue('mirabox_streamdock_enable', e.currentTarget.checked)}
				/>
			</div>

			<div className="indent3">
				<CFormCheck
					label="Contour Shuttle USB Devices"
					checked={config.contour_shuttle_enable}
					onChange={(e) => setValue('contour_shuttle_enable', e.currentTarget.checked)}
				/>
			</div>

			<div className="indent3">
				<CFormCheck
					label="VEC Footpedal USB Devices"
					checked={config.vec_footpedal_enable}
					onChange={(e) => setValue('vec_footpedal_enable', e.currentTarget.checked)}
				/>
			</div>

			<div className="indent3">
				<CFormCheck
					label="203 Systems Mystrix USB Devices"
					checked={config.mystrix_enable}
					onChange={(e) => setValue('mystrix_enable', e.currentTarget.checked)}
				/>
			</div>

			<div className="indent3">
				<CFormCheck
					label="Logitech MX Console Devices"
					checked={config.logitech_mx_console_enable}
					onChange={(e) => setValue('logitech_mx_console_enable', e.currentTarget.checked)}
				/>
			</div>

			<br />
			<h5>IP Surface Listeners</h5>
			<div className="indent3">
				<CFormCheck
					label="Videohub Panel Listener"
					checked={config.videohub_panel_enabled}
					onChange={(e) => setValue('videohub_panel_enabled', e.currentTarget.checked)}
				/>
			</div>
		</div>
	)
}
