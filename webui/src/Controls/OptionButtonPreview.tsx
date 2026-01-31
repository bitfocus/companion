import React, { useState } from 'react'
import { ButtonPreviewBase } from '~/Components/ButtonPreview.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'

interface OptionButtonPreviewProps {
	controlId: string
	options: ExpressionableOptionsObject
}

/**
 * Preview a button based on the selected options
 * @param {string} param.location where this preview is located (if any)
 * @returns
 */
export function OptionButtonPreview({ controlId, options }: OptionButtonPreviewProps): React.JSX.Element {
	const [image, setImage] = useState<string | null>(null)
	useSubscription(
		trpc.preview.graphics.reference.subscriptionOptions(
			{ controlId, options },
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
