import './Badge.css'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import type { HTMLAttributes } from 'react'

export type BadgeColor = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
	/** Sets the colour context of the badge, matching the themed colours used by Alert */
	color: BadgeColor
	/** Optional leading glyph, for a badge which reads better with one (a warning triangle, say) */
	icon?: IconDefinition
	className?: string
	children: React.ReactNode
}

/**
 * A short word labelling the thing it sits beside, for a state which needs to be legible at a glance
 * in a dense list ("Deprecated", "Beta") rather than hidden behind a tooltip on a bare icon.
 */
export function Badge({ color, icon, className, children, ...rest }: BadgeProps): React.JSX.Element {
	return (
		<span className={classNames('badge-pill', `badge-pill-${color}`, className)} {...rest}>
			{icon && <FontAwesomeIcon icon={icon} className="badge-pill-icon" />}
			{children}
		</span>
	)
}
