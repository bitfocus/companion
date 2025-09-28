import { createTRPCClient, loggerLink, wsLink, createWSClient } from '@trpc/client'
import type { AppRouter } from '../../companion/lib/UI/TRPC.js'
import { COMPANION_URL } from './util.js'

// Build WebSocket URL for tRPC
const trpcUrl = COMPANION_URL.replace(/^http/, 'ws') + '/trpc'

// console.log('Connecting to tRPC at:', trpcUrl)

export const trpcWsClient = createWSClient({
	url: trpcUrl,
})

export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		loggerLink({
			enabled: (opts) =>
				process.env.NODE_ENV === 'development' || (opts.direction === 'down' && opts.result instanceof Error),
		}),
		wsLink({
			client: trpcWsClient,
		}),
	],
})

/**
 * Perform a full reset of the companion configuration
 * This will reset all aspects of the system to a clean state
 */
export async function performFullReset(): Promise<void> {
	// console.log('Performing full configuration reset...')

	try {
		await trpcClient.importExport.resetConfiguration.mutate({
			buttons: true,
			connections: true,
			surfaces: true,
			triggers: true,
			customVariables: true,
			expressionVariables: true,
			userconfig: true,
		})

		// console.log('Full configuration reset completed successfully')
	} catch (error) {
		console.error('Failed to reset configuration:', error)
		throw error
	}
}

/**
 * Cleanup and close the tRPC connection
 */
export async function closeTrpcConnection(): Promise<void> {
	try {
		await trpcWsClient.close()
		console.log('tRPC connection closed')
	} catch (error) {
		console.error('Error closing tRPC connection:', error)
	}
}
