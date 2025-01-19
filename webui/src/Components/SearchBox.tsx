import { CInputGroup, CButton, CFormInput } from '@coreui/react'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'

export interface SearchBoxProps {
	filter: string
	setFilter(filter: string): void
}

export function SearchBox({ filter, setFilter }: SearchBoxProps) {
	const updateFilter = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.currentTarget.value),
		[setFilter]
	)
	const clearFilter = useCallback(() => setFilter(''), [setFilter])

	return (
		<CInputGroup className="searchbox">
			<CFormInput
				type="text"
				placeholder="Search ..."
				onChange={updateFilter}
				value={filter}
				style={{ fontSize: '1.2em' }}
			/>
			<CButton color="danger" onClick={clearFilter}>
				<FontAwesomeIcon icon={faTimes} />
			</CButton>
		</CInputGroup>
	)
}
