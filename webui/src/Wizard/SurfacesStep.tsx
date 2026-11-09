import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import type { KeyValueChange } from '@companion-app/shared/Util/KeyValue.js'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'
import { useUsbAvailable } from '~/Hooks/useUsbAvailable'

interface SurfacesStepProps {
	config: Partial<UserConfigModel>
	setValue: (change: KeyValueChange<UserConfigModel>) => void
}

export function SurfacesStep({ config, setValue }: SurfacesStepProps): React.JSX.Element {
	const usbAvailable = useUsbAvailable()

	return (
		<div>
			<h5>USB Surface Detection Configuration</h5>
			<p>
				Companion can automatically detect USB surfaces (such as Stream Decks) as they are plugged in. Choose how you'd
				like newly connected devices to be handled:
			</p>
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Watch for newly connected USB devices"
					value={usbAvailable && !!config.usb_hotplug}
					setValue={(value) => setValue({ key: 'usb_hotplug', value })}
					disabled={!usbAvailable}
				/>
				{!usbAvailable && <p className="text-xs text-muted ms-6 mb-0">USB is not available on this machine</p>}
			</div>
			<div className="ms-2 mb-1">
				<CheckboxInputFieldWithLabel
					label="Auto-enable newly discovered surfaces"
					value={!!config.auto_enable_discovered_surfaces}
					setValue={(value) => setValue({ key: 'auto_enable_discovered_surfaces', value })}
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
