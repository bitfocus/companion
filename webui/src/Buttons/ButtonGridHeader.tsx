import { Combobox } from '@base-ui/react/combobox'
import { CButton, CInputGroup } from '@coreui/react'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { prepare as fuzzyPrepare, single as fuzzySingle } from 'fuzzysort'
import { ChevronDownIcon } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { DropdownInputPopup } from '~/Components/DropdownInputField/Popup.js'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

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

	const pageOptions = useComputed(() => {
		const pageOptions: PageNumberOption[] = pagesStore.data.map((value, index) => ({
			value: index + 1,
			label: value.name ? `${index + 1} (${value.name})` : `${index + 1}`,
		}))

		if (newPageAtEnd) {
			pageOptions.push({
				value: -1,
				label: `[ Insert new page ]`,
			})
		}
		return pageOptions
	}, [pagesStore, newPageAtEnd])

	return (
		<PageNumberPicker pageNumber={pageNumber} changePage={changePage} setPage={setPage} pageOptions={pageOptions}>
			{children}
		</PageNumberPicker>
	)
})

export interface PageNumberOption {
	value: number
	label: string
}
interface PageNumberPickerProps {
	pageNumber: number
	changePage?: (delta: number) => void
	setPage?: (page: number) => void
	pageOptions: PageNumberOption[]
}

export const PageNumberPicker = observer(function ButtonGridHeader({
	pageNumber,
	changePage,
	setPage,
	pageOptions,
	children,
}: React.PropsWithChildren<PageNumberPickerProps>) {
	const menuPortal = useContext(MenuPortalContext)

	const inputChange = useCallback(
		(val: number | null) => {
			if (val !== null && setPage && !isNaN(val)) {
				setPage(val)
			}
		},
		[setPage]
	)

	const nextPage = useCallback(() => changePage?.(1), [changePage])
	const prevPage = useCallback(() => changePage?.(-1), [changePage])

	const choiceOptions = useComputed<Array<DropdownChoice & { fuzzy: ReturnType<typeof fuzzyPrepare> }>>(() => {
		const options = pageOptions.map((o) => ({ id: o.value, label: o.label, fuzzy: fuzzyPrepare(o.label) }))
		if (!options.some((o) => o.id === pageNumber)) {
			const label = String(pageNumber)
			options.push({ id: pageNumber, label, fuzzy: fuzzyPrepare(label) })
		}
		return options
	}, [pageOptions, pageNumber])

	const [inputValue, setInputValue] = useState('')

	const filteredItems = useComputed<DropdownChoice[]>(() => {
		if (!inputValue) return choiceOptions
		return choiceOptions.filter((o) => (fuzzySingle(inputValue, o.fuzzy)?.score ?? 0) >= 0.5)
	}, [choiceOptions, inputValue])

	return (
		<div className="button-grid-header">
			<CInputGroup>
				<CButton color="dark" hidden={!changePage} onClick={prevPage}>
					<FontAwesomeIcon icon={faChevronLeft} />
				</CButton>
				<div className="dropdown-field button-page-input">
					<Combobox.Root<number | null>
						autoHighlight
						value={pageNumber}
						items={choiceOptions}
						filteredItems={filteredItems}
						disabled={!setPage}
						onValueChange={inputChange}
						onInputValueChange={setInputValue}
						itemToStringLabel={() => ''}
					>
						<Combobox.InputGroup className="dropdown-field-input-group rounded-start-0 rounded-end-0">
							<Combobox.Input
								className="dropdown-field-input"
								placeholder={choiceOptions.find((o) => o.id === pageNumber)?.label ?? String(pageNumber ?? '')}
							/>
							<Combobox.Trigger className="dropdown-field-trigger">
								<ChevronDownIcon className="dropdown-field-icon" />
							</Combobox.Trigger>
						</Combobox.InputGroup>
						<DropdownInputPopup menuPortal={menuPortal ?? undefined} />
					</Combobox.Root>
				</div>
				<CButton color="dark" hidden={!changePage} onClick={nextPage}>
					<FontAwesomeIcon icon={faChevronRight} />
				</CButton>
			</CInputGroup>
			<div className="right-buttons">{children}</div>
		</div>
	)
})
