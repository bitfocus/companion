import { isApiVersionAtLeast, parseApiVersion } from '@companion-app/satellite-protocol/versions'

/**
 * Version of the Link protocol. This follows semver:
 * - MAJOR: incompatible change. Peers with a different major version ignore each other
 * - MINOR: a new feature, see LINK_FEATURES. Only used towards a peer that announces a version that has it
 * - PATCH: a fix that doesn't change what goes over the wire
 *
 * 1.0.0 - Initial release: discovery, button subscriptions, press and rotate
 */
export const LINK_PROTOCOL_VERSION = '1.0.0'

export interface LinkFeatureDefinition {
	/** The first protocol version the feature exists in */
	readonly since: string
	readonly description: string
}

/**
 * The features a peer may need to gate on. A feature can be used towards a peer when the peer announced a
 * protocol version at least `since`. Add new entries here when bumping the minor version.
 */
export const LINK_FEATURES = {
	buttons: {
		since: '1.0.0',
		description: 'Button subscriptions (subscribe, unsubscribe, button.update) and button.press',
	},
	rotate: {
		since: '1.0.0',
		description: 'Rotating encoder buttons with button.rotate',
	},
} as const satisfies Record<string, LinkFeatureDefinition>

export type LinkFeatureId = keyof typeof LINK_FEATURES

/** Whether we can talk to a peer announcing the given protocol version */
export function isLinkProtocolCompatible(peerVersion: string): boolean {
	const ours = parseApiVersion(LINK_PROTOCOL_VERSION)
	const theirs = parseApiVersion(peerVersion)
	return !!ours && !!theirs && ours[0] === theirs[0]
}

/** Which features can be used towards a peer announcing the given protocol version */
export function getLinkPeerFeatures(peerVersion: string): Record<LinkFeatureId, boolean> {
	const compatible = isLinkProtocolCompatible(peerVersion)

	const result = {} as Record<LinkFeatureId, boolean>
	for (const [id, feature] of Object.entries(LINK_FEATURES) as [LinkFeatureId, LinkFeatureDefinition][]) {
		result[id] = compatible && isApiVersionAtLeast(peerVersion, feature.since)
	}
	return result
}
