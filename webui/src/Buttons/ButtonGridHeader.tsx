import { CButton, CInputGroup, CInputGroupAppend, CInputGroupPrepend } from '@coreui/react'
import React, { memo, useCallback, useContext, useMemo } from 'react'
import { PagesContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import Select from 'react-select'
import { PageModel } from '@companion/shared/Model/PageModel'
import { DropdownChoice } from '@companion-module/base'

interface ButtonGridHeaderProps {
	pageNumber: number
	changePage?: (delta: number) => void
	setPage?: (page: number) => void
}

export const ButtonGridHeader = memo<React.PropsWithChildren<ButtonGridHeaderProps>>(function ButtonGridHeader({
	pageNumber,
	changePage,
	setPage,
	children,
}) {
	const pagesContext = useContext(PagesContext)

	const inputChange = useCallback(
		(val) => {
			const val2 = Number(val?.value)
			if (setPage && !isNaN(val2)) {
				setPage(val2)
			}
		},
		[setPage]
	)

	const nextPage = useCallback(() => {
		changePage?.(1)
	}, [changePage])
	const prevPage = useCallback(() => {
		changePage?.(-1)
	}, [changePage])

	const pageOptions: DropdownChoice[] = useMemo(() => {
		return Object.entries(pagesContext)
			.filter((pg): pg is [string, PageModel] => !!pg[1])
			.map(([index, value]) => ({
				id: index,
				label: `${index} (${value.name})`,
			}))
	}, [pagesContext])

	const currentValue: DropdownChoice | undefined = useMemo(() => {
		return pageOptions.find((o) => o.id == pageNumber) ?? { id: pageNumber, label: pageNumber + '' }
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
