/// <reference types="node" />
import { EventEmitter } from 'events'

/**
 * A Telnet client wrapper
 * Events emitted:
 *  - 'error' when an error occurs
 *  - 'status_change' when the connection status changes. Valid values are STATUS_OK, STATUS_WARNING and STATUS_ERROR (as found on instance_skel)
 *  - 'connect' when the connection has opened
 *  - 'end' when the socket has ended
 *  - 'iac'
 *  - 'sb'
 *  - 'data' when a packet of data has been received
 *  - 'drain' when the write buffer has emptied
 */
declare class Telnet extends EventEmitter {
	constructor(
		host: string,
		port: number,
		options?: {
			/** default 2000 */
			reconnect_interval?: number
			/** default true */
			reconnect?: boolean
		}
	)

	/** Force a reconnection attempt */
	connect(): void

	/** Write a message to the socket */
	write(message: string | Buffer, cb: (err: Error | undefined) => void): void
	/** Write a message to the socket */
	write(message: string | Buffer, cb: (err: Error | undefined) => void): void

	/** Shutdown and cleanup the socket */
	destroy(): void
}

export = Telnet
