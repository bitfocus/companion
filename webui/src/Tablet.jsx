import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
	CreateBankControlId,
	LoadingRetryOrError,
	MyErrorBoundary,
	SocketContext,
	socketEmitPromise,
	useMountEffect,
} from './util'
import { CButton, CCol, CContainer, CForm, CFormGroup, CInput, CInputCheckbox, CRow } from '@coreui/react'
import { nanoid } from 'nanoid'
import { MAX_BUTTONS, MAX_COLS, MAX_ROWS } from './Constants'
import { BankPreview, dataToButtonImage } from './Components/BankButton'
import { useInView } from 'react-intersection-observer'
import * as queryString from 'query-string'
import rangeParser from 'parse-numeric-range'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faExpand } from '@fortawesome/free-solid-svg-icons'
import EventEmitter from 'eventemitter3'
import { useNavigate } from 'react-router-dom'

/** Cache of images across grid components */
class ImageCache extends EventEmitter {
	constructor(socket) {
		super()

		this.socket = socket

		this.loadedPages = new Set()
		this.imageCache = new Map()

		this.socket.on('connect', this._onConnect)
		this.socket.on('web-buttons:bank-data', this._updateImage)
	}

	_onConnect = () => {
		// resubscribe on reconnect
		for (const k of this.loadedPages.values()) {
			this._doSubscribe(k)
		}
	}

	destroy() {
		this.socket.off('connect', this._onConnect)
		this.socket.off('web-buttons:bank-data', this._updateImage)
	}

	loadPage(page) {
		if (!this.loadedPages.has(page)) {
			this.loadedPages.add(page)
			this._doSubscribe(page)
		}
	}

	getPage(page) {
		return this.imageCache.get(page) || {}
	}

	_doSubscribe(page) {
		socketEmitPromise(this.socket, 'web-buttons:load-page', [page])
			.then((data) => {
				this._updateImages(page, data)
			})
			.catch((e) => {
				// TODO - report to user
				console.error(`Failed to load page data: ${e}`)
			})
	}

	_updateImage = (page, bank, image) => {
		this._updateImages(page, { [bank]: image })
	}

	_updateImages = (page0, data) => {
		const page = Number(page0)
		if (this.loadedPages.has(page)) {
			const newImages = { ...this.imageCache.get(page) }

			let changed = false
			for (let key = 1; key <= MAX_BUTTONS; ++key) {
				if (data[key] !== undefined) {
					changed = true
					newImages[key] = dataToButtonImage(data[key])
				}
			}

			if (changed) {
				this.emit(`${page}`, newImages)
			}
			this.imageCache.set(page, newImages)
		}
	}
}

export function Tablet() {
	const socket = useContext(SocketContext)

	const [pages, setPages] = useState(null)
	const [loadError, setLoadError] = useState(null)

	const [queryUrl, setQueryUrl] = useState(window.location.search)
	const { orderedPages, parsedQuery } = useMemo(() => {
		const parsedQuery = queryString.parse(queryUrl)

		const pagesRange = rangeParser(parsedQuery.pages ?? '').filter((p) => p >= 1 && p <= 99)

		return {
			parsedQuery,
			orderedPages: pagesRange,
		}
	}, [queryUrl])

	const [imageCache, setImageCache] = useState(null)
	useEffect(() => {
		const newImageCache = new ImageCache(socket)
		setImageCache(newImageCache)

		// Cleanup handlers
		return () => {
			newImageCache.destroy()
		}
	}, [socket])

	const [retryToken, setRetryToken] = useState(nanoid())
	const doRetryLoad = useCallback(() => setRetryToken(nanoid()), [])
	useEffect(() => {
		setLoadError(null)
		setPages(null)

		socketEmitPromise(socket, 'web-buttons:subscribe', [])
			.then((newPages) => {
				setLoadError(null)
				setPages(newPages)
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

		socket.on('web-buttons:page-info', updatePageInfo)

		return () => {
			socket.off('web-buttons:page-info', updatePageInfo)

			socketEmitPromise(socket, 'web-buttons:unsubscribe', []).catch((e) => {
				console.error('Failed to cleanup web-buttons:', e)
			})
		}
	}, [retryToken, socket])

	useEffect(() => {
		const onConnect = () => {
			setRetryToken(nanoid())
		}
		socket.on('connect', onConnect)
		return () => {
			socket.off('connect', onConnect)
		}
	}, [socket])

	const navigate = useNavigate()
	const updateQueryUrl = useCallback(
		(key, value) => {
			setQueryUrl((oldUrl) => {
				const newQuery = queryString.parse(oldUrl)
				if (value === '' || value === undefined || value === null || value === false) {
					delete newQuery[key]
				} else if (value === true) {
					newQuery[key] = 1
				} else {
					newQuery[key] = value
				}

				const newStr = queryString.stringify(newQuery).replaceAll('%2C', ',') // replace commas to make it readable
				navigate(`?${newStr}`)
				return newStr
			})
		},
		[setQueryUrl, navigate]
	)

	// Compile the list of pages we will be showing
	let validPages = orderedPages.filter((p) => pages && !!pages[p])
	if (validPages.length === 0) validPages = Object.keys(pages || {}).map((p) => Number(p))

	let cols = Number(parsedQuery['cols'])
	if (isNaN(cols) || cols <= 0) cols = MAX_COLS
	let rows = Number(parsedQuery['rows'])
	if (isNaN(rows) || rows <= 0) rows = MAX_ROWS

	const showPageHeadings = parsedQuery['showpages']

	let displayColumns = Number(parsedQuery['display_cols'])
	if (displayColumns === 0 || isNaN(displayColumns)) displayColumns = cols
	const gridStyle = { gridTemplateColumns: `repeat(auto-fill, minmax(calc(100% / ${displayColumns}), 1fr))` }

	return (
		<div className="page-tablet">
			<div className="scroller">
				<CContainer fluid className="d-flex flex-column">
					{pages && imageCache ? (
						<>
							<ConfigurePanel updateQueryUrl={updateQueryUrl} query={parsedQuery} />

							<div className="button-zone">
								<CRow>
									<CCol sm={12} className="pagebank-row" style={gridStyle}>
										{validPages.map((number, i) => (
											<MyErrorBoundary key={i}>
												{showPageHeadings ? (
													<div className="page-heading">
														<h1>{pages[number]?.name}</h1>
													</div>
												) : (
													''
												)}
												<ButtonsFromPage imageCache={imageCache} number={number} cols={cols} rows={rows} />
											</MyErrorBoundary>
										))}
									</CCol>
								</CRow>
							</div>
						</>
					) : (
						<CRow className="flex-grow-1">
							<div className="cycle-layout">
								<div></div>
								<LoadingRetryOrError dataReady={false} error={loadError} doRetry={doRetryLoad} />
							</div>
						</CRow>
					)}
				</CContainer>
			</div>
		</div>
	)
}

function ConfigurePanel({ updateQueryUrl, query }) {
	const [show, setShow] = useState(false)
	const [fullscreen, setFullscreen] = useState(document.fullscreenElement !== null)

	useMountEffect(() => {
		const handleChange = () => setFullscreen(document.fullscreenElement !== null)

		document.addEventListener('fullscreenchange', handleChange)
		return () => {
			document.removeEventListener('fullscreenchange', handleChange)
		}
	})

	return show ? (
		<CRow className="configure">
			<CCol sm={12}>
				<h3>
					Configure Buttons View
					<CButton className="close-config" onClick={() => setShow(false)} title="Close">
						<FontAwesomeIcon icon={faCog} />
					</CButton>
				</h3>
				<CForm>
					<CRow>
						<CCol sm={6} xs={12}>
							<legend>Basic</legend>
							<CFormGroup>
								<label>Pages</label>
								<p>use 1..6 for ranges, and commas for multiple selections. Follows provided order</p>
								<CInput
									value={query['pages'] || ''}
									onChange={(e) => updateQueryUrl('pages', e.currentTarget.value)}
									placeholder={'1..99'}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Rows</label>
								<CInput
									type="number"
									min={1}
									max={MAX_ROWS}
									value={query['rows'] || MAX_ROWS}
									onChange={(e) => updateQueryUrl('rows', e.currentTarget.value)}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Columns</label>
								<CInput
									type="number"
									min={1}
									max={MAX_COLS}
									value={query['cols'] || MAX_COLS}
									onChange={(e) => updateQueryUrl('cols', e.currentTarget.value)}
								/>
							</CFormGroup>
						</CCol>
						<CCol sm={6} xs={12}>
							<legend>Layout</legend>
							<CFormGroup>
								<label>Hide configure button</label>
								<CInputCheckbox
									type="checkbox"
									checked={!!query['noconfigure']}
									value={true}
									onChange={(e) => updateQueryUrl('noconfigure', !!e.currentTarget.checked)}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Hide fullscreen button</label>
								<CInputCheckbox
									type="checkbox"
									checked={!!query['nofullscreen']}
									value={true}
									onChange={(e) => updateQueryUrl('nofullscreen', !!e.currentTarget.checked)}
								/>
							</CFormGroup>

							<CFormGroup>
								<label>Show page headings</label>
								<CInputCheckbox
									type="checkbox"
									checked={!!query['showpages']}
									value={true}
									onChange={(e) => updateQueryUrl('showpages', !!e.currentTarget.checked)}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Max Columns (0 for dynamic)</label>
								<CInput
									type="number"
									min={0}
									value={query['display_cols'] || '0'}
									onChange={(e) => updateQueryUrl('display_cols', e.currentTarget.value)}
								/>
							</CFormGroup>
						</CCol>
					</CRow>
				</CForm>
			</CCol>
		</CRow>
	) : (
		<CRow className="header">
			<CCol xs={12}>
				{(!fullscreen || !query['noconfigure']) && !query['nofullscreen'] ? (
					<CButton onClick={() => document.documentElement.requestFullscreen()} title="Fullscreen">
						<FontAwesomeIcon icon={faExpand} />
					</CButton>
				) : (
					''
				)}
				{!query['noconfigure'] ? (
					<CButton className="open-config" onClick={() => setShow(true)} title="Configure">
						<FontAwesomeIcon icon={faCog} />
					</CButton>
				) : (
					''
				)}
			</CCol>
		</CRow>
	)
}

function ButtonsFromPage({ imageCache, number, cols, rows }) {
	const socket = useContext(SocketContext)

	const [buttonsInView, setButtonsInView] = useState({})

	// load existing images from the cache at mount
	const [images, setImages] = useState(() => imageCache.getPage(number))
	useEffect(() => {
		setImages(imageCache.getPage(number))
	}, [imageCache, number])

	// Ensure the page is loaded when it comes into view
	useEffect(() => {
		const anyVisible = Object.values(buttonsInView).find((v) => !!v)

		if (anyVisible) {
			setImages(imageCache.getPage(number))
			imageCache.on(`${number}`, setImages)
			imageCache.loadPage(number)

			return () => {
				imageCache.off(`${number}`, setImages)
			}
		}
	}, [imageCache, number, buttonsInView])

	const bankClick = useCallback(
		(bank, pressed) => {
			const controlId = CreateBankControlId(number, bank)
			socketEmitPromise(socket, 'controls:hot-press', [controlId, pressed]).catch((e) =>
				console.error(`Hot press failed: ${e}`)
			)
		},
		[socket, number]
	)

	const setInView = useCallback((index, inView) => {
		setButtonsInView((old) => ({
			...old,
			[index]: inView,
		}))
	}, [])

	// <div ref={ref} className="button-zone">
	return Array(Math.min(MAX_ROWS, rows))
		.fill(0)
		.map((_, y) => {
			return Array(Math.min(MAX_COLS, cols))
				.fill(0)
				.map((_2, x) => {
					const index = y * MAX_COLS + x + 1
					return (
						<ButtonWrapper
							key={x}
							page={number}
							index={index}
							image={images[index]}
							bankClick={bankClick}
							setInView={setInView}
						/>
					)
				})
		})
	// </div>
}

function ButtonWrapper({ page, index, image, bankClick, setInView }) {
	const { ref, inView } = useInView({
		rootMargin: '50%',
		/* Optional options */
		threshold: 0,
	})

	useEffect(() => {
		setInView(index, inView)
	}, [setInView, index, inView])

	return (
		<BankPreview
			dropRef={ref}
			page={page}
			index={index}
			preview={image}
			onClick={bankClick}
			alt={`Bank ${index}`}
			selected={false}
		/>
	)
}
