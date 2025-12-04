import type { OpenDeviceResult } from '@companion-surface/host'
import type { HostOpenDeviceResult } from '../IpcTypes.js'
import { translateSurfaceConfigFields } from './ConfigFields.js'

export function convertOpenDeviceResult(result: OpenDeviceResult): HostOpenDeviceResult {
	return {
		...result,
		configFields: result.configFields && translateSurfaceConfigFields(result.configFields),
	}
}
