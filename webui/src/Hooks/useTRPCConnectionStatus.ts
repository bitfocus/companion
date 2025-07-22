import { useEffect, useState } from 'react'
import { trpcWsClient } from '~/Resources/TRPC'
import { assertNever } from '~/Resources/util'

export enum TRPCConnectionStatus {
	Unknown = 'unknown',
	Connecting = 'connecting',
	Connected = 'connected',
	// Reconnecting = 'reconnecting',
}

export interface TRPCConnectionState {
	status: TRPCConnectionStatus
	wasConnected: boolean
	error?: string
}

export function useTRPCConnectionStatus(): TRPCConnectionState {
	const [status, setStatus] = useState<TRPCConnectionState>({
		status: TRPCConnectionStatus.Connecting,
		wasConnected: false,
	})

	useEffect(() => {
		const setTrpcStatus = (newStatus: TRPCConnectionStatus, error?: string) => {
			setStatus((oldStatus) => ({
				status: newStatus,
				wasConnected: oldStatus.wasConnected || oldStatus.status === TRPCConnectionStatus.Connected,
				error: error,
			}))
		}

		const handle = trpcWsClient.connectionState.subscribe({
			next: (state) => {
				switch (state.state) {
					case 'connecting':
						setTrpcStatus(TRPCConnectionStatus.Connecting)
						break
					case 'pending':
						setTrpcStatus(TRPCConnectionStatus.Connected)
						break
					case 'idle':
						setTrpcStatus(TRPCConnectionStatus.Unknown)
						break
					default:
						assertNever(state)
						setTrpcStatus(TRPCConnectionStatus.Unknown)
						break
				}
				console.log('TRPC connection state changed:', state)
			},
			error: (error) => {
				// console.error('TRPC connection error:', error)
				setTrpcStatus(TRPCConnectionStatus.Unknown, error)
			},
			complete: () => {
				// console.log('TRPC connection completed')
				setTrpcStatus(TRPCConnectionStatus.Unknown)
			},
		})

		switch (trpcWsClient.connection?.state) {
			case 'connecting':
				setTrpcStatus(TRPCConnectionStatus.Connecting)
				break
			case 'closed':
				setTrpcStatus(TRPCConnectionStatus.Unknown)
				break
			case 'open':
				setTrpcStatus(TRPCConnectionStatus.Connected)
				break
			case undefined:
				setTrpcStatus(TRPCConnectionStatus.Unknown)
				break
			default:
				assertNever(trpcWsClient.connection)
				setTrpcStatus(TRPCConnectionStatus.Unknown)
				break
		}

		return () => {
			handle.unsubscribe()
		}
	}, [setStatus])

	return status
}
