import { Input } from '@base-ui/react'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback } from 'react'
import { Button } from '~/Components/Button'
import { InputGroup } from '~/Components/Form'

export interface SearchBoxProps {
	className?: string
	placeholder?: string
	filter: string
	setFilter: (filter: string) => void
}

export function SearchBox({ className, placeholder, filter, setFilter }: SearchBoxProps): React.JSX.Element {
	const updateFilter = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.currentTarget.value),
		[setFilter]
	)
	const clearFilter = useCallback(() => setFilter(''), [setFilter])

	return (
		<InputGroup className={className}>
			<Input
				type="text"
				className="text-input-field"
				placeholder={placeholder || 'Search ...'}
				onChange={updateFilter}
				value={filter}
				aria-label="Search"
			/>
			<Button color="primary" onClick={clearFilter} aria-label="Clear search filter" title="Clear search filter">
				<FontAwesomeIcon icon={faTimes} />
			</Button>
		</InputGroup>
	)
}
