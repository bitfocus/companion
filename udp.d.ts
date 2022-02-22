/// <reference types="node" />
import { EventEmitter } from 'events'

/**
 * A UDP socket wrapper
 * Events emitted:
 *  - 'error' when an error occurs
 *  - 'status_change' when the socket status changes. Valid values are STATUS_OK, STATUS_WARNING and STATUS_ERROR (as found on instance_skel)
 *  - 'listening' when the socket is listening for packets
 *  - 'data' when a packet of data has been received
 */
declare class UDPSocket extends EventEmitter {
	constructor(
		host: string,
		port: number,
		options?: {
			/** default false */
			broadcast?: boolean
			/** default 64 */
			ttl?: number
			/** default 1 */
			multicast_ttl?: number
			/** default undefined */
			multicast_interface?: string
			/** default: 0 */
			bind_port?: number
			/** default: 0.0.0.0 */
			bind_ip?: string
		}
	)

	/** Attempt to add membership to a multicast address */
	addMembership(member: string): void

	/** Write a message to the socket */
	send(message: string | Buffer, cb: (err: Error | undefined) => void): void

	/** Shutdown and cleanup the socket */
	destroy(): void
}

export = UDPSocket
