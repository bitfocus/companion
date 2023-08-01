import { useCallback, useEffect, useRef, useState } from 'react'

export function usePagePicker(pagesObj, initialPage) {
	const [pageNumber, setPageNumber] = useState(Number(initialPage))

	const pagesRef = useRef()
	useEffect(() => {
		// Avoid binding into callbacks
		pagesRef.current = pagesObj
	}, [pagesObj])

	const changePage = useCallback((delta) => {
		setPageNumber((pageNumber) => {
			const pageNumbers = Object.keys(pagesRef.current || {})
			const currentIndex = pageNumbers.findIndex((p) => p === pageNumber + '')
			let newPage = Number(pageNumbers[0])
			if (currentIndex !== -1) {
				let newIndex = currentIndex + delta
				if (newIndex < 0) newIndex += pageNumbers.length
				if (newIndex >= pageNumbers.length) newIndex -= pageNumbers.length

				newPage = pageNumbers[newIndex]
			}

			return newPage ?? pageNumber
		})
	}, [])

	return {
		pageNumber,
		setPageNumber,
		changePage,
	}
}
