import { useEffect, useState } from 'react'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

/**
 * Load and retrieve a button image for a specific control id.
 * @param location Location of the control to load
 * @param disable Disable loading of this preview
 * @returns
 */
export function useButtonImageForControlId(controlId: string, disable = false): string | null {
	const [imageState, setImageState] = useState<string | null>(null)

	useSubscription(
		trpc.preview.graphics.controlId.subscriptionOptions(
			{
				controlId,
			},
			{
				enabled: !disable,
				onStarted: () => {
					setImageState(null)
				},
				onData: (data) => {
					setImageState(data)
				},
			}
		)
	)

	useEffect(() => {
		if (disable) {
			setImageState(null)
		}
	}, [disable])

	return imageState
}
