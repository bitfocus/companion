import { CButton, CInputGroup, CInputGroupAppend, CInputGroupPrepend } from '@coreui/react'
import React, { memo, useCallback, useContext, useMemo } from 'react'
import { PagesContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import Select from 'react-select'

export const ButtonGridHeader = memo(function ButtonGridHeader({ pageNumber, changePage, setPage, children }) {
	const pagesContext = useContext(PagesContext)

	const inputChange = useCallback(
		(val) => {
			const val2 = Number(val?.value)
			if (!isNaN(val2)) {
				setPage(val2)
			}
		},
		[setPage]
	)

	const nextPage = useCallback(() => {
		changePage(1)
	}, [changePage])
	const prevPage = useCallback(() => {
		changePage(-1)
	}, [changePage])

	const pageOptions = useMemo(() => {
		return Object.entries(pagesContext).map(([index, value]) => ({
			value: index,
			label: `${index} (${value.name})`,
		}))
	}, [pagesContext])

	const currentValue = useMemo(() => {
		return pageOptions.find((o) => o.value == pageNumber) ?? { value: pageNumber, label: pageNumber }
	}, [pageOptions, pageNumber])

	return (
		<div className="button-grid-header">
			<CInputGroup>
				<CInputGroupPrepend>
					<CButton color="dark" hidden={!changePage} onClick={prevPage}>
						<FontAwesomeIcon icon={faChevronLeft} />
					</CButton>
				</CInputGroupPrepend>
				<Select
					className="button-page-input"
					isDisabled={!setPage}
					placeholder={pageNumber}
					classNamePrefix={'select-control'}
					isClearable={false}
					isSearchable={true}
					isMulti={false}
					options={pageOptions}
					value={currentValue}
					onChange={inputChange}
				/>
				<CInputGroupAppend>
					<CButton color="dark" hidden={!changePage} onClick={nextPage}>
						<FontAwesomeIcon icon={faChevronRight} />
					</CButton>
				</CInputGroupAppend>
			</CInputGroup>
			<div className="right-buttons">{children}</div>
		</div>
	)
})
