const ensureFileUrl = (url: string) => {
	if (process.platform === 'win32' && !url.startsWith('file://')) {
		// Windows is picky about import paths, this is a crude hack to 'fix' it
		return `file://${url}`
	} else {
		return url
	}
}

export async function importModuleFromPath(modulePath: string): Promise<any> {
	return import(ensureFileUrl(modulePath))
}

/**
 * Seal the parent IPC channel off the global `process` object so a loaded module cannot reach
 * around the sanctioned HostContext API to bypass our validation and talk to the host directly.
 *
 * This must be called by a module-child entrypoint *before* any module code is imported. It:
 * - installs the entrypoint's own `message`/`disconnect` listeners,
 * - replaces `process.send` with a throwing stub (blocking outbound abuse like hand-crafted
 *   IpcWrapper packets), and
 * - locks the `process` EventEmitter registration methods so a module cannot attach its own
 *   `message`/`disconnect` listener to receive unsanctioned host messages.
 *
 * The returned function is the captured, still-working send — wire it into the IpcWrapper
 * transport. It is the only way to obtain a working send once this has run.
 *
 * Notes / limitations:
 * - `process.channel` is deliberately left intact: replacing it breaks inbound message
 *   reception (Node's read path depends on it). It is not a practical outbound vector
 *   without reconstructing Node's private IPC framing.
 */
export function sealParentIpcChannel(handlers: {
	onMessage: (msg: any) => void
	onDisconnect: () => void
}): (message: any) => void {
	if (!process.send) throw new Error('Module is not being run with ipc')
	const boundSend = process.send.bind(process)

	// Install our own listeners using the real methods, before they are locked down below
	process.on('message', handlers.onMessage)
	process.on('disconnect', handlers.onDisconnect)

	// Seal outbound: a module can no longer send raw messages to the host
	Object.defineProperty(process, 'send', {
		value: () => {
			throw new Error('Modules must communicate via the provided HostContext, not process.send')
		},
		writable: false,
		configurable: false,
		enumerable: false,
	})

	// Lock inbound: a module can no longer register a listener for the IPC events (which would
	// let it receive unsanctioned host messages) or remove ours. All other process events
	// (SIGINT, exit, uncaughtException, ...) pass straight through.
	const BLOCKED_EVENTS = new Set(['message', 'disconnect'])
	const listenerMethods = [
		'on',
		'addListener',
		'once',
		'prependListener',
		'prependOnceListener',
		'off',
		'removeListener',
		'removeAllListeners',
	] as const
	const proc = process as unknown as Record<string, (...args: any[]) => unknown>
	for (const name of listenerMethods) {
		const original = proc[name].bind(process)
		Object.defineProperty(process, name, {
			value: (event?: unknown, ...rest: unknown[]) => {
				const blocked = typeof event === 'string' && BLOCKED_EVENTS.has(event)
				// removeAllListeners() with no argument would otherwise nuke our own listeners
				const nukeAll = name === 'removeAllListeners' && event === undefined
				if (blocked || nukeAll) {
					throw new Error(
						`Modules must communicate via the provided HostContext; direct process.${name}('${String(event)}', ...) is not allowed`
					)
				}
				return original(event, ...rest)
			},
			writable: false,
			configurable: false,
		})
	}

	return (message) => {
		boundSend(message)
	}
}
