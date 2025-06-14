import { useCallback, useState } from 'react'

export function usePagePicker(
	pageCount: number,
	initialPage: number
): {
	pageNumber: number
	setPageNumber: (pageNumber: number) => void
	changePage: (delta: number) => void
} {
	const [pageNumber, setPageNumber] = useState(Number(initialPage))

	const changePage = useCallback(
		(delta: number) => {
			setPageNumber((pageNumber) => {
				let newPage = pageNumber + delta
				if (newPage < 1) newPage += pageCount
				if (newPage > pageCount) newPage -= pageCount

				return newPage
			})
		},
		[pageCount]
	)

	return {
		pageNumber,
		setPageNumber,
		changePage,
	}
}
