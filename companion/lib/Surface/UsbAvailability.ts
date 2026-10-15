import fs from 'node:fs'

/** Where linux exposes usb devices. Missing in vms/containers with no usb bus (eg kubernetes) */
const LINUX_USB_SYSFS_DIR = '/sys/bus/usb/devices'
/** The usb device nodes. Missing in containers without usb passthrough (eg plain docker) */
const LINUX_USB_DEV_DIR = '/dev/bus/usb'

/**
 * Whether this machine has a usb bus that can be used for surfaces.
 * Only linux is checked, as other platforms always have usb available.
 */
export function isUsbAvailable(platform: NodeJS.Platform, pathExists: (path: string) => boolean): boolean {
	if (platform !== 'linux') return true

	return pathExists(LINUX_USB_SYSFS_DIR) && pathExists(LINUX_USB_DEV_DIR)
}

/** Check whether usb is available on the running machine */
export function detectUsbAvailable(): boolean {
	return isUsbAvailable(process.platform, (path) => fs.existsSync(path))
}
