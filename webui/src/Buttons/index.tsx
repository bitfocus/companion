import { CCol, CNav, CNavItem, CNavLink, CRow, CTabContent, CTabPane } from '@coreui/react'
import { faCalculator, faGift, faVideoCamera } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'
import { InstancePresets } from './Presets/Presets.js'
import { MyErrorBoundary, socketEmitPromise } from '../util.js'
import { ButtonsGridPanel } from './ButtonGridPanel.js'
import { EditButton } from './EditButton.js'
import { ActionRecorder } from './ActionRecorder/index.js'
import React, { useCallback, useContext, useRef, useState } from 'react'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import classNames from 'classnames'
import { useGridZoom } from './GridZoom.js'
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom'

export const BUTTONS_PAGE_PREFIX = '/buttons'
const SESSION_STORAGE_LAST_BUTTONS_PAGE = 'lastButtonsPage'

function useUrlPageNumber(): number | null {
	const routerLocation = useLocation()
	if (!routerLocation.pathname.startsWith(BUTTONS_PAGE_PREFIX)) return null

	const fragments = routerLocation.pathname.slice(BUTTONS_PAGE_PREFIX.length + 1).split('/')

	const pageIndex = Number(fragments[0])
	if (isNaN(pageIndex) || pageIndex <= 0) return 0

	return pageIndex
}

function navigateToButtonsPage(navigate: NavigateFunction, pageNumber: number): void {
	navigate(`${BUTTONS_PAGE_PREFIX}/${pageNumber}`)
	window.sessionStorage.setItem(SESSION_STORAGE_LAST_BUTTONS_PAGE, pageNumber.toString())
}

function getLastPageNumber(): number {
	const lastPage = Number(window.sessionStorage.getItem(SESSION_STORAGE_LAST_BUTTONS_PAGE))
	if (!isNaN(lastPage) && lastPage > 0) {
		return lastPage
	}
	return 1
}

interface ButtonsPageProps {
	hotPress: boolean
}

export const ButtonsPage = observer(function ButtonsPage({ hotPress }: ButtonsPageProps) {
	const { userConfig, socket } = useContext(RootAppStoreContext)

	const clearModalRef = useRef<GenericConfirmModalRef>(null)
	const [gridZoomController, gridZoomValue] = useGridZoom('grid')

	const [tabResetToken, setTabResetToken] = useState(nanoid())
	const [activeTab, setActiveTab] = useState('presets')
	const [selectedButton, setSelectedButton] = useState<ControlLocation | null>(null)
	const [copyFromButton, setCopyFromButton] = useState<[ControlLocation, string] | null>(null)

	const navigate = useNavigate()
	const pageNumber = useUrlPageNumber()
	const setPageNumber = useCallback(
		(pageNumber: number) => {
			navigateToButtonsPage(navigate, pageNumber)
		},
		[navigate]
	)

	const doChangeTab = useCallback((newTab: string) => {
		setActiveTab((oldTab) => {
			if (newTab !== 'edit' && oldTab !== newTab) {
				setSelectedButton(null)
				setTabResetToken(nanoid())
			}
			return newTab
		})
	}, [])

	const doButtonGridClick = useCallback(
		(location: ControlLocation, isDown: boolean) => {
			if (hotPress) {
				socketEmitPromise(socket, 'controls:hot-press', [location, isDown, 'grid']).catch((e) =>
					console.error(`Hot press failed: ${e}`)
				)
			} else if (isDown) {
				setActiveTab('edit')
				console.log('set selected', location)
				setSelectedButton(location)
				setTabResetToken(nanoid())
			}
		},
		[socket, hotPress]
	)
	const clearSelectedButton = useCallback(() => {
		doChangeTab('presets')
	}, [doChangeTab])

	const gridSize = userConfig.properties?.gridSize

	const handleKeyDownInButtons = useCallback(
		(e: React.KeyboardEvent) => {
			const isControlOrCommandCombo = (e.ctrlKey || e.metaKey) && !e.altKey

			// e.target is the actual element where the event happened, e.currentTarget is the element where the event listener is attached
			const targetElement = e.target as HTMLElement

			if (isControlOrCommandCombo && e.key === '=') {
				e.preventDefault()
				gridZoomController.zoomIn(true)
			} else if (isControlOrCommandCombo && e.key === '-') {
				e.preventDefault()
				gridZoomController.zoomOut(true)
			} else if (isControlOrCommandCombo && e.key === '0') {
				e.preventDefault()
				gridZoomController.zoomReset()
			} else if (targetElement.tagName !== 'INPUT' && targetElement.tagName !== 'TEXTAREA') {
				switch (e.key) {
					case 'ArrowDown':
						setSelectedButton((selectedButton) => {
							if (selectedButton && gridSize) {
								return {
									...selectedButton,
									row: selectedButton.row >= gridSize.maxRow ? gridSize.minRow : selectedButton.row + 1,
								}
							} else {
								return selectedButton
							}
						})
						// TODO - ensure kept in view
						break
					case 'ArrowUp':
						setSelectedButton((selectedButton) => {
							if (selectedButton && gridSize) {
								return {
									...selectedButton,
									row: selectedButton.row <= gridSize.minRow ? gridSize.maxRow : selectedButton.row - 1,
								}
							} else {
								return selectedButton
							}
						})
						// TODO - ensure kept in view
						break
					case 'ArrowLeft':
						setSelectedButton((selectedButton) => {
							if (selectedButton && gridSize) {
								return {
									...selectedButton,
									column: selectedButton.column <= gridSize.minColumn ? gridSize.maxColumn : selectedButton.column - 1,
								}
							} else {
								return selectedButton
							}
						})
						// TODO - ensure kept in view
						break
					case 'ArrowRight':
						setSelectedButton((selectedButton) => {
							if (selectedButton && gridSize) {
								return {
									...selectedButton,
									column: selectedButton.column >= gridSize.maxColumn ? gridSize.minColumn : selectedButton.column + 1,
								}
							} else {
								return selectedButton
							}
						})
						// TODO - ensure kept in view
						break
					case 'PageUp':
						setSelectedButton((selectedButton) => {
							if (selectedButton) {
								const newPageNumber = selectedButton.pageNumber >= 99 ? 1 : selectedButton.pageNumber + 1
								setPageNumber(newPageNumber)
								return {
									...selectedButton,
									pageNumber: newPageNumber,
								}
							} else {
								return selectedButton
							}
						})
						break
					case 'PageDown':
						setSelectedButton((selectedButton) => {
							if (selectedButton) {
								const newPageNumber = selectedButton.pageNumber <= 1 ? 99 : selectedButton.pageNumber - 1
								setPageNumber(newPageNumber)
								return {
									...selectedButton,
									pageNumber: newPageNumber,
								}
							} else {
								return selectedButton
							}
						})
						break
				}

				if (selectedButton) {
					// keyup with button selected

					if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Backspace' || e.key === 'Delete')) {
						clearModalRef.current?.show(
							`Clear button ${formatLocation(selectedButton)}`,
							`This will clear the style, feedbacks and all actions`,
							'Clear',
							() => {
								socketEmitPromise(socket, 'controls:reset', [selectedButton]).catch((e) => {
									console.error(`Reset failed: ${e}`)
								})
							}
						)
					}
					if (isControlOrCommandCombo && e.key.toLowerCase() === 'c') {
						console.log('prepare copy', selectedButton)
						setCopyFromButton([selectedButton, 'copy'])
					}
					if (isControlOrCommandCombo && e.key.toLowerCase() === 'x') {
						console.log('prepare cut', selectedButton)
						setCopyFromButton([selectedButton, 'cut'])
					}
					if (isControlOrCommandCombo && e.key.toLowerCase() === 'v' && copyFromButton) {
						console.log('do paste', copyFromButton, selectedButton)

						if (copyFromButton[1] === 'copy') {
							socketEmitPromise(socket, 'controls:copy', [copyFromButton[0], selectedButton]).catch((e) => {
								console.error(`copy failed: ${e}`)
							})
							setTabResetToken(nanoid())
						} else if (copyFromButton[1] === 'cut') {
							socketEmitPromise(socket, 'controls:move', [copyFromButton[0], selectedButton]).catch((e) => {
								console.error(`move failed: ${e}`)
							})
							setCopyFromButton(null)
							setTabResetToken(nanoid())
						} else {
							console.error('unknown paste operation:', copyFromButton[1])
						}
					}
				}
			}
		},
		[socket, selectedButton, copyFromButton, gridSize, setPageNumber]
	)

	if (pageNumber === null) {
		return <></>
	} else if (pageNumber <= 0) {
		setTimeout(() => navigateToButtonsPage(navigate, getLastPageNumber()), 0)
		return <></>
	}

	return (
		<CRow className="buttons-page split-panels">
			<GenericConfirmModal ref={clearModalRef} />

			<CCol xs={12} xl={6} className="primary-panel">
				<MyErrorBoundary>
					<ButtonsGridPanel
						buttonGridClick={doButtonGridClick}
						isHot={hotPress}
						selectedButton={selectedButton}
						pageNumber={pageNumber}
						changePage={setPageNumber}
						onKeyDown={handleKeyDownInButtons}
						clearSelectedButton={clearSelectedButton}
						gridZoomController={gridZoomController}
						gridZoomValue={gridZoomValue}
					/>
				</MyErrorBoundary>
			</CCol>

			<CCol xs={12} xl={6} className="secondary-panel">
				<div className="secondary-panel-inner">
					<CNav variant="tabs">
						<CNavItem
							className={classNames({
								hidden: !selectedButton,
							})}
						>
							<CNavLink active={activeTab === 'edit'} onClick={() => doChangeTab('edit')}>
								<FontAwesomeIcon icon={faCalculator} /> Edit Button{' '}
								{selectedButton ? `${formatLocation(selectedButton)}` : '?'}
							</CNavLink>
						</CNavItem>
						<CNavItem>
							<CNavLink active={activeTab === 'presets'} onClick={() => doChangeTab('presets')}>
								<FontAwesomeIcon icon={faGift} /> Presets
							</CNavLink>
						</CNavItem>
						<CNavItem>
							<CNavLink active={activeTab === 'action-recorder'} onClick={() => doChangeTab('action-recorder')}>
								<FontAwesomeIcon icon={faVideoCamera} /> Recorder
							</CNavLink>
						</CNavItem>
					</CNav>
					<CTabContent>
						<CTabPane visible={activeTab === 'edit'}>
							<MyErrorBoundary>
								{selectedButton && (
									<EditButton
										key={`${formatLocation(selectedButton)}-${tabResetToken}`}
										location={selectedButton}
										onKeyUp={handleKeyDownInButtons}
									/>
								)}
							</MyErrorBoundary>
						</CTabPane>
						<CTabPane visible={activeTab === 'presets'}>
							<MyErrorBoundary>
								<InstancePresets resetToken={tabResetToken} />
							</MyErrorBoundary>
						</CTabPane>
						<CTabPane visible={activeTab === 'action-recorder'}>
							<MyErrorBoundary>
								<ActionRecorder key={tabResetToken} />
							</MyErrorBoundary>
						</CTabPane>
					</CTabContent>
				</div>
			</CCol>
		</CRow>
	)
})
