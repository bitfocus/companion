import {
	faArrowsLeftRight,
	faArrowsUpDown,
	faExpand,
	faLayerGroup,
	faLink,
	faMagnet,
	faObjectGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Toolbar } from '~/Components/Toolbar.js'

export interface QuickActionsToolbarProps {
	onCenterHorizontal: () => void
	onCenterVertical: () => void
	onFill: () => void
	linked: boolean
	onToggleLinked: () => void
	snapEnabled: boolean
	onToggleSnapEnabled: () => void
	onBringToFront: () => void
	onSendToBack: () => void
	canBringToFront: boolean
	canSendToBack: boolean
	/** The position/scale actions need a selection with plain bounds; snapping and z-order don't */
	boundsDisabled: boolean
	/** Shown as a tooltip on the disabled buttons to explain why */
	boundsDisabledReason: string | null
}

/**
 * Quick actions for the selected element. Rendered as a normal row beneath the preview rather than floating
 * over it - the preview panel clips its overflow, so an absolutely positioned bar either covers the button
 * or gets cut off entirely.
 */
export function QuickActionsToolbar({
	onCenterHorizontal,
	onCenterVertical,
	onFill,
	linked,
	onToggleLinked,
	snapEnabled,
	onToggleSnapEnabled,
	onBringToFront,
	onSendToBack,
	canBringToFront,
	canSendToBack,
	boundsDisabled,
	boundsDisabledReason,
}: QuickActionsToolbarProps): React.JSX.Element {
	// Only the element-level disable (expression/nested/no selection) gets an explanation; a z-order button
	// greyed out because it's already at the front/back is self-evident.
	const reason = boundsDisabled ? boundsDisabledReason : null
	return (
		<Toolbar.Root orientation="vertical" size="sm" className="button-layer-quick-actions">
			<Toolbar.Button
				title="Center horizontally"
				icon={faArrowsLeftRight}
				onClick={onCenterHorizontal}
				disabled={boundsDisabled}
				disabledReason={reason}
			/>
			<Toolbar.Button
				title="Center vertically"
				icon={faArrowsUpDown}
				onClick={onCenterVertical}
				disabled={boundsDisabled}
				disabledReason={reason}
			/>
			<Toolbar.Button
				title="Fill (100% width and height)"
				icon={faExpand}
				onClick={onFill}
				disabled={boundsDisabled}
				disabledReason={reason}
			/>
			<Toolbar.Button
				title={linked ? 'Unlink: resize width and height independently' : 'Link: scale width and height together'}
				icon={faLink}
				active={linked}
				onClick={onToggleLinked}
				disabled={boundsDisabled}
				disabledReason={reason}
			/>
			{/* A preference for the canvas as a whole rather than an action on the selection, so it stays
			    usable no matter what (or whether anything) is selected */}
			<Toolbar.Button
				title={snapEnabled ? 'Disable snapping' : 'Enable snapping'}
				icon={faMagnet}
				active={snapEnabled}
				onClick={onToggleSnapEnabled}
			/>
			<Toolbar.Separator />
			{/* Z-order applies to any top-level element, including ones with no editable bounds (eg lines),
			    so it's gated on the can* flags alone */}
			<Toolbar.Button title="Bring to front" icon={faLayerGroup} onClick={onBringToFront} disabled={!canBringToFront} />
			<Toolbar.Button title="Send to back" icon={faObjectGroup} onClick={onSendToBack} disabled={!canSendToBack} />
		</Toolbar.Root>
	)
}
