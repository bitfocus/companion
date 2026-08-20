import { useDragDropMonitor } from '@dnd-kit/react'
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
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useMediaQuery } from 'usehooks-ts'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ContextMenu } from '~/Components/ContextMenu.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { TabArea } from '~/Components/TabArea.js'
import { safeSetSessionStorage } from '~/Helpers/SafeStorage.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ActionRecorder } from './ActionRecorder/index.js'
import { ButtonsGridPanel } from './ButtonGridPanel.js'
import { ButtonGridStore } from './ButtonGridStore.js'
import { ButtonGridViewProvider, type ButtonGridView } from './ButtonGridViewContext.js'
import { EditButton } from './EditButton/EditButton.js'
import { parseGridButtonDroppableId } from './GridButtonDroppableId.js'
import { buildTransferPairs, type GridToolActions, type GridTransferPair } from './GridTools/index.js'
import { useGridZoom } from './GridZoom.js'
import { PagesList } from './Pages.js'
import { PageVariablesPanel } from './PageVariablesPanel.js'
import type { PresetDragItem } from './Presets/PresetDragItem.js'
import { ConnectionPresets } from './Presets/Presets.js'
import { useButtonContextMenu } from './useButtonContextMenu.js'

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
	safeSetSessionStorage(SESSION_STORAGE_LAST_BUTTONS_PAGE, pageNumber.toString())
}

function getLastPageNumber(): number {
	const lastPage = Number(window.sessionStorage.getItem(SESSION_STORAGE_LAST_BUTTONS_PAGE))
	if (!isNaN(lastPage) && lastPage > 0) {
		return lastPage
	}
	return 1
}

export const ButtonsPage = observer(function ButtonsPage() {
	const { userConfig, pages } = useContext(RootAppStoreContext)

	const clearModalRef = useRef<GenericConfirmModalRef>(null)
	const [gridZoomController, gridZoomValue] = useGridZoom('grid')

	const isLargeScreen = useMediaQuery('(min-width: 1200px)')

	const [tabResetToken, setTabResetToken] = useState(nanoid())
	const [activeTab, setActiveTab] = useState('grid')

	// Selection and the active tool live here rather than in component state, so the grid cells can
	// each subscribe to just the part that concerns them
	const [gridStore] = useState(() => new ButtonGridStore())
	const [selectedButton, setSelectedButton] = useState<ControlLocation | null>(null)

	const navigate = useNavigate({ from: '/buttons' })
	let pageNumber = useUrlPageNumber()
	const setPageNumber = useCallback(
		(pageNumber: number) => {
			navigateToButtonsPage(navigate, pageNumber)
		},
		[navigate]
	)

	const gridSize = userConfig.properties?.gridSize

	const resetControlsMutation = useMutationExt(trpc.controls.resetControls.mutationOptions())
	const gridBatchTransferMutation = useMutationExt(trpc.controls.gridBatchTransfer.mutationOptions())
	const hotPressMutation = useMutationExt(trpc.controls.hotPressControl.mutationOptions())

	const openEditor = useCallback((location: ControlLocation) => {
		setActiveTab('edit')
		setSelectedButton(location)
		setTabResetToken(nanoid())
	}, [])

	const actions = useMemo<GridToolActions>(
		() => ({
			openEditor,
			press: (location, isDown) => {
				hotPressMutation
					.mutateAsync({ location, direction: isDown, surfaceId: 'grid' })
					.catch((e) => console.error(`Hot press failed: ${e}`))
			},
			transfer: (operation, pairs: GridTransferPair[]) => {
				if (pairs.length === 0) return

				// One request for the whole lot, so overlapping regions are resolved against the state as
				// it was before anything moved, and a rejection leaves nothing half-applied
				gridBatchTransferMutation
					.mutateAsync({ operation, pairs })
					.catch((e) => console.error(`${operation} failed: ${e}`))
				setTabResetToken(nanoid())
			},
			clearButtons: (locations) => {
				if (locations.length === 0) return

				const description =
					locations.length === 1 ? `Clear button ${formatLocation(locations[0])}` : `Clear ${locations.length} buttons`

				clearModalRef.current?.show(
					description,
					`This will clear the style, feedbacks and all actions`,
					'Clear',
					() => {
						resetControlsMutation.mutateAsync({ locations: [...locations], newType: null }).catch((e) => {
							console.error(`Reset failed: ${e}`)
						})
					}
				)
			},
		}),
		[openEditor, hotPressMutation, gridBatchTransferMutation, resetControlsMutation]
	)

	const navigateToControl = useCallback(
		(location: ControlLocation) => {
			setPageNumber(location.pageNumber)
			gridStore.setSelection([location])
			openEditor(location)
		},
		[setPageNumber, gridStore, openEditor]
	)

	// When screen becomes large, switch away from grid tab since it's now in its own column
	useEffect(() => {
		if (isLargeScreen && activeTab === 'grid') {
			setActiveTab('pages')
		}
	}, [isLargeScreen, activeTab])

	// Dropping a preset (from the Presets tab) onto a grid button imports it at that location.
	// Subscribed via the global dnd-kit provider; we filter to preset drags by `type`.
	const importPresetMutation = useMutationExt(trpc.controls.importPreset.mutationOptions())
	useDragDropMonitor({
		onDragEnd(event) {
			if (event.canceled) return
			const { source, target } = event.operation
			if (!source || !target || source.type !== 'preset') return

			const location = parseGridButtonDroppableId(target.id)
			if (!location) return

			const dropData = source.data as PresetDragItem
			importPresetMutation
				.mutateAsync({
					connectionId: dropData.connectionId,
					presetId: dropData.presetId,
					location,
					variableValues: dropData.variableValues,
					mode: dropData.mode,
				})
				.catch(() => {
					console.error('Preset import failed')
				})
		},
	})

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

	const gridView = useMemo<ButtonGridView>(
		() => ({ store: gridStore, actions, onContextMenu: doButtonContextMenu }),
		[gridStore, actions, doButtonContextMenu]
	)

	const handleKeyDownInButtons = useCallback(
		(e: React.KeyboardEvent) => {
			const isControlOrCommandCombo = (e.ctrlKey || e.metaKey) && !e.altKey

			// e.target is the actual element where the event happened, e.currentTarget is the element where the event listener is attached
			const targetElement = e.target as HTMLElement

			// TODO - this feels messy, perhaps this can be done cleaner?
			if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
				// Don't interfere with typing in inputs
				return
			}
			if (targetElement.classList.contains('native-edit-context')) {
				// Don't interfere with typing in the expression editor
				return
			}

			if (isControlOrCommandCombo && e.key === '=') {
				e.preventDefault()
				gridZoomController.zoomIn(true)
				return
			}
			if (isControlOrCommandCombo && e.key === '-') {
				e.preventDefault()
				gridZoomController.zoomOut(true)
				return
			}
			if (isControlOrCommandCombo && e.key === '0') {
				e.preventDefault()
				gridZoomController.zoomReset()
				return
			}

			if (!gridSize) return

			switch (e.key) {
				case 'Escape':
					// One step back through whatever is in progress, rather than straight to nothing
					gridStore.goBack(actions)
					return
				case 'ArrowDown':
					gridStore.moveFocus(1, 0, gridSize)
					return
				case 'ArrowUp':
					gridStore.moveFocus(-1, 0, gridSize)
					return
				case 'ArrowLeft':
					gridStore.moveFocus(0, -1, gridSize)
					return
				case 'ArrowRight':
					gridStore.moveFocus(0, 1, gridSize)
					return
				case 'PageUp': {
					const focus = gridStore.focus
					if (!focus) return
					const newPageNumber = focus.pageNumber >= pages.data.length ? 1 : focus.pageNumber + 1
					setPageNumber(newPageNumber)
					gridStore.moveFocusToPage(newPageNumber)
					return
				}
				case 'PageDown': {
					const focus = gridStore.focus
					if (!focus) return
					const newPageNumber = focus.pageNumber <= 1 ? pages.data.length : focus.pageNumber - 1
					setPageNumber(newPageNumber)
					gridStore.moveFocusToPage(newPageNumber)
					return
				}
			}

			const selection = gridStore.selectedLocations
			if (selection.length === 0) return

			if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Backspace' || e.key === 'Delete')) {
				actions.clearButtons([...selection])
				return
			}
			if (isControlOrCommandCombo && e.key.toLowerCase() === 'c') {
				gridStore.setClipboard(selection, 'copy')
				return
			}
			if (isControlOrCommandCombo && e.key.toLowerCase() === 'x') {
				gridStore.setClipboard(selection, 'cut')
				return
			}
			if (isControlOrCommandCombo && e.key.toLowerCase() === 'v') {
				const clipboard = gridStore.clipboard
				const focus = gridStore.focus
				if (!clipboard || !focus) return

				actions.transfer(clipboard.mode === 'cut' ? 'move' : 'copy', buildTransferPairs(clipboard.locations, focus))
				if (clipboard.mode === 'cut') gridStore.clearClipboard()
			}
		},
		[gridStore, actions, gridSize, setPageNumber, gridZoomController, pages.data.length]
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
				<GenericConfirmModal ref={clearModalRef} />
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
								{selectedButton && (
									<TabArea.Tab value="edit">
										<FontAwesomeIcon icon={faCalculator} /> Edit Button{' '}
										{selectedButton ? `${formatLocation(selectedButton)}` : '?'}
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
									{selectedButton && (
										<EditButton
											key={`${formatLocation(selectedButton)}-${tabResetToken}`}
											location={selectedButton}
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
