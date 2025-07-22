import { CCol, CNav, CNavItem, CNavLink, CRow, CTabContent, CTabPane } from '@coreui/react'
import { faCalculator, faGift, faLayerGroup, faVideoCamera } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'
import { ConnectionPresets } from './Presets/Presets.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { ButtonsGridPanel } from './ButtonGridPanel.js'
import { EditButton } from './EditButton/EditButton.js'
import { ActionRecorder } from './ActionRecorder/index.js'
import React, { useCallback, useContext, useRef, useState } from 'react'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import classNames from 'classnames'
import { useGridZoom } from './GridZoom.js'
import { PagesList } from './Pages.js'
import { useMatchRoute, useNavigate, UseNavigateResult } from '@tanstack/react-router'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

const SESSION_STORAGE_LAST_BUTTONS_PAGE = 'lastButtonsPage'

function useUrlPageNumber(): number | null {
	const matchRoute = useMatchRoute()
	const match = matchRoute({ to: '/buttons/$page' })

	const pageIndex = match ? Number(match.page) : NaN
	if (isNaN(pageIndex) || pageIndex <= 0) return 0

	return pageIndex
}

function navigateToButtonsPage(navigate: UseNavigateResult<'/buttons'>, pageNumber: number): void {
	void navigate({ to: `/buttons/${pageNumber}` })
	window.sessionStorage.setItem(SESSION_STORAGE_LAST_BUTTONS_PAGE, pageNumber.toString())
}

function getLastPageNumber(): number {
	const lastPage = Number(window.sessionStorage.getItem(SESSION_STORAGE_LAST_BUTTONS_PAGE))
	if (!isNaN(lastPage) && lastPage > 0) {
		return lastPage
	}
	return 1
}

export const ButtonsPage = observer(function ButtonsPage() {
	const { userConfig, pages, viewControl } = useContext(RootAppStoreContext)

	const clearModalRef = useRef<GenericConfirmModalRef>(null)
	const [gridZoomController, gridZoomValue] = useGridZoom('grid')

	const [tabResetToken, setTabResetToken] = useState(nanoid())
	const [activeTab, setActiveTab] = useState('pages')
	const [selectedButton, setSelectedButton] = useState<ControlLocation | null>(null)
	const [copyFromButton, setCopyFromButton] = useState<[ControlLocation, string] | null>(null)

	const navigate = useNavigate({ from: '/buttons' })
	let pageNumber = useUrlPageNumber()
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

	const hotPressMutation = useMutationExt(trpc.controls.hotPressControl.mutationOptions())
	const doButtonGridClick = useCallback(
		(location: ControlLocation, isDown: boolean) => {
			if (viewControl.buttonGridHotPress) {
				hotPressMutation
					.mutateAsync({ location, direction: isDown, surfaceId: 'grid' })
					.catch((e) => console.error(`Hot press failed: ${e}`))
			} else if (isDown) {
				setActiveTab('edit')
				console.log('set selected', location)
				setSelectedButton(location)
				setTabResetToken(nanoid())
			}
		},
		[hotPressMutation, viewControl]
	)
	const clearSelectedButton = useCallback(() => {
		doChangeTab('pages')
	}, [doChangeTab])

	const gridSize = userConfig.properties?.gridSize

	const resetControlMutation = useMutationExt(trpc.controls.resetControl.mutationOptions())
	const copyControlMutation = useMutationExt(trpc.controls.copyControl.mutationOptions())
	const moveControlMutation = useMutationExt(trpc.controls.moveControl.mutationOptions())

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
								const newPageNumber = selectedButton.pageNumber >= pages.data.length ? 1 : selectedButton.pageNumber + 1
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
								const newPageNumber = selectedButton.pageNumber <= 1 ? pages.data.length : selectedButton.pageNumber - 1
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
								resetControlMutation.mutateAsync({ location: selectedButton }).catch((e) => {
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
							copyControlMutation
								.mutateAsync({ fromLocation: copyFromButton[0], toLocation: selectedButton })
								.catch((e) => {
									console.error(`copy failed: ${e}`)
								})
							setTabResetToken(nanoid())
						} else if (copyFromButton[1] === 'cut') {
							moveControlMutation
								.mutateAsync({ fromLocation: copyFromButton[0], toLocation: selectedButton })
								.catch((e) => {
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
		[
			resetControlMutation,
			copyControlMutation,
			moveControlMutation,
			selectedButton,
			copyFromButton,
			gridSize,
			setPageNumber,
			gridZoomController,
			pages.data.length,
		]
	)

	if (pageNumber === null) {
		return <></>
	} else if (pageNumber <= 0) {
		setTimeout(() => navigateToButtonsPage(navigate, getLastPageNumber()), 0)
		// Force the number and let it render
		pageNumber = 1
	} else if (pageNumber > pages.pageCount) {
		const newPageNumber = pages.pageCount
		setTimeout(() => navigateToButtonsPage(navigate, newPageNumber), 0)
		// Force the number and let it render
		pageNumber = newPageNumber
	}

	return (
		<CRow className="buttons-page split-panels">
			<GenericConfirmModal ref={clearModalRef} />

			<CCol xs={12} xl={6} className="primary-panel">
				<MyErrorBoundary>
					<ButtonsGridPanel
						buttonGridClick={doButtonGridClick}
						isHot={viewControl.buttonGridHotPress}
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
							<CNavLink active={activeTab === 'pages'} onClick={() => doChangeTab('pages')}>
								<FontAwesomeIcon icon={faLayerGroup} /> Pages
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
						<CTabPane visible={activeTab === 'pages'}>
							<MyErrorBoundary>
								<PagesList setPageNumber={setPageNumber} />
							</MyErrorBoundary>
						</CTabPane>
						<CTabPane visible={activeTab === 'presets'}>
							<MyErrorBoundary>
								<ConnectionPresets resetToken={tabResetToken} />
							</MyErrorBoundary>
						</CTabPane>
						<CTabPane visible={activeTab === 'action-recorder'}>
							<MyErrorBoundary>
								<ActionRecorder />
							</MyErrorBoundary>
						</CTabPane>
					</CTabContent>
				</div>
			</CCol>
		</CRow>
	)
})
