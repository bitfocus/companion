export interface NetworkInterfaceOption {
	id: string
	label: string
}

/**
 * The choices for the interface picker. The bound interface is always included, so the picker can show it even
 * before the list has loaded or after that interface has gone away.
 */
export function getInterfaceOptions(interfaces: NetworkInterfaceOption[], bindIp: string): NetworkInterfaceOption[] {
	if (!bindIp || interfaces.some((iface) => iface.id === bindIp)) return interfaces

	if (interfaces.length === 0) return [{ id: bindIp, label: bindIp }]

	return [...interfaces, { id: bindIp, label: `${bindIp} (unavailable)` }]
}
