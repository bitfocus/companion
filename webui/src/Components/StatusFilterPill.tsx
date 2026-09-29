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
			aria-pressed={isActive}
			className={classNames(
				'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-all border cursor-pointer select-none',
				{
					'bg-selection-bg border-selection-border text-selection-text shadow-xs font-semibold': isActive && !isZero,
					'bg-transparent border-transparent text-action-text hover:text-body hover:bg-secondary/20':
						!isActive && !isZero,
					'border-transparent text-action-disabled-text cursor-default hover:bg-transparent': isZero,
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
