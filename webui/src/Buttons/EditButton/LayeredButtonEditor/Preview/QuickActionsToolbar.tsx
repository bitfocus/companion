import {
	faArrowsLeftRight,
	faArrowsUpDown,
	faExpand,
	faLayerGroup,
	faLink,
	faMagnet,
	faObjectGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

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
	/** Actions are disabled when the selection isn't one the canvas can edit */
	disabled: boolean
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
	disabled,
}: QuickActionsToolbarProps): React.JSX.Element {
	return (
		<div className="button-layer-quick-actions">
			<ToolbarButton
				title="Center horizontally"
				icon={faArrowsLeftRight}
				onClick={onCenterHorizontal}
				disabled={disabled}
			/>
			<ToolbarButton title="Center vertically" icon={faArrowsUpDown} onClick={onCenterVertical} disabled={disabled} />
			<ToolbarButton title="Fill (100% width and height)" icon={faExpand} onClick={onFill} disabled={disabled} />
			<ToolbarButton
				title={linked ? 'Unlink: resize width and height independently' : 'Link: scale width and height together'}
				icon={faLink}
				active={linked}
				onClick={onToggleLinked}
				disabled={disabled}
			/>
			<ToolbarButton
				title={snapEnabled ? 'Disable snapping' : 'Enable snapping'}
				icon={faMagnet}
				active={snapEnabled}
				onClick={onToggleSnapEnabled}
				disabled={disabled}
			/>
			<div className="button-layer-quick-actions-separator" />
			<ToolbarButton
				title="Bring to front"
				icon={faLayerGroup}
				onClick={onBringToFront}
				disabled={disabled || !canBringToFront}
			/>
			<ToolbarButton
				title="Send to back"
				icon={faObjectGroup}
				onClick={onSendToBack}
				disabled={disabled || !canSendToBack}
			/>
		</div>
	)
}

function ToolbarButton({
	title,
	icon,
	onClick,
	active,
	disabled,
}: {
	title: string
	icon: Parameters<typeof FontAwesomeIcon>[0]['icon']
	onClick: () => void
	active?: boolean
	disabled?: boolean
}) {
	return (
		<button
			type="button"
			title={title}
			className={`button-layer-quick-action${active ? ' active' : ''}`}
			onClick={onClick}
			disabled={disabled}
		>
			<FontAwesomeIcon icon={icon} size="sm" />
		</button>
	)
}
