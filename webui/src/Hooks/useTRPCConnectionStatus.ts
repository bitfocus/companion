import { useEffect, useState } from 'react'
import { trpcWsClient } from '~/TRPC'
import { assertNever } from '~/util'

export enum TRPCConnectionStatus {
	Unknown = 'unknown',
	Connecting = 'connecting',
	Connected = 'connected',
	// Reconnecting = 'reconnecting',
}

export interface TRPCConnectionState {
	status: TRPCConnectionStatus
	error?: string
}

export function useTRPCConnectionStatus(): TRPCConnectionState {
	const [status, setStatus] = useState<TRPCConnectionState>({ status: TRPCConnectionStatus.Connecting })

	useEffect(() => {
		const handle = trpcWsClient.connectionState.subscribe({
			next: (state) => {
				switch (state.state) {
					case 'connecting':
						setStatus({ status: TRPCConnectionStatus.Connecting })
						break
					case 'pending':
						setStatus({ status: TRPCConnectionStatus.Connected })
						break
					case 'idle':
						setStatus({ status: TRPCConnectionStatus.Unknown })
						break
					default:
						assertNever(state)
						setStatus({ status: TRPCConnectionStatus.Unknown })
						break
				}
				console.log('TRPC connection state changed:', state)
			},
			error: (error) => {
				// console.error('TRPC connection error:', error)
				setStatus({ status: TRPCConnectionStatus.Unknown, error })
			},
			complete: () => {
				// console.log('TRPC connection completed')
				setStatus({ status: TRPCConnectionStatus.Unknown })
			},
		})

		switch (trpcWsClient.connection?.state) {
			case 'connecting':
				setStatus({ status: TRPCConnectionStatus.Connecting })
				break
			case 'closed':
				setStatus({ status: TRPCConnectionStatus.Unknown })
				break
			case 'open':
				setStatus({ status: TRPCConnectionStatus.Connected })
				break
			case undefined:
				setStatus({ status: TRPCConnectionStatus.Unknown })
				break
			default:
				assertNever(trpcWsClient.connection)
				setStatus({ status: TRPCConnectionStatus.Unknown })
				break
		}

		return () => {
			handle.unsubscribe()
		}
	}, [])

	return status
}
