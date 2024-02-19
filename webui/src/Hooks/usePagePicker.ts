import { useCallback, useState } from 'react'
import type { PagesStore } from '../Stores/PagesStore.js'

export function usePagePicker(pagesStore: PagesStore, initialPage: number) {
	const [pageNumber, setPageNumber] = useState(Number(initialPage))

	const changePage = useCallback(
		(delta) => {
			const pageNumbers = pagesStore.pageNumbers
			setPageNumber((pageNumber) => {
				const currentIndex = pageNumbers.findIndex((p) => p === pageNumber)
				let newPage = Number(pageNumbers[0])
				if (currentIndex !== -1) {
					let newIndex = currentIndex + delta
					if (newIndex < 0) newIndex += pageNumbers.length
					if (newIndex >= pageNumbers.length) newIndex -= pageNumbers.length

					newPage = Number(pageNumbers[newIndex])
				}

				return newPage ?? pageNumber
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
