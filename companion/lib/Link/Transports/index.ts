import { MockTransportDefinition } from './Mock/index.js'
import type { SomeLinkTransportDefinition } from './Types.js'

/**
 * All the available transport types, in the order they are offered to the user.
 * To add a transport, create a folder alongside the others and add its definition here. See README.md
 */
export const LINK_TRANSPORT_DEFINITIONS: readonly SomeLinkTransportDefinition[] = [MockTransportDefinition]
