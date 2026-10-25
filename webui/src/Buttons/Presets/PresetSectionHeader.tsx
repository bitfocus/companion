import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useActivateOnKey } from '~/Hooks/useActivateOnKey.js'

interface PresetSectionHeaderProps {
	name: string
	description: string | null
	isCollapsed: boolean
	toggleCollapsed: () => void
}

/** The header of a section of presets, which opens and closes it */
export function PresetSectionHeader({
	name,
	description,
	isCollapsed,
	toggleCollapsed,
}: PresetSectionHeaderProps): React.JSX.Element {
	const onKeyDown = useActivateOnKey(toggleCollapsed)

	return (
		<div
			className="collapsible-tree-group-row presets-section-row"
			role="button"
			tabIndex={0}
			aria-expanded={!isCollapsed}
			onClick={toggleCollapsed}
			onKeyDown={onKeyDown}
		>
			<FontAwesomeIcon icon={!isCollapsed ? faCaretDown : faCaretRight} className="collapsible-tree-caret" />
			{name}
			{!!description && <div className="presets-section-description">{description}</div>}
		</div>
	)
}
