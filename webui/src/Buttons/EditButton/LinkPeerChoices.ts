import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { formatLinkIdFingerprint, type LinkButtonStatus, type LinkPeerInfo } from '@companion-app/shared/Model/Link.js'

/**
 * The installations a remote button can show a button of, named so that each can be told apart (by its fingerprint,
 * when another has the same name) and saying why one can't be used now
 */
export function linkPeerChoices(peers: readonly LinkPeerInfo[], chosenPeerId: string): DropdownChoice[] {
	const nameCounts = new Map<string, number>()
	for (const peer of peers) nameCounts.set(peer.name, (nameCounts.get(peer.name) ?? 0) + 1)

	const choices: DropdownChoice[] = peers
		.toSorted((a, b) => a.name.localeCompare(b.name))
		.map((peer) => {
			const name = (nameCounts.get(peer.name) ?? 0) > 1 ? `${peer.name} (${peer.fingerprint})` : peer.name
			const why = whyLinkPeerUnusable(peer)
			return { id: peer.id, label: why ? `${name} - ${why}` : name }
		})

	// Keep the chosen installation selectable even when it hasn't been discovered
	if (chosenPeerId && !peers.some((peer) => peer.id === chosenPeerId)) {
		choices.unshift({ id: chosenPeerId, label: `Unknown installation (${formatLinkIdFingerprint(chosenPeerId)})` })
	}
	return choices
}

/** Why buttons of an installation can't be used now, in a word or two, or null if they can */
export function whyLinkPeerUnusable(peer: LinkPeerInfo): string | null {
	if (!peer.compatible) return 'incompatible'
	if (!peer.online) return 'offline'
	if (peer.sharedWithUs?.buttons === false) return 'not shared'
	return null
}

/** What to tell the user about each status, when it needs explaining */
export const STATUS_EXPLANATIONS: Record<LinkButtonStatus, string | null> = {
	unconfigured: 'Choose an installation and a button location.',
	bad_location: "The button location isn't one this can show. Check it, and the variables it uses.",
	unknown_peer:
		'This installation has not been found on any transport. Check that it is running, and that one of the transports on the Link page can reach it, or choose another.',
	incompatible:
		'This installation runs an incompatible version of Companion Link. Update both installations to the same version of Companion.',
	offline:
		'This installation is not reachable right now. Check that it is running and on the network; this button shows it again once it is back.',
	denied:
		"This installation doesn't share its buttons with this one. On its Link page, select this installation and turn on sharing its buttons.",
	over_limit:
		'This installation is already sending as many buttons as it can to the installations using it, so it refused this one.',
	loading: null,
	loop: 'This button leads back to itself through other installations, so it would show itself.',
	ok: null,
}
