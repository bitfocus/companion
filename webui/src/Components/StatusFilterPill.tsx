import classNames from 'classnames'

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
	const isZero = count === 0

	return (
		<button
			type="button"
			onClick={onClick}
			title={title || `Filter by ${label}`}
			disabled={isZero}
			className={classNames(
				'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-all border cursor-pointer select-none',
				{
					'bg-secondary/40 border-secondary text-body shadow-xs font-semibold': isActive && !isZero,
					'bg-transparent border-transparent text-muted hover:text-body hover:bg-secondary/20': !isActive && !isZero,
					'opacity-40 border-transparent text-muted cursor-default hover:text-muted hover:bg-transparent': isZero,
				}
			)}
		>
			{dotClass && <span className={classNames('w-2 h-2 rounded-full shrink-0', dotClass)} />}
			<span>{label}</span>
			<span
				className={classNames(
					'px-1.5 py-0.5 rounded-full text-3xs font-semibold leading-none',
					isActive && !isZero ? 'bg-secondary text-body' : 'bg-secondary/30 text-muted'
				)}
			>
				{count}
			</span>
		</button>
	)
}
