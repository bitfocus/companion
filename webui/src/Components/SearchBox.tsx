import { CInputGroup, CInput, CInputGroupAppend, CButton } from '@coreui/react'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'

export interface SearchBoxProps {
	filter: string
	setFilter(filter: string): void
}

export function SearchBox({ filter, setFilter }: SearchBoxProps) {
	const updateFilter = useCallback((e) => setFilter(e.currentTarget.value), [setFilter])
	const clearFilter = useCallback(() => setFilter(''), [setFilter])

	return (
		<CInputGroup>
			<CInput
				type="text"
				placeholder="Search ..."
				onChange={updateFilter}
				value={filter}
				style={{ fontSize: '1.2em' }}
			/>
			<CInputGroupAppend>
				<CButton color="danger" onClick={clearFilter}>
					<FontAwesomeIcon icon={faTimes} />
				</CButton>
			</CInputGroupAppend>
		</CInputGroup>
	)
}
