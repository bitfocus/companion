import { CCol, CNav, CNavItem, CNavLink, CRow, CTabContent, CTabPane, CTabs } from '@coreui/react'
import { faCalculator, faDollarSign, faFileImport, faGift, faVideoCamera } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'
import { InstancePresets } from './Presets'
import { SocketContext, MyErrorBoundary, socketEmitPromise, CreateBankControlId, FormatButtonControlId } from '../util'
import { ButtonsGridPanel } from './ButtonGrid'
import { EditButton } from './EditButton'
import { ImportExport } from './ImportExport'
import { ActionRecorder } from './ActionRecorder'
import { memo, useCallback, useContext, useRef, useState } from 'react'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { InstanceVariables } from './Variables'

export const ButtonsPage = memo(function ButtonsPage({ hotPress }) {
	const socket = useContext(SocketContext)

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
		(page, bank, isDown) => {
			if (hotPress) {
				const controlId = CreateBankControlId(page, bank)
				socketEmitPromise(socket, 'controls:hot-press', [controlId, isDown]).catch((e) =>
					console.error(`Hot press failed: ${e}`)
				)
			} else if (isDown) {
				setActiveTab('edit')
				setSelectedButton(CreateBankControlId(page, bank))
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
				if (selectedButton) {
					// keyup with button selected

					if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Backspace' || e.key === 'Delete')) {
						clearModalRef.current.show(
							`Clear button ${FormatButtonControlId(selectedButton)}`,
							`This will clear the style, feedbacks and all actions`,
							'Clear',
							() => {
								socketEmitPromise(socket, 'controls:reset', [selectedButton]).catch((e) => {
									console.error(`Reset failed: ${e}`)
								})
							}
						)
					}
					if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'c') {
						console.log('prepare copy', selectedButton)
						setCopyFromButton([selectedButton, 'copy'])
					}
					if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'x') {
						console.log('prepare cut', selectedButton)
						setCopyFromButton([selectedButton, 'cut'])
					}
					if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'v' && copyFromButton) {
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
									{selectedButton ? `${FormatButtonControlId(selectedButton)}` : '?'}
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
								<CNavLink data-tab="importexport">
									<FontAwesomeIcon icon={faFileImport} /> Import / Export
								</CNavLink>
							</CNavItem>
							<CNavItem>
								<CNavLink data-tab="action-recorder">
									<FontAwesomeIcon icon={faVideoCamera} /> Action Recorder
								</CNavLink>
							</CNavItem>
						</CNav>
						<CTabContent fade={false}>
							<CTabPane data-tab="edit">
								<MyErrorBoundary>
									{selectedButton && (
										<EditButton
											key={`${selectedButton}.${tabResetToken}`}
											controlId={selectedButton}
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
							<CTabPane data-tab="importexport">
								<MyErrorBoundary>
									<ImportExport key={tabResetToken} pageNumber={pageNumber} />
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
