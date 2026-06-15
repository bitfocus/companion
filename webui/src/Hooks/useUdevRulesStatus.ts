import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import type { UdevRulesStatus } from '@companion-app/shared/Model/Common.js'
import { trpc } from '~/Resources/TRPC'

/**
 * Subscribe to the status of the Linux udev rules that grant access to USB surfaces.
 * Returns null until the first value is received (and on non-Linux platforms `supported` will be false).
 */
export function useUdevRulesStatus(): UdevRulesStatus | null {
	const [status, setStatus] = useState<UdevRulesStatus | null>(null)

	useSubscription(
		trpc.instances.udevRules.status.subscriptionOptions(undefined, {
			onData: (data) => setStatus(data),
			onError: (error) => {
				console.error('Failed to subscribe to udev rules status:', error)
			},
		})
	)

	return status
}
