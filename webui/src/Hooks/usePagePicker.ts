import { useCallback, useState } from 'react'
import type { PagesStore } from '../Stores/PagesStore.js'

export function usePagePicker(pagesStore: PagesStore, initialPage: number) {
	const [pageNumber, setPageNumber] = useState(Number(initialPage))

	const changePage = useCallback(
		(delta: number) => {
			const pageCount = pagesStore.data.length
			setPageNumber((pageNumber) => {
				let newPage = pageNumber + delta
				if (newPage < 1) newPage += pageCount
				if (newPage > pageCount) newPage -= pageCount

				return newPage
			})
		},
		[pagesStore]
	)

	return {
		pageNumber,
		setPageNumber,
		changePage,
	}
}
