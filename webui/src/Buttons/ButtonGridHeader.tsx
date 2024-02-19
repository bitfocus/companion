import { CButton, CInputGroup, CInputGroupAppend, CInputGroupPrepend } from '@coreui/react'
import React, { useCallback, useContext, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import Select from 'react-select'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { useComputed } from '../util.js'

interface SelectOption {
	value: number
	label: string
}
interface ButtonGridHeaderProps {
	pageNumber: number
	changePage?: (delta: number) => void
	setPage?: (page: number) => void
	newPageAtEnd?: boolean
}

export const ButtonGridHeader = observer(function ButtonGridHeader({
	pageNumber,
	changePage,
	setPage,
	newPageAtEnd,
	children,
}: React.PropsWithChildren<ButtonGridHeaderProps>) {
	const { pages: pagesStore } = useContext(RootAppStoreContext)

	const inputChange = useCallback(
		(val: SelectOption | null) => {
			const val2 = val?.value
			if (val2 !== undefined && setPage && !isNaN(val2)) {
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

	const pageOptions = useComputed(() => {
		const pageOptions: SelectOption[] = pagesStore.sortedEntries.map((value, index) => ({
			value: index + 1,
			label: `${index + 1} (${value.name})`,
		}))

		if (newPageAtEnd) {
			pageOptions.push({
				value: -1,
				label: `Insert new page`,
			})
		}
		return pageOptions
	}, [pagesStore, newPageAtEnd])

	const currentValue: SelectOption | undefined = useMemo(() => {
		return (
			pageOptions.find((o) => o.value == pageNumber) ?? {
				value: pageNumber,
				label: pageNumber + '',
			}
		)
	}, [pageOptions, pageNumber])

	return (
		<div className="button-grid-header">
			<CInputGroup>
				<CInputGroupPrepend>
					<CButton color="dark" hidden={!changePage} onClick={prevPage}>
						<FontAwesomeIcon icon={faChevronLeft} />
					</CButton>
				</CInputGroupPrepend>
				<Select<SelectOption>
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
