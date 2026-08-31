import { faThumbtack, faThumbtackSlash } from '@fortawesome/free-solid-svg-icons'
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
 * Only shown once its property row is hovered or the toggle is focused, in both the full panel and the
 * pinned view: a column of pins next to properties which are all pinned anyway is noise, and one that is
 * always there invites a click that then takes effort to undo.
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
			<FontAwesomeIcon icon={isPinned ? faThumbtackSlash : faThumbtack} />
		</button>
	)
})
