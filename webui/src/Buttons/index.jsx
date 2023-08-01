import { CCol, CNav, CNavItem, CNavLink, CRow, CTabContent, CTabPane, CTabs } from '@coreui/react'
import { faCalculator, faDollarSign, faGift, faVideoCamera } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'
import { InstancePresets } from './Presets'
import { SocketContext, MyErrorBoundary, socketEmitPromise, UserConfigContext } from '../util'
import { ButtonsGridPanel } from './ButtonGridPanel'
import { EditButton } from './EditButton'
import { ActionRecorder } from './ActionRecorder'
import { memo, useCallback, useContext, useRef, useState } from 'react'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { InstanceVariables } from './Variables'
import { useElementSize } from 'usehooks-ts'
import { formatLocation } from '@companion/shared/ControlId'

export const ButtonsPage = memo(function ButtonsPage({ hotPress }) {
	const socket = useContext(SocketContext)
	const userConfig = useContext(UserConfigContext)

	const clearModalRef = useRef()

	const [tabResetToken, setTabResetToken] = useState(nanoid())
	const [activeTab, setActiveTab] = useState('presets')
	const [selectedButton, setSelectedButton] = useState(null)
	const [pageNumber, setPageNumber] = useState(1)
	const [copyFromButton, setCopyFromButton] = useState(null)

	const doChangeTab = useCallback((newTab) => {
		setActiveTab((oldTab) => {
			const preserveButtonsTab = newTab === 'variables' && oldTab === 'edit'
			if (newTab !== 'edit' && oldTab !== newTab && !preserveButtonsTab) {
				setSelectedButton(null)
				setTabResetToken(nanoid())
			}
			return newTab
		})
	}, [])

	const doButtonGridClick = useCallback(
		(location, isDown) => {
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

	const handleKeyDownInButtons = useCallback(
		(e) => {
			if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
				switch (e.key) {
					case 'ArrowDown':
						setSelectedButton((selectedButton) => {
							if (selectedButton) {
								return {
									...selectedButton,
									row:
										selectedButton.row >= userConfig.gridSize.maxRow
											? userConfig.gridSize.minRow
											: selectedButton.row + 1,
								}
							}
						})
						// TODO - ensure kept in view
						break
					case 'ArrowUp':
						setSelectedButton((selectedButton) => {
							if (selectedButton) {
								return {
									...selectedButton,
									row:
										selectedButton.row <= userConfig.gridSize.minRow
											? userConfig.gridSize.maxRow
											: selectedButton.row - 1,
								}
							}
						})
						// TODO - ensure kept in view
						break
					case 'ArrowLeft':
						setSelectedButton((selectedButton) => {
							if (selectedButton) {
								return {
									...selectedButton,
									column:
										selectedButton.column <= userConfig.gridSize.minColumn
											? userConfig.gridSize.maxColumn
											: selectedButton.column - 1,
								}
							}
						})
						// TODO - ensure kept in view
						break
					case 'ArrowRight':
						setSelectedButton((selectedButton) => {
							if (selectedButton) {
								return {
									...selectedButton,
									column:
										selectedButton.column >= userConfig.gridSize.maxColumn
											? userConfig.gridSize.minColumn
											: selectedButton.column + 1,
								}
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
							}
						})
						break
				}

				if (selectedButton) {
					// keyup with button selected

					if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Backspace' || e.key === 'Delete')) {
						clearModalRef.current.show(
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
					if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'c') {
						console.log('prepare copy', selectedButton)
						setCopyFromButton([selectedButton, 'copy'])
					}
					if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'x') {
						console.log('prepare cut', selectedButton)
						setCopyFromButton([selectedButton, 'cut'])
					}
					if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'v' && copyFromButton) {
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
		[socket, selectedButton, copyFromButton]
	)

	const [contentRef, { height: contentHeight }] = useElementSize()

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
					/>
				</MyErrorBoundary>
			</CCol>

			<CCol xs={12} xl={6} className="secondary-panel">
				<div className="secondary-panel-inner">
					<CTabs activeTab={activeTab} onActiveTabChange={doChangeTab}>
						<CNav variant="tabs">
							<CNavItem hidden={!selectedButton}>
								<CNavLink data-tab="edit">
									<FontAwesomeIcon icon={faCalculator} /> Edit Button{' '}
									{selectedButton ? `${formatLocation(selectedButton)}` : '?'}
								</CNavLink>
							</CNavItem>
							<CNavItem>
								<CNavLink data-tab="presets">
									<FontAwesomeIcon icon={faGift} /> Presets
								</CNavLink>
							</CNavItem>
							<CNavItem>
								<CNavLink data-tab="variables">
									<FontAwesomeIcon icon={faDollarSign} /> Variables
								</CNavLink>
							</CNavItem>
							<CNavItem>
								<CNavLink data-tab="action-recorder">
									<FontAwesomeIcon icon={faVideoCamera} /> Recorder
								</CNavLink>
							</CNavItem>
						</CNav>
						<CTabContent fade={false} innerRef={contentRef}>
							<CTabPane data-tab="edit">
								<MyErrorBoundary>
									{selectedButton && (
										<EditButton
											key={`${formatLocation(selectedButton)}-${tabResetToken}`}
											contentHeight={contentHeight}
											location={selectedButton}
											onKeyUp={handleKeyDownInButtons}
										/>
									)}
								</MyErrorBoundary>
							</CTabPane>
							<CTabPane data-tab="presets">
								<MyErrorBoundary>
									<InstancePresets resetToken={tabResetToken} />
								</MyErrorBoundary>
							</CTabPane>
							<CTabPane data-tab="variables">
								<MyErrorBoundary>
									<InstanceVariables resetToken={tabResetToken} />
								</MyErrorBoundary>
							</CTabPane>
							<CTabPane data-tab="action-recorder">
								<MyErrorBoundary>
									<ActionRecorder key={tabResetToken} />
								</MyErrorBoundary>
							</CTabPane>
						</CTabContent>
					</CTabs>
				</div>
			</CCol>
		</CRow>
	)
})
