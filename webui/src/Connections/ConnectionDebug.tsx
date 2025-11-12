import React, { useCallback } from 'react'
import { useParams } from '@tanstack/react-router'
import { trpc, useMutationExt } from '../Resources/TRPC'
import { InstanceDebugLog } from '../Instances/DebugLog'

export function ConnectionDebug(): React.JSX.Element {
	const { connectionId } = useParams({ from: '/connection-debug/$connectionId' })

	const setEnabledMutation = useMutationExt(trpc.instances.connections.setEnabled.mutationOptions())

	const setEnabled = useCallback(
		(enabled: boolean) => {
			if (!connectionId) return
			setEnabledMutation.mutateAsync({ connectionId, enabled }).catch((e) => {
				console.error('Failed', e)
			})
		},
		[setEnabledMutation, connectionId]
	)

	return <InstanceDebugLog instanceId={connectionId} instanceTypeStr="connection" setEnabled={setEnabled} />
}
