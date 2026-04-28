import type { JsonValue } from 'type-fest'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'

interface SurfacesStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: JsonValue) => void
}

export function SurfacesStep({ config, setValue }: SurfacesStepProps): React.JSX.Element {
	return (
		<div>
			<h5>USB Surface Detection Configuration</h5>
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Watch for newly connected USB devices"
					value={!!config.usb_hotplug}
					setValue={(val) => setValue('usb_hotplug', val)}
				/>
			</div>
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Auto-enable newly discovered surfaces"
					value={!!config.auto_enable_discovered_surfaces}
					setValue={(val) => setValue('auto_enable_discovered_surfaces', val)}
				/>
			</div>
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Elgato Stream Deck Software Plugin"
					value={!!config.elgato_plugin_enable}
					setValue={(val) => setValue('elgato_plugin_enable', val)}
				/>
			</div>

			<div>
				<p>
					Since Companion 4.3, support for different USB devices is done via surface modules. You will want to install
					and configure the ones you wish to use in the Surface Integrations page after completing this wizard.
				</p>
			</div>
		</div>
	)
}
