import { useDragDropMonitor } from '@dnd-kit/react'
import {
	faCalculator,
	faDollarSign,
	faGift,
	faLayerGroup,
	faObjectGroup,
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
import { safeSetSessionStorage } from '~/Helpers/SafeStorage.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ActionRecorder } from './ActionRecorder/index.js'
import { ButtonsGridPanel } from './ButtonGridPanel.js'
import { ButtonGridSelectionPanel } from './ButtonGridSelectionPanel.js'
import { ButtonGridStore } from './ButtonGridStore.js'
import { ButtonGridViewProvider, type ButtonGridView } from './ButtonGridViewContext.js'
import { EditButton } from './EditButton/EditButton.js'
import { GRID_BUTTON_DRAG_TYPE, type GridButtonDragItem } from './GridButtonDragItem.js'
import { parseGridButtonDroppableId } from './GridButtonDroppableId.js'
import { planGridDrop } from './GridDragDrop.js'
import { buildTransferPairs, previewPlacements, withoutEmptySources } from './GridGeometry.js'
import type { GridToolActions, GridTransferPair } from './GridTools/index.js'
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

	// The URL is the source of truth, but it can name a page that does not exist. Resolve that to a
	// real page for this render and correct the URL afterwards, rather than mutating as we go.
	const pageNumber = useMemo(() => {
		if (rawPageNumber === null) return null

		const highestPage = Math.max(1, pageCount)
		const wanted = rawPageNumber <= 0 ? getLastPageNumber() : rawPageNumber
		return Math.min(Math.max(wanted, 1), highestPage)
	}, [rawPageNumber, pageCount])

	const setPageNumber = useCallback(
		(pageNumber: number) => {
			navigateToButtonsPage(navigate, pageNumber)
		},
		[navigate]
	)

	useEffect(() => {
		if (rawPageNumber === null || pageNumber === null) return
		if (rawPageNumber !== pageNumber) navigateToButtonsPage(navigate, pageNumber)
	}, [rawPageNumber, pageNumber, navigate])

	const gridSize = userConfig.properties?.gridSize

	const resetControlsMutation = useMutationExt(trpc.controls.resetControls.mutationOptions())
	const gridBatchTransferMutation = useMutationExt(trpc.controls.gridBatchTransfer.mutationOptions())
	const hotPressMutation = useMutationExt(trpc.controls.hotPressControl.mutationOptions())

	const openEditor = useCallback((location: ControlLocation) => {
		setActiveTab('edit')
		setSelectedButton(location)
		setTabResetToken(nanoid())
	}, [])

	const isOccupied = useCallback(
		(location: ControlLocation) => Boolean(pages.getControlIdAtLocation(location)),
		[pages]
	)

	// A button placed outside the grid is somewhere nothing can reach it, so the tools refuse a
	// placement that would do that rather than clamping it to the edge
	const fitsOnGrid = useCallback(
		(locations: ControlLocation[]) => {
			if (!gridSize) return false

			return locations.every(
				(location) =>
					location.row >= gridSize.minRow &&
					location.row <= gridSize.maxRow &&
					location.column >= gridSize.minColumn &&
					location.column <= gridSize.maxColumn
			)
		},
		[gridSize]
	)

	const actions = useMemo<GridToolActions>(
		() => ({
			openEditor,
			fitsOnGrid,
			press: (location, isDown) => {
				hotPressMutation
					.mutateAsync({ location, direction: isDown, surfaceId: 'grid' })
					.catch((e) => console.error(`Hot press failed: ${e}`))
			},
			// Every way of moving buttons around the grid - the toolbar tools, dragging, pasting, the
			// context menu - ends up here, so the things that must never happen quietly are checked in
			// one place rather than in each of them.
			transfer: (operation, pairs: GridTransferPair[], onApplied: () => void) => {
				const carrying = withoutEmptySources(operation, pairs, isOccupied)
				if (carrying.length === 0) return

				// Off the grid is out of reach. Refusing the whole thing rather than the part that fits
				// means a move can never destroy its source in exchange for nothing.
				if (!fitsOnGrid(carrying.map((pair) => pair.toLocation))) return

				const apply = () => {
					// One request for the whole lot, so overlapping regions are resolved against the state
					// as it was before anything moved, and a rejection leaves nothing half-applied
					gridBatchTransferMutation
						.mutateAsync({ operation, pairs: carrying })
						.catch((e) => console.error(`${operation} failed: ${e}`))

					// Follow the buttons to where they landed. Leaving the old positions selected points at
					// where they used to be, which is no use for whatever you want to do next.
					gridStore.setSelection(carrying.map((pair) => pair.toLocation))
					setTabResetToken(nanoid())
					onApplied()
				}

				// A swap trades rather than destroys, and a cell the buttons are vacating anyway is not
				// being overwritten by them
				const vacated = new Set(operation === 'move' ? carrying.map((pair) => formatLocation(pair.fromLocation)) : [])
				const overwritten =
					operation === 'swap'
						? []
						: carrying.filter(({ toLocation }) => !vacated.has(formatLocation(toLocation)) && isOccupied(toLocation))

				if (overwritten.length > 0) {
					confirmModalRef.current?.show(
						`Overwrite ${describeButtons(overwritten.length)}`,
						[
							`This will replace ${describeButtons(overwritten.length)} already here.`,
							`There's no going back from this.`,
						],
						'Overwrite',
						apply
					)
					return
				}

				apply()
			},
			isOccupied,
			pasteAt: (location) => pasteClipboardAt(location),
			clearButtons: (locations) => {
				if (locations.length === 0) return

				const description =
					locations.length === 1 ? `Clear button ${formatLocation(locations[0])}` : `Clear ${locations.length} buttons`

				confirmModalRef.current?.show(
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
		[openEditor, fitsOnGrid, isOccupied, hotPressMutation, gridBatchTransferMutation, resetControlsMutation, gridStore]
	)

	// Both the keyboard and the context menu paste through here, so a paste costs the same either way
	const pasteClipboardAt = useCallback(
		(location: ControlLocation) => {
			const clipboard = gridStore.clipboard
			if (!clipboard || !gridSize) return

			const operation = clipboard.mode === 'cut' ? 'move' : 'copy'
			// Top-left, not centred like the tools: a paste names its destination rather than pointing at
			// it, with no ghost to show which cell of the region the answer was measured from
			const pairs = withoutEmptySources(
				operation,
				buildTransferPairs(clipboard.locations, location, 'top-left'),
				isOccupied
			)

			// `transfer` refuses this anyway, but silently - and a paste that appears to do nothing at all
			// is worth explaining, since there is no ghost under a keyboard paste to have shown it coming
			const offGrid = pairs.filter(({ toLocation }) => !fitsOnGrid([toLocation]))
			if (offGrid.length > 0) {
				confirmModalRef.current?.show(
					`Cannot paste here`,
					[
						`${offGrid.length} of the ${describeButtons(pairs.length)} would land outside the grid.`,
						`Nothing has been pasted. Try somewhere with more room, or make the grid bigger.`,
					],
					'OK',
					() => undefined
				)
				return
			}

			// Overwriting is confirmed inside `transfer`, so a cut is only spent once the paste has
			// actually happened
			actions.transfer(operation, pairs, () => {
				if (clipboard.mode === 'cut') gridStore.clearClipboard()
			})
		},
		[gridStore, gridSize, fitsOnGrid, isOccupied, actions]
	)

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
		if (pageNumber !== null) gridStore.setViewPage(pageNumber, actions)
	}, [pageNumber, gridStore, actions])

	// When screen becomes large, switch away from grid tab since it's now in its own column
	useEffect(() => {
		if (isLargeScreen && activeTab === 'grid') {
			setActiveTab('pages')
		}
	}, [isLargeScreen, activeTab])

	// Dropping a preset (from the Presets tab) onto a grid button imports it at that location.
	// Subscribed via the global dnd-kit provider; we filter drags by `type`.
	const importPresetMutation = useMutationExt(trpc.controls.importPreset.mutationOptions())
	useDragDropMonitor({
		onDragOver(event) {
			const { source, target } = event.operation
			if (!source || source.type !== GRID_BUTTON_DRAG_TYPE) return

			const plan = target ? resolveGridDrop(source, target.id) : null
			gridStore.setDragPreview(
				plan ? { placements: previewPlacements(plan.operation, plan.pairs), valid: plan.fitsOnGrid } : null
			)
		},
		onDragEnd(event) {
			gridStore.setDragPreview(null)

			if (event.canceled) return
			const { source, target } = event.operation
			if (!source || !target) return

			if (source.type === 'preset') {
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
				return
			}

			if (source.type !== GRID_BUTTON_DRAG_TYPE) return

			const plan = resolveGridDrop(source, target.id)
			// A region that would hang off the grid is refused outright rather than dropping the part
			// that happens to fit - the preview said as much while it was still being held
			if (!plan || !plan.fitsOnGrid) return

			// Overwriting is confirmed inside `transfer`, the same way it is for every other way of
			// moving buttons about
			actions.transfer(plan.operation, plan.pairs, () => undefined)
		},
	})

	// Resolving the drag the same way for the preview and for the drop is what stops the two
	// disagreeing about where the buttons were going to land
	const resolveGridDrop = useCallback(
		(source: { data: unknown } | null, targetId: unknown) => {
			if (!gridSize) return null

			const destination = parseGridButtonDroppableId(targetId)
			if (!destination) return null

			const origin = (source?.data as GridButtonDragItem | undefined)?.location
			if (!origin) return null

			// Dragging a button that is part of the selection takes the whole selection with it
			const selection = gridStore.selectedLocations
			const originKey = formatLocation(origin)
			const sources = selection.some((l) => formatLocation(l) === originKey) ? [...selection] : [origin]

			return planGridDrop(origin, destination, sources, gridSize, (location) =>
				Boolean(pages.getControlIdAtLocation(location))
			)
		},
		[gridSize, gridStore, pages]
	)

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
	const hasMultipleSelected = selectionCount > 1

	// On a wide screen the grid stays visible, so showing what was just selected costs nothing. On a
	// narrow one the panel would replace the grid mid-gesture, which would be maddening.
	useEffect(() => {
		if (hasMultipleSelected && isLargeScreen) setActiveTab('edit')
	}, [hasMultipleSelected, isLargeScreen])

	// That tab only exists while there is something for it to show. Dropping the selection - or handing
	// it to a tool that picks the buttons up - takes it away, and leaves the panel blank if it was the
	// tab you were on.
	useEffect(() => {
		if (!selectedButton && !hasMultipleSelected) {
			setActiveTab((oldTab) => (oldTab === 'edit' ? 'pages' : oldTab))
		}
	}, [selectedButton, hasMultipleSelected])

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

			// Shift extends the selection as the focus moves, ctrl walks the focus without disturbing it,
			// and a plain arrow selects wherever it lands - the same three behaviours as any file list
			const navigate = (rowDelta: number, columnDelta: number) => {
				e.preventDefault()

				if (e.shiftKey) gridStore.extendFocus(rowDelta, columnDelta, gridSize)
				else if (isControlOrCommandCombo) gridStore.moveFocusOnly(rowDelta, columnDelta, gridSize)
				else gridStore.moveFocus(rowDelta, columnDelta, gridSize)
			}

			switch (e.key) {
				case 'Escape':
					// One step back through whatever is in progress, rather than straight to nothing
					gridStore.goBack(actions)
					return
				case 'ArrowDown':
					navigate(1, 0)
					return
				case 'ArrowUp':
					navigate(-1, 0)
					return
				case 'ArrowLeft':
					navigate(0, -1)
					return
				case 'ArrowRight':
					navigate(0, 1)
					return
				case ' ':
					// Build up a scattered selection without needing a mouse
					e.preventDefault()
					gridStore.toggleFocused()
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

			if (isControlOrCommandCombo && e.key.toLowerCase() === 'a' && pageNumber !== null) {
				e.preventDefault()
				gridStore.selectAllOnPage(pageNumber, gridSize)
				return
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
				const focus = gridStore.focus
				if (focus) pasteClipboardAt(focus)
			}
		},
		[gridStore, actions, gridSize, pageNumber, setPageNumber, gridZoomController, pages.data.length, pasteClipboardAt]
	)

	if (pageNumber === null) {
		return <></>
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
								{(selectedButton || hasMultipleSelected) && (
									<TabArea.Tab value="edit">
										{hasMultipleSelected ? (
											<>
												<FontAwesomeIcon icon={faObjectGroup} /> Selection ({selectionCount})
											</>
										) : (
											<>
												<FontAwesomeIcon icon={faCalculator} /> Edit Button{' '}
												{selectedButton ? `${formatLocation(selectedButton)}` : '?'}
											</>
										)}
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
									{hasMultipleSelected ? (
										<ButtonGridSelectionPanel />
									) : (
										selectedButton && (
											<EditButton
												key={`${formatLocation(selectedButton)}-${tabResetToken}`}
												location={selectedButton}
												onKeyUp={handleKeyDownInButtons}
												navigateToControl={navigateToControl}
											/>
										)
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

function describeButtons(count: number): string {
	return count === 1 ? '1 button' : `${count} buttons`
}
