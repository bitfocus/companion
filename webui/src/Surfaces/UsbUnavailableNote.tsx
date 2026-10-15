import { StaticAlert } from '~/Components/Alert'
import { useUsbAvailable } from '~/Hooks/useUsbAvailable'

/** Explains that USB surfaces can't be used, when the machine running Companion has no usb. Renders nothing otherwise */
export function UsbUnavailableNote(): React.JSX.Element | null {
	const usbAvailable = useUsbAvailable()
	if (usbAvailable) return null

	return (
		<StaticAlert color="info">
			<strong>USB is not available on this machine.</strong> USB surfaces can't be detected, but network surfaces,
			Satellite and emulators still work.
		</StaticAlert>
	)
}
