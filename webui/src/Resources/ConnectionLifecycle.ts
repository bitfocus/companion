import type { createWSClient } from '@trpc/client'

type TRPCWebSocketClient = ReturnType<typeof createWSClient>

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
}
