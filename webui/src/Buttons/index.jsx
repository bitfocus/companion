import { CCol, CNav, CNavItem, CNavLink, CRow, CTabContent, CTabPane, CTabs } from "@coreui/react";
import { faCalculator, faFileImport, faGift } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import shortid from "shortid";
import { InstancePresets } from "./Presets";
import { CompanionContext, MyErrorBoundary } from "../util";
import { ButtonsGridPanel } from "./ButtonGrid";
import { EditButton } from "./EditButton";
import { ImportExport } from "./ImportExport";
import { useCallback, useContext, useRef, useState } from "react";
import { GenericConfirmModal } from "../Components/GenericConfirmModal";

export function ButtonsPage({ hotPress }) {
	const context = useContext(CompanionContext)

	const clearModalRef = useRef()
	
	const [tabResetToken, setTabResetToken] = useState(shortid())
	const [activeTab, setActiveTab] = useState('presets')
	const [selectedButton, setSelectedButton] = useState(null)
	const [pageNumber, setPageNumber] = useState(1)
	const [copyFromButton, setCopyFromButton] = useState(null)

	const doChangeTab = useCallback((newTab) => {
		setActiveTab(oldTab => {
			if (oldTab !== newTab) {
				setSelectedButton(null)
				setTabResetToken(shortid())
			}
			return newTab
		})
	}, [])

	const doButtonGridClick = useCallback((page, bank, isDown) => {
		if (hotPress) {
			context.socket.emit('hot_press', page, bank, isDown);
		} else if (isDown) {
			setActiveTab('edit')
			setSelectedButton([page, bank])
			setTabResetToken(shortid())
		}
	}, [context.socket, hotPress])


	const handleKeyUpInButtons = useCallback((e) => {
		if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
			if (selectedButton) {
				// keyup with button selected

				if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Backspace' || e.key === 'Delete')) {
					clearModalRef.current.show(`Clear button ${selectedButton[0]}.${selectedButton[1]}`, `This will clear the style, feedbacks and all actions`, 'Clear', ['bank_reset', selectedButton[0], selectedButton[1]], () => {
						// Invalidate the ui component to cause a reload
						setTabResetToken(shortid())
					})
				}
				if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'c') {
					console.log('prepare copy', selectedButton)
					setCopyFromButton([...selectedButton, 'copy'])
				}
				if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'x') {
					console.log('prepare cut', selectedButton)
					setCopyFromButton([...selectedButton, 'cut'])
				}
				if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'v' && copyFromButton) {
					console.log('do paste', copyFromButton, selectedButton)

					if (copyFromButton[2] === 'copy') {
						context.socket.emit('bank_copy', copyFromButton[0], copyFromButton[1], selectedButton[0], selectedButton[1]);
						setTabResetToken(shortid())
					} else if (copyFromButton[2] === 'cut') {
						context.socket.emit('bank_move', copyFromButton[0], copyFromButton[1], selectedButton[0], selectedButton[1]);
						setCopyFromButton(null)
						setTabResetToken(shortid())
					} else {
						console.error('unknown paste operation:', copyFromButton[2])
					}
				}
			}
		}
	}, [context.socket, selectedButton, copyFromButton])

	return (
		<CRow className="buttons-page">

			<GenericConfirmModal ref={clearModalRef} />

			<CCol xs={12} xl={6} className="primary-panel">
				<MyErrorBoundary>
					<ButtonsGridPanel
						buttonGridClick={doButtonGridClick}
						isHot={hotPress}
						selectedButton={selectedButton}
						pageNumber={pageNumber}
						changePage={setPageNumber}
						onKeyUp={handleKeyUpInButtons}
					/>
				</MyErrorBoundary>
			</CCol>

			<CCol xs={12} xl={6} className="secondary-panel">
				<CTabs activeTab={activeTab} onActiveTabChange={doChangeTab}>
					<CNav variant="tabs">
						<CNavItem hidden={!selectedButton}><CNavLink data-tab="edit"><FontAwesomeIcon icon={faCalculator} /> Edit Button {selectedButton ? `${selectedButton[0]}.${selectedButton[1]}` : '?'}</CNavLink></CNavItem>
						<CNavItem><CNavLink data-tab="presets"><FontAwesomeIcon icon={faGift} /> Presets</CNavLink></CNavItem>
						<CNavItem><CNavLink data-tab="importexport"><FontAwesomeIcon icon={faFileImport} /> Import / Export</CNavLink></CNavItem>
					</CNav>
					<CTabContent fade={false}>
						<CTabPane data-tab="edit">
							<MyErrorBoundary>
								{
									selectedButton
										? <EditButton
											key={`${selectedButton[0]}.${selectedButton[1]}.${tabResetToken}`}
											page={selectedButton[0]}
											bank={selectedButton[1]}
											onKeyUp={handleKeyUpInButtons}
										/>
										: ''
								}
							</MyErrorBoundary>
						</CTabPane>
						<CTabPane data-tab="presets">
							<MyErrorBoundary>
								<InstancePresets resetToken={tabResetToken} />
							</MyErrorBoundary>
						</CTabPane>
						<CTabPane data-tab="importexport">
							<MyErrorBoundary>
								<ImportExport key={tabResetToken} pageNumber={pageNumber} />
							</MyErrorBoundary>
						</CTabPane>
					</CTabContent>
				</CTabs>
			</CCol>

		</CRow>
	)
}