import { DirectClientTransportDefinition, DirectServerBuiltinTransport } from './Direct/index.js'
import { MqttTransportDefinition } from './Mqtt/index.js'
import type { SomeLinkBuiltinTransport, SomeLinkTransportDefinition } from './Types.js'

/**
 * All the transport types the user can add, in the order they are offered.
 * To add a transport, create a folder alongside the others and add its definition here. See README.md
 */
export const LINK_TRANSPORT_DEFINITIONS: readonly SomeLinkTransportDefinition[] = [
	DirectClientTransportDefinition,
	MqttTransportDefinition,
]

/** The transports that are part of Link, configured in the settings rather than added by the user */
export const LINK_BUILTIN_TRANSPORTS: readonly SomeLinkBuiltinTransport[] = [DirectServerBuiltinTransport]
