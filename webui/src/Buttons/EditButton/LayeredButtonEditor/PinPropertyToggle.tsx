import { faThumbtack, faThumbtackSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useState } from 'react'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'

/**
 * Pins or unpins one property of an element, so it does (or no longer does) show in the button's pinned view.
 *
 * In an element's own panel a pinned property keeps its pin showing, so the panel says at a glance what is
 * pinned; everything else only appears once its row is hovered or the toggle focused. The pinned view shows
 * none of them at rest - everything there is pinned, so a column of pins is noise rather than information.
 *
 * The icon becomes a struck-through pin only while the toggle itself is hovered or focused, so a visible pin
 * reads as "pinned" rather than as the unpin it is about to do.
 */
export const PinPropertyToggle = observer(function PinPropertyToggle({
	elementProps,
	property,
}: {
	elementProps: Readonly<SomeButtonGraphicsElement>
	property: string
}) {
	const { controlId, isPinnedView } = useElementPropertiesContext()
	const setPinnedMutation = useMutationExt(trpc.controls.styles.setElementPropertyPinned.mutationOptions())

	const [isTargeted, setIsTargeted] = useState(false)

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
			// Only the element's own panel keeps a pinned property's pin on show
			className={classNames('property-pin-toggle', { pinned: isPinned && !isPinnedView })}
			onClick={togglePinned}
			onPointerEnter={() => setIsTargeted(true)}
			onPointerLeave={() => setIsTargeted(false)}
			onFocus={() => setIsTargeted(true)}
			onBlur={() => setIsTargeted(false)}
			title={isPinned ? 'Unpin from the pinned view' : 'Pin to the pinned view'}
			aria-pressed={isPinned}
			aria-label={isPinned ? 'Unpin property' : 'Pin property'}
		>
			<FontAwesomeIcon icon={isPinned && isTargeted ? faThumbtackSlash : faThumbtack} />
		</button>
	)
})
