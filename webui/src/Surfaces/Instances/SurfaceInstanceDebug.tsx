import React, { useCallback } from 'react'
import { useParams } from '@tanstack/react-router'
import { trpc, useMutationExt } from '../../Resources/TRPC'
import { InstanceDebugLog } from '../../Instances/DebugLog'

export function SurfaceInstanceDebug(): React.JSX.Element {
	const { instanceId } = useParams({ from: '/_standalone/surfaces/debug/$instanceId' })

	const setEnabledMutation = useMutationExt(trpc.instances.surfaces.setEnabled.mutationOptions())

	const setEnabled = useCallback(
		(enabled: boolean) => {
			if (!instanceId) return
			setEnabledMutation.mutateAsync({ instanceId, enabled }).catch((e) => {
				console.error('Failed', e)
			})
		},
		[setEnabledMutation, instanceId]
	)

	return <InstanceDebugLog instanceId={instanceId} instanceTypeStr="surface integration" setEnabled={setEnabled} />
}
