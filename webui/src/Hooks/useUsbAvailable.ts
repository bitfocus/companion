import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC'

/** Whether the machine running Companion has usb available. Assumed true until known, to avoid a flash of warnings */
export function useUsbAvailable(): boolean {
	const { data } = useQuery(trpc.surfaces.usbAvailable.queryOptions())
	return data ?? true
}
