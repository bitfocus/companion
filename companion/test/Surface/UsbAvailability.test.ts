import { describe, expect, test, vi } from 'vitest'
import { isUsbAvailable } from '../../lib/Surface/UsbAvailability.js'

describe('isUsbAvailable', () => {
	test('linux with a usb bus', () => {
		const pathExists = vi.fn(() => true)
		expect(isUsbAvailable('linux', pathExists)).toBe(true)
		expect(pathExists).toHaveBeenCalledWith('/sys/bus/usb/devices')
		expect(pathExists).toHaveBeenCalledWith('/dev/bus/usb')
	})

	test('linux without a usb bus', () => {
		expect(isUsbAvailable('linux', () => false)).toBe(false)
	})

	test('linux with a usb bus but no device nodes (container without passthrough)', () => {
		expect(isUsbAvailable('linux', (path) => path === '/sys/bus/usb/devices')).toBe(false)
	})

	test.each(['darwin', 'win32'] as const)('%s is always available', (platform) => {
		const pathExists = vi.fn(() => false)
		expect(isUsbAvailable(platform, pathExists)).toBe(true)
		expect(pathExists).not.toHaveBeenCalled()
	})
})
