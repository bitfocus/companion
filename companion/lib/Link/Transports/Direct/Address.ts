/**
 * Resolve what the user entered as the address of an installation accepting direct connections.
 *
 * Either a full url, for when it is behind a reverse proxy (eg `wss://proxy.example.com/companion-link`, with
 * `http(s)://` accepted as a synonym of `ws(s)://`), or just a host with an optional port (eg `192.168.1.10`,
 * `studio-a.local:1234`, `[fe80::1]`), which is connected to directly with the default port.
 *
 * The connection is encrypted and authenticated by the transport itself, so plain `ws://` is as safe as `wss://`;
 * `wss://` is supported for proxies that require it.
 */
export function resolveDirectAddress(
	address: string,
	defaultPort: number
): { ok: true; url: string } | { ok: false; error: string } {
	const trimmed = address.trim()
	if (!trimmed) return { ok: false, error: 'No address is set' }

	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
		let url: URL
		try {
			url = new URL(trimmed)
		} catch {
			return { ok: false, error: `"${trimmed}" is not a valid address` }
		}

		switch (url.protocol) {
			case 'ws:':
			case 'wss:':
				break
			case 'http:':
				url.protocol = 'ws:'
				break
			case 'https:':
				url.protocol = 'wss:'
				break
			default:
				return {
					ok: false,
					error: `Unsupported address type "${url.protocol}", use ws://, wss://, http:// or https://`,
				}
		}
		url.hash = ''
		return { ok: true, url: url.toString() }
	}

	// A host, with an optional port. A bare ipv6 address has several colons and no brackets
	let host = trimmed
	let port = defaultPort
	const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(trimmed)
	const hostPort = /^([^:/\s]+)(?::(\d+))?$/.exec(trimmed)
	if (bracketed) {
		host = `[${bracketed[1]}]`
		if (bracketed[2]) port = Number(bracketed[2])
	} else if (hostPort) {
		host = hostPort[1]
		if (hostPort[2]) port = Number(hostPort[2])
	} else if (trimmed.includes(':') && !trimmed.includes('/')) {
		host = `[${trimmed}]`
	} else {
		return { ok: false, error: `"${trimmed}" is not a valid address` }
	}

	if (port < 1 || port > 65535) return { ok: false, error: `Port ${port} is not valid` }

	try {
		return { ok: true, url: new URL(`ws://${host}:${port}/`).toString() }
	} catch {
		return { ok: false, error: `"${trimmed}" is not a valid address` }
	}
}

/**
 * Format the address a connection came from, to show the user: an IPv4 address without the `::ffff:` prefix Node
 * gives it on a dual-stack socket, and an IPv6 one in brackets, so the port is clear
 */
export function formatRemoteAddress(ip: string | undefined, port: number | undefined): string {
	const address = (ip ?? 'unknown').replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '')
	return address.includes(':') ? `[${address}]:${port}` : `${address}:${port}`
}

/**
 * The host a connection counts towards the limits as: its IPv4 address, or its IPv6 address's /64, as one host can use
 * any address in its /64
 */
export function remoteHostKey(ip: string): string {
	const address = ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '').replace(/%.*$/, '')
	if (!address.includes(':')) return address

	const [head, tail] = address.split('::').map((part) => (part ? part.split(':') : []))
	const groups = tail ? [...head, ...Array<string>(8 - head.length - tail.length).fill('0'), ...tail] : head
	return `${groups.slice(0, 4).join(':')}::/64`
}
