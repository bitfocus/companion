import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { EDIT_TAB_CLASS, EDIT_TAB_INACTIVE_CLASS } from './editPanelTabStyles.js'

/** An external destination in an editor's tab bar, marked with an external-link icon. */
export function EditPanelTabLink({
	href,
	icon,
	label,
}: {
	href: string
	icon: IconDefinition
	label: string
}): React.JSX.Element {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={classNames(EDIT_TAB_CLASS, EDIT_TAB_INACTIVE_CLASS, 'no-underline')}
		>
			<FontAwesomeIcon icon={icon} className="text-muted" />
			<span>{label}</span>
			<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-3xs text-muted" />
		</a>
	)
}
