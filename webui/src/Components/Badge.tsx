import { faCheck, faCircleExclamation, faCircleMinus, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import './Badge.css'

export type BadgeTone = 'good' | 'warning' | 'error' | 'info' | 'neutral' | 'disabled'

function getToneIcon(tone: BadgeTone): React.ReactNode {
	switch (tone) {
		case 'warning':
			return <FontAwesomeIcon icon={faTriangleExclamation} className="text-3xs shrink-0" aria-hidden="true" />
		case 'error':
			return <FontAwesomeIcon icon={faCircleExclamation} className="text-3xs shrink-0" aria-hidden="true" />
		case 'good':
			return <FontAwesomeIcon icon={faCheck} className="text-3xs shrink-0" aria-hidden="true" />
		case 'disabled':
			return <FontAwesomeIcon icon={faCircleMinus} className="text-3xs shrink-0" aria-hidden="true" />
		default:
			return null
	}
}

interface BadgeProps {
	tone: BadgeTone
	/** Optional leading element (a spinner, a pulsing dot); used in place of the tone's icon. */
	indicator?: React.ReactNode
	/** Hover text, for detail that does not fit in the badge itself. */
	title?: string
	className?: string
	children: React.ReactNode
}

export function Badge({ tone, indicator, title, className, children }: BadgeProps): React.JSX.Element {
	return (
		<span className={classNames('status-badge', className)} data-tone={tone} title={title}>
			{indicator ?? getToneIcon(tone)}
			{children}
		</span>
	)
}

/** Map an `InstanceStatusEntry['category']` (a free-form string from the module) to a badge tone. */
export function badgeToneForStatusCategory(category: string | null | undefined): BadgeTone {
	switch (category) {
		case 'good':
			return 'good'
		case 'warning':
			return 'warning'
		case 'error':
			return 'error'
		default:
			return 'neutral'
	}
}
