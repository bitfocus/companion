import { faThumbtack } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'

/**
 * Pins or unpins one property of an element, so it does (or no longer does) show in the button's pinned view.
 *
 * Only shown once hovered or focused while the property is unpinned, so the full property panel stays as
 * quiet as it was; a pinned property keeps its pin visible so it can be found and removed from either view.
 */
export const PinPropertyToggle = observer(function PinPropertyToggle({
	elementProps,
	property,
}: {
	elementProps: Readonly<SomeButtonGraphicsElement>
	property: string
}) {
	const { controlId } = useElementPropertiesContext()
	const setPinnedMutation = useMutationExt(trpc.controls.styles.setElementPropertyPinned.mutationOptions())

	// The canvas holds button-level properties, which are not pinnable
	const isPinnable = elementProps.type !== 'canvas'
	const isPinned = isPinnable && elementProps.pinnedProperties.includes(property)

	const togglePinned = useCallback(
		(e: React.MouseEvent) => {
			// The toggle sits inside the field's <label>, which would otherwise focus the input
			e.preventDefault()

			setPinnedMutation
				.mutateAsync({ controlId, elementId: elementProps.id, property, pinned: !isPinned })
				.catch((e) => {
					console.error('Failed to update pinned property', e)
				})
		},
		[setPinnedMutation, controlId, elementProps.id, property, isPinned]
	)

	if (!isPinnable) return null

	return (
		<button
			type="button"
			className={classNames('property-pin-toggle', { pinned: isPinned })}
			onClick={togglePinned}
			title={isPinned ? 'Unpin from the pinned view' : 'Pin to the pinned view'}
			aria-pressed={isPinned}
			aria-label={isPinned ? 'Unpin property' : 'Pin property'}
		>
			<FontAwesomeIcon icon={faThumbtack} />
		</button>
	)
})
