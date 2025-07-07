import React, { useState } from 'react'
import { ButtonPreviewBase } from '~/Components/ButtonPreview.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/TRPC'

interface OptionButtonPreviewProps {
	location: ControlLocation | undefined
	options: Record<string, any>
}

/**
 * Preview a button based on the selected options
 * @param {string} param.location where this preview is located (if any)
 * @returns
 */
export function OptionButtonPreview({ location, options }: OptionButtonPreviewProps): React.JSX.Element {
	const [image, setImage] = useState<string | null>(null)
	useSubscription(
		trpc.preview.graphics.reference.subscriptionOptions(
			{ location, options },
			{
				onStarted: () => {
					setImage(null)
				},
				onData: (data) => {
					setImage(data)
				},
				onError: (err) => {
					console.error('Subscription error', err)
					setImage(null)
				},
			}
		)
	)

	return <ButtonPreviewBase fixedSize preview={image} /> // TODO - noPad?
}
