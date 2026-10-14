import classNames from 'classnames'
import { Button } from './Button.js'
import './StatusFilterPill.css'

export interface StatusFilterPillProps {
	label: string
	count: number
	dotClass?: string
	isActive: boolean
	onClick: () => void
	title?: string
}

export function StatusFilterPill({
	label,
	count,
	dotClass,
	isActive,
	onClick,
	title,
}: StatusFilterPillProps): React.JSX.Element {
	return (
		<Button
			variant="filter"
			className="status-filter-pill"
			onClick={onClick}
			title={title || `Filter by ${label}`}
			disabled={count === 0}
			active={isActive}
		>
			{dotClass && <span className={classNames('status-filter-pill-dot', dotClass)} />}
			<span>{label}</span>
			<span className="status-filter-pill-count">{count}</span>
		</Button>
	)
}
