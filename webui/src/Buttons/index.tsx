import {
	faCalculator,
	faDollarSign,
	faGift,
	faLayerGroup,
	faThLarge,
	faVideoCamera,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMatchRoute, useNavigate, type UseNavigateResult } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { nanoid } from 'nanoid'
import { useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useMediaQuery } from 'usehooks-ts'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ContextMenu } from '~/Components/ContextMenu.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { TabArea } from '~/Components/TabArea.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ActionRecorder } from './ActionRecorder/index.js'
import { ButtonsGridPanel } from './ButtonGridPanel.js'
import { ButtonGridStore } from './ButtonGridStore.js'
import { ButtonGridViewProvider, type ButtonGridView } from './ButtonGridViewContext.js'
import { EditButton } from './EditButton/EditButton.js'
import { rememberViewedPage, resolveViewedPage } from './GridPageNavigation.js'
import { useGridZoom } from './GridZoom.js'
import { PagesList } from './Pages.js'
import { PageVariablesPanel } from './PageVariablesPanel.js'
import { ConnectionPresets } from './Presets/Presets.js'
import { useButtonContextMenu } from './useButtonContextMenu.js'
import { useGridDropMonitor } from './useGridDropMonitor.js'
import { useGridKeyboard } from './useGridKeyboard.js'
import { useGridToolActions } from './useGridToolActions.js'

/** What the URL asks for, or 0 when it names no usable page - "wherever I was" */
function useUrlPageNumber(): number {
	const matchRoute = useMatchRoute()
	const match = matchRoute({ to: '/buttons/$page' })

	const pageIndex = match ? Number(match.page) : NaN
	if (isNaN(pageIndex) || pageIndex <= 0) return 0

	return pageIndex
}

function navigateToButtonsPage(navigate: UseNavigateResult<'/buttons'>, pageNumber: number): void {
	void navigate({ to: `/buttons/${pageNumber}` })
	rememberViewedPage(pageNumber)
}

export const ButtonsPage = observer(function ButtonsPage() {
	const { userConfig, pages } = useContext(RootAppStoreContext)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const [gridZoomController, gridZoomValue] = useGridZoom('grid')

	const isLargeScreen = useMediaQuery('(min-width: 1200px)')

	const [tabResetToken, setTabResetToken] = useState(nanoid())
	const [activeTab, setActiveTab] = useState('grid')

	// Selection and the active tool live here rather than in component state, so the grid cells can
	// each subscribe to just the part that concerns them
	const [gridStore] = useState(() => new ButtonGridStore())
	const [selectedButton, setSelectedButton] = useState<ControlLocation | null>(null)

	const navigate = useNavigate({ from: '/buttons' })
	const rawPageNumber = useUrlPageNumber()
	const pageCount = pages.pageCount

	// Resolved for this render, and the URL corrected afterwards, rather than mutating as we go
	const pageNumber = useMemo(() => resolveViewedPage(rawPageNumber, pageCount), [rawPageNumber, pageCount])

	const setPageNumber = useCallback(
		(pageNumber: number) => {
			navigateToButtonsPage(navigate, pageNumber)
		},
		[navigate]
	)

	useEffect(() => {
		if (rawPageNumber !== pageNumber) navigateToButtonsPage(navigate, pageNumber)
	}, [rawPageNumber, pageNumber, navigate])

	const gridSize = userConfig.properties?.gridSize

	const openEditor = useCallback((location: ControlLocation) => {
		setActiveTab('edit')
		setSelectedButton(location)
		setTabResetToken(nanoid())
	}, [])

	const isOccupied = useCallback(
		(location: ControlLocation) => Boolean(pages.getControlIdAtLocation(location)),
		[pages]
	)

	const onGridChanged = useCallback(() => setTabResetToken(nanoid()), [])

	const actions = useGridToolActions({
		store: gridStore,
		gridSize,
		isOccupied,
		openEditor,
		confirmRef: confirmModalRef,
		onGridChanged,
	})

	const navigateToControl = useCallback(
		(location: ControlLocation) => {
			setPageNumber(location.pageNumber)
			gridStore.setSelection([location])
			openEditor(location)
		},
		[setPageNumber, gridStore, openEditor]
	)

	// A selection belongs to one page, while a half-finished copy deliberately outlives the change
	useEffect(() => {
		gridStore.setViewPage(pageNumber, actions)
	}, [pageNumber, gridStore, actions])

	// When screen becomes large, switch away from grid tab since it's now in its own column
	useEffect(() => {
		if (isLargeScreen && activeTab === 'grid') {
			setActiveTab('pages')
		}
	}, [isLargeScreen, activeTab])

	useGridDropMonitor({ store: gridStore, gridSize, isOccupied, actions })

	const {
		contextMenuOpen,
		setContextMenuOpen,
		contextMenuPosition,
		contextMenuLocation,
		contextMenuItems,
		doButtonContextMenu,
	} = useButtonContextMenu({
		store: gridStore,
		actions,
		setTabResetToken,
	})

	const selectionCount = useSyncExternalStore(
		gridStore.subscribe,
		useCallback(() => gridStore.selectionCount, [gridStore])
	)

	// The editor edits one button. With several selected there is no one button it could mean - the
	// last one opened is not necessarily even in the selection - and showing it beside a highlighted
	// block invites the idea that what you type there lands on all of them.
	const editingButton = selectedButton && selectionCount <= 1 ? selectedButton : null

	// The tab exists only while there is a button for it to show, so it goes away for the length of a
	// multiple selection, and would leave the panel blank if it was the tab you were on
	useEffect(() => {
		if (!editingButton) {
			setActiveTab((oldTab) => (oldTab === 'edit' ? 'pages' : oldTab))
		}
	}, [editingButton])

	const gridView = useMemo<ButtonGridView>(
		() => ({ store: gridStore, actions, onContextMenu: doButtonContextMenu }),
		[gridStore, actions, doButtonContextMenu]
	)

	const handleKeyDownInButtons = useGridKeyboard({
		store: gridStore,
		actions,
		gridSize,
		pageNumber,
		pageCount: pages.data.length,
		setPageNumber,
		zoom: gridZoomController,
	})

	const gridPanel = (
		<MyErrorBoundary>
			<ButtonsGridPanel
				pageNumber={pageNumber}
				changePage={setPageNumber}
				onKeyDown={handleKeyDownInButtons}
				contextMenuButton={contextMenuOpen ? contextMenuLocation : null}
				onButtonContextMenu={doButtonContextMenu}
				gridZoomController={gridZoomController}
				gridZoomValue={gridZoomValue}
			/>
		</MyErrorBoundary>
	)

	return (
		<ButtonGridViewProvider value={gridView}>
			<SplitPanels.Root showing={null} className="buttons-page" resize={{ storageKey: 'buttons' }}>
				<GenericConfirmModal ref={confirmModalRef} />
				<ContextMenu
					open={contextMenuOpen}
					onOpenChange={setContextMenuOpen}
					position={contextMenuPosition}
					menuItems={contextMenuItems}
				/>

				{/* On large screens, show the grid in its own column */}
				{isLargeScreen && <SplitPanels.Primary>{gridPanel}</SplitPanels.Primary>}

				<SplitPanels.Secondary>
					<div className="secondary-panel-inner">
						<TabArea.Root value={activeTab} onValueChange={setActiveTab}>
							<TabArea.List>
								{!isLargeScreen && (
									<TabArea.Tab value="grid">
										<FontAwesomeIcon icon={faThLarge} /> Buttons
									</TabArea.Tab>
								)}
								{editingButton && (
									<TabArea.Tab value="edit">
										<FontAwesomeIcon icon={faCalculator} /> Edit Button {formatLocation(editingButton)}
									</TabArea.Tab>
								)}
								<TabArea.Tab value="pages">
									<FontAwesomeIcon icon={faLayerGroup} /> Pages
								</TabArea.Tab>
								<TabArea.Tab value="page-variables">
									<FontAwesomeIcon icon={faDollarSign} /> Page Variables
								</TabArea.Tab>
								<TabArea.Tab value="presets">
									<FontAwesomeIcon icon={faGift} /> Presets
								</TabArea.Tab>
								<TabArea.Tab value="action-recorder">
									<FontAwesomeIcon icon={faVideoCamera} /> Recorder
								</TabArea.Tab>
							</TabArea.List>

							{/* On small screens, show the grid in its own tab */}
							{!isLargeScreen && <TabArea.Panel value="grid">{gridPanel}</TabArea.Panel>}
							<TabArea.Panel value="edit">
								<MyErrorBoundary>
									{editingButton && (
										<EditButton
											key={`${formatLocation(editingButton)}-${tabResetToken}`}
											location={editingButton}
											onKeyUp={handleKeyDownInButtons}
											navigateToControl={navigateToControl}
										/>
									)}
								</MyErrorBoundary>
							</TabArea.Panel>
							<TabArea.Panel value="pages">
								<MyErrorBoundary>
									<PagesList setPageNumber={setPageNumber} />
								</MyErrorBoundary>
							</TabArea.Panel>
							<TabArea.Panel value="page-variables">
								<MyErrorBoundary>
									<PageVariablesPanel pageNumber={pageNumber} />
								</MyErrorBoundary>
							</TabArea.Panel>
							<TabArea.Panel value="presets">
								<MyErrorBoundary>
									<ConnectionPresets resetToken={tabResetToken} />
								</MyErrorBoundary>
							</TabArea.Panel>
							<TabArea.Panel value="action-recorder" className="pt-0">
								<MyErrorBoundary>
									<ActionRecorder />
								</MyErrorBoundary>
							</TabArea.Panel>
						</TabArea.Root>
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</ButtonGridViewProvider>
	)
})
