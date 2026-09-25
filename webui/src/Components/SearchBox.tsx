import { Input } from '@base-ui/react'
import './text-field.css'
import classNames from 'classnames'
import { Search, X } from 'lucide-react'
import { useCallback } from 'react'

export interface SearchBoxProps {
	className?: string
	placeholder?: string
	filter: string
	setFilter: (filter: string) => void
	autoFocus?: boolean
	onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
	ariaControls?: string
	ariaActiveDescendant?: string
}

export function SearchBox({
	className,
	placeholder,
	filter,
	setFilter,
	autoFocus,
	onKeyDown,
	ariaControls,
	ariaActiveDescendant,
}: SearchBoxProps): React.JSX.Element {
	const updateFilter = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.currentTarget.value),
		[setFilter]
	)
	const clearFilter = useCallback(() => setFilter(''), [setFilter])

	return (
		<div className={classNames('search-box h-9', className)}>
			<Search size={16} className="search-box-icon" aria-hidden="true" />
			<Input
				type="search"
				className="form-input text-input-field search-box-input h-full text-sm py-0"
				placeholder={placeholder || 'Search ...'}
				onChange={updateFilter}
				onKeyDown={onKeyDown}
				value={filter}
				aria-label="Search"
				autoFocus={autoFocus}
				role={ariaControls ? 'combobox' : undefined}
				aria-autocomplete={ariaControls ? 'list' : undefined}
				aria-expanded={ariaControls ? true : undefined}
				aria-controls={ariaControls}
				aria-activedescendant={ariaActiveDescendant}
			/>
			{filter && (
				<button type="button" className="search-box-clear" onClick={clearFilter} aria-label="Clear search filter">
					<X size={14} aria-hidden="true" />
				</button>
			)}
		</div>
	)
}
