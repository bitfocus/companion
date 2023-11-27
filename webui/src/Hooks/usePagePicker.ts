import { PageModel } from '@companion/shared/Model/PageModel'
import { useCallback, useEffect, useRef, useState } from 'react'

export function usePagePicker(pagesObj: Record<number, PageModel | undefined>, initialPage: number) {
	const [pageNumber, setPageNumber] = useState(Number(initialPage))

	const pagesRef = useRef<Record<number, PageModel | undefined>>()
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

				newPage = Number(pageNumbers[newIndex])
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
