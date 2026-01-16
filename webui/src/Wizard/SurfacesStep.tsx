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
			<div className="indent3">
				<CFormCheck
					label="Auto-enable newly discovered surfaces"
					checked={config.auto_enable_discovered_surfaces}
					onChange={(e) => setValue('auto_enable_discovered_surfaces', e.currentTarget.checked)}
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					label="Elgato Stream Deck Software Plugin"
					checked={config.elgato_plugin_enable}
					onChange={(e) => setValue('elgato_plugin_enable', e.currentTarget.checked)}
				/>
			</div>

			<div>
				<p>
					Since Companion 4.2, support for different USB devices is done via surface modules. You will want to install
					and configure the ones you wish to use in the Surface Integrations page after completing this wizard.
				</p>
			</div>
		</div>
	)
}
