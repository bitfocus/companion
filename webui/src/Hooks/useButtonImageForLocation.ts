import { useState } from 'react'
import type { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

/**
 * Load and retrieve a button image for a specific control location.
 * @param location Location of the control to load
 * @param disable Disable loading of this preview
 * @returns
 */
export function useButtonImageForLocation(location: ControlLocation, disable = false): WrappedImage {
	const [imageState, setImageState] = useState<WrappedImage>({ image: null, isUsed: false })

	useSubscription(
		trpc.preview.graphics.location.subscriptionOptions(
			{
				location,
			},
			{
				enabled: !disable,
				onStarted: () => {
					// TODO?
					// setImageState()
				},
				onData: (data) => {
					setImageState(data)
				},
			}
		)
	)

	return imageState
}
