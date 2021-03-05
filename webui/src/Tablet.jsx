import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError, MyErrorBoundary, SERVER_URL, socketEmit, useMountEffect } from './util'
import io from 'socket.io-client'
import { CButton, CCol, CContainer, CRow } from '@coreui/react'
import shortid from 'shortid'
import { MAX_BUTTONS, MAX_COLS, MAX_ROWS } from './Constants'
import { BankPreview, dataToButtonImage } from './Components/BankButton'
import { useInView } from 'react-intersection-observer'
import { parse } from 'query-string'
import rangeParser from 'parse-numeric-range'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'

const socket = new io(SERVER_URL)

export function Tablet() {
	const [pages, setPages] = useState(null)
	const [loadError, setLoadError] = useState(null)

	const locationSearch = window.location.search
	const { orderedPages, parsedQuery } = useMemo(() => {
		const parsedQuery = parse(locationSearch)

		const pagesRange = rangeParser(parsedQuery.pages ?? '').filter((p) => p >= 1 && p <= 99)

		return {
			parsedQuery,
			orderedPages: pagesRange,
		}
	}, [locationSearch])

	const [retryToken, setRetryToken] = useState(shortid())
	const doRetryLoad = useCallback(() => setRetryToken(shortid()), [])
	useEffect(() => {
		setLoadError(null)
		setPages(null)

		socketEmit(socket, 'web_buttons', [])
			.then(([pages]) => {
				setLoadError(null)
				setPages(pages)
			})
			.catch((e) => {
				console.error('Failed to load pages list:', e)
				setLoadError(`Failed to load pages list`)
				setPages(null)
			})

		const updatePageInfo = (page, info) => {
			setPages((oldPages) => {
				if (oldPages) {
					return {
						...oldPages,
						[page]: info,
					}
				} else {
					return null
				}
			})
		}

		socket.on('set_page', updatePageInfo)

		return () => {
			socket.off('set_page', updatePageInfo)
		}
	}, [retryToken])

	useMountEffect(() => {
		const onConnect = () => {
			setRetryToken(shortid())
		}
		socket.on('connect', onConnect)
		return () => {
			socket.off('connect', onConnect)
		}
	})

	// Compile the list of pages we will be showing
	let validPages = orderedPages.filter((p) => pages && !!pages[p])
	if (validPages.length === 0)
		validPages = Object.keys(pages || {})
			.map((p) => Number(p))
			.sort()

	const layout = parsedQuery['layout']
	return (
		<div className="page-tablet">
			<CContainer fluid>
				<CRow>
					<LoadingRetryOrError dataReady={pages} error={loadError} doRetry={doRetryLoad} />
				</CRow>

				{pages ? (
					layout === 'cycle' ? (
						<CyclePages socket={socket} pages={pages} orderedPages={validPages} query={parsedQuery} />
					) : (
						<InfinitePages socket={socket} pages={pages} orderedPages={validPages} />
					)
				) : (
					''
				)}
			</CContainer>
		</div>
	)
}

function clamp(val, max) {
	return Math.min(Math.max(0, val), max)
}

function CyclePages({ socket, pages, orderedPages, query }) {
	const rawIndex = Number(query['index'])
	const loop = query['loop']
	const defaultIndex = isNaN(rawIndex) ? 0 : clamp(rawIndex, orderedPages.length - 1)

	const [currentIndex, setCurrentIndex] = useState(defaultIndex)
	// TODO - update url while cycling

	const safeIndex = clamp(currentIndex, orderedPages.length - 1)
	const currentPage = orderedPages[safeIndex]

	// // Preload some pages for more seamless cycling
	// const preloadPages = new Set()
	// {
	// 	const prevPage = orderedPages[safeIndex - 1]
	// 	if (prevPage !== undefined) preloadPages.add(prevPage)
	// 	const nextPage = orderedPages[safeIndex + 1]
	// 	if (nextPage !== undefined) preloadPages.add(nextPage)
	// }

	const prevPage = useCallback(() => {
		setCurrentIndex((oldIndex) => {
			if (oldIndex <= 0) {
				return orderedPages.length - 1
			} else {
				return oldIndex - 1
			}
		})
	}, [orderedPages])
	const nextPage = useCallback(() => {
		setCurrentIndex((oldIndex) => {
			if (oldIndex >= orderedPages.length) {
				return 0
			} else {
				return oldIndex + 1
			}
		})
	}, [orderedPages])

	return (
		<CRow>
			<div className="cycle-layout">
				<MyErrorBoundary>
					{/* <div></div> */}
					<div className="cycle-heading">
						<h1 id={`page_${currentPage}`}>
							{pages[currentPage]?.name || ' '}

							{orderedPages.length > 1 ? (
								<>
									<CButton onClick={nextPage} disabled={!loop && currentIndex === orderedPages.length - 1} size="lg">
										<FontAwesomeIcon icon={faArrowRight} />
									</CButton>
									<CButton onClick={prevPage} disabled={!loop && currentIndex === 0} size="lg">
										<FontAwesomeIcon icon={faArrowLeft} />
									</CButton>
								</>
							) : (
								''
							)}
						</h1>
					</div>
					<div>
						<ButtonGrid key={currentPage} socket={socket} number={currentPage} />
					</div>
				</MyErrorBoundary>
			</div>
		</CRow>
	)
}

function InfinitePages({ socket, pages, orderedPages }) {
	const pageElements = orderedPages.map((number) => (
		<MyErrorBoundary key={number}>
			<CRow>
				<h1 id={`page_${number}`}>{pages[number]?.name}</h1>
			</CRow>
			<CRow>
				<ButtonGrid socket={socket} number={number} />
			</CRow>
		</MyErrorBoundary>
	))

	return <>{pageElements}</>
}

function ButtonGrid({ socket, number }) {
	const { ref, inView } = useInView({
		rootMargin: '50%',
		/* Optional options */
		threshold: 0,
	})

	const [_viewToken, setViewToken] = useState(shortid())
	const getViewToken = useCallback(() => {
		// Hack to get the token without depending on it..
		let v
		setViewToken((oldV) => {
			v = oldV
			return oldV
		})
		return v
	}, [])

	const [imageCache, setImageCache] = useState({})

	useEffect(() => {
		if (inView) {
			const newToken = shortid()
			setViewToken(newToken)

			const updateImages = (page, data) => {
				if (page === number) {
					setImageCache((oldImages) => {
						const newImages = { ...oldImages }

						for (let key = 1; key <= MAX_BUTTONS; ++key) {
							if (data[key] !== undefined) {
								newImages[key] = {
									image: dataToButtonImage(data[key].buffer),
									updated: data[key].updated,
								}
							}
						}

						return newImages
					})
				}
			}

			const lastUpdated = {}
			setImageCache((imageCache) => {
				// don't want to change imageCache, but this avoids the dependency
				for (const [id, data] of Object.entries(imageCache)) {
					lastUpdated[id] = { updated: data.updated }
				}
				return imageCache
			})

			// Load 'initial' data
			socketEmit(socket, 'web_buttons_page', [number, lastUpdated])
				.then(([n, data]) => {
					// Only use if the token hasnt changed
					if (getViewToken() === newToken) {
						updateImages(n, data)
					}
				})
				.catch((e) => {
					// TODO - report to user
					console.error(`Failed to load page buttons: ${e}`)
				})

			// Subscribe for changes
			socket.on('buttons_bank_data', updateImages)
			return () => {
				socket.off('buttons_bank_data', updateImages)
			}
		}
	}, [socket, number, inView, getViewToken])

	const bankClick = useCallback(
		(bank, pressed) => {
			socket.emit('hot_press', number, bank, pressed)
		},
		[socket, number]
	)

	return (
		<div ref={ref} className="bankgrid">
			{' '}
			{Array(MAX_ROWS)
				.fill(0)
				.map((_, y) => {
					return (
						<CCol key={y} sm={12} className="pagebank-row">
							{Array(MAX_COLS)
								.fill(0)
								.map((_, x) => {
									const index = y * MAX_COLS + x + 1
									return (
										<BankPreview
											key={x}
											page={number}
											index={index}
											preview={imageCache[index]?.image}
											onClick={bankClick}
											alt={`Bank ${index}`}
											selected={false}
										/>
									)
								})}
						</CCol>
					)
				})}
		</div>
	)
}
