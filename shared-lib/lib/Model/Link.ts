/**
 * Companion Link shared types
 * Used by both backend and frontend
 */

/** Configuration for a single transport instance */
export interface LinkTransportConfig {
	/** Unique ID for this transport instance */
	id: string
	/** Transport type (mqtt, etc.) */
	type: LinkTransportType
	/** User-defined label for this transport instance */
	label: string
	/** Whether this transport instance is enabled */
	enabled: boolean
	/** Transport-specific configuration */
	config: LinkTransportTypeConfig
}

/** Supported transport types */
export type LinkTransportType = 'mqtt'

/** Union of all transport-specific configs */
export type LinkTransportTypeConfig = LinkMqttConfig

/** MQTT-specific transport configuration */
export interface LinkMqttConfig {
	/** Broker URL (e.g., mqtt://broker.example.com:1883) */
	brokerUrl: string
	/** Username for broker auth */
	username: string
	/** Password for broker auth */
	password: string
	/** Whether to use TLS */
	tls: boolean
}

/** Connection status of a transport instance */
export type LinkTransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/** Runtime state of a transport instance for UI */
export interface LinkTransportState {
	/** Transport config ID */
	id: string
	/** Current connection status */
	status: LinkTransportStatus
	/** Error message if status is 'error' */
	error: string | null
}

/** A discovered peer instance */
export interface LinkPeerInfo {
	/** Peer's unique ID */
	id: string
	/** Human-readable name */
	name: string
	/** Companion version string */
	version: string
	/** Protocol version number */
	protocolVersion: number
	/** Number of pages */
	pageCount: number
	/** Grid dimensions */
	gridSize: { rows: number; cols: number }
	/** Whether the peer is online (reachable on at least one transport) */
	online: boolean
	/** Which transport instance IDs this peer is reachable on */
	transports: string[]
	/** Unix timestamp of last announcement (across all transports) */
	lastSeen: number
}

/** Overall Link controller state for the UI */
export interface LinkControllerState {
	/** Whether the Link service is enabled */
	enabled: boolean
	/** This instance's UUID */
	uuid: string
	/** This instance's display name */
	name: string
}

/** Default MQTT config for new transport instances */
export const DEFAULT_MQTT_CONFIG: LinkMqttConfig = {
	brokerUrl: 'mqtt://localhost:1883',
	username: '',
	password: '',
	tls: false,
}
