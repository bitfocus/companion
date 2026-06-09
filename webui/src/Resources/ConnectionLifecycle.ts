import type { createWSClient } from '@trpc/client'

type TRPCWebSocketClient = ReturnType<typeof createWSClient>

/** How long after a resume trigger to wait for the connection to become healthy before kicking it */
const WATCHDOG_GRACE_MS = 5_000

/**
 * Wire up page lifecycle handling for the tRPC WebSocket connection.
 *
 * Safari (and other browsers) may put the page into the back/forward cache (bfcache)
 * instead of destroying it on navigation. When that happens the JS heap is frozen and
 * later restored verbatim, so we must be careful not to permanently disable the ws
 * client on the way out, and must recover the (dead) connection on the way back in.
 */
export function setupConnectionLifecycle(trpcWsClient: TRPCWebSocketClient): void {
	// Close the connection only when the page is genuinely being unloaded.
	// On bfcache entry (persisted === true) we must NOT call close(), because
	// trpcWsClient.close() permanently disables reconnection and Safari may
	// restore this exact JS heap later.
	window.addEventListener('pagehide', (event) => {
		if (!event.persisted) {
			trpcWsClient.close().catch((err) => {
				console.error('Error closing TRPC WebSocket client on unload:', err)
			})
		}
	})

	// If Safari restores the page from bfcache, the WebSocket is dead (and the
	// client state may be stale). A full reload is the most reliable recovery.
	window.addEventListener('pageshow', (event) => {
		if (event.persisted) {
			window.location.reload()
		}
	})

	// Watchdog: when the page resumes (becomes visible, regains network/focus), verify the
	// connection is actually healthy within a grace period, and if not force-close the raw
	// WebSocket so the trpc client's reconnect logic runs immediately. This recovers both
	// "zombie OPEN" sockets (readyState OPEN but TCP dead after device sleep) and sockets
	// stuck in CONNECTING, without waiting for keepalive timeouts or - in the wedged case -
	// forever.

	let watchdogTimer: ReturnType<typeof setTimeout> | undefined

	const isHealthy = (): boolean => {
		// 'pending' is the trpc ws client state meaning connected & ready
		// (connectionState accessor verified against @trpc/client 11.17.0)
		return trpcWsClient.connectionState.get().state === 'pending'
	}

	const kickConnection = (reason: string): void => {
		// `connection` is the backward-compat accessor exposing the raw ws
		// (verified against @trpc/client 11.17.0)
		const conn = trpcWsClient.connection
		console.warn(`Connection watchdog: forcing socket close (${reason})`, conn?.state)
		try {
			// Closing a CONNECTING socket aborts the handshake; closing an OPEN one fires the
			// client's close handler - both trigger the trpc client's reconnect immediately.
			conn?.ws.close()
		} catch (_e) {
			// ignore
		}
		// If there is no raw ws to kick, the client's own retry timer will fire; nothing else to do.
		// Never call trpcWsClient.close() here - that permanently disables reconnection.
	}

	const scheduleCheck = (trigger: string): void => {
		if (document.visibilityState !== 'visible') return
		if (watchdogTimer) clearTimeout(watchdogTimer)
		if (isHealthy()) return

		watchdogTimer = setTimeout(() => {
			watchdogTimer = undefined
			if (!isHealthy()) kickConnection(trigger)
		}, WATCHDOG_GRACE_MS)
	}

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') scheduleCheck('visibilitychange')
	})
	window.addEventListener('online', () => scheduleCheck('online'))
	window.addEventListener('pageshow', () => scheduleCheck('pageshow'))
	window.addEventListener('focus', () => scheduleCheck('focus'))
}
