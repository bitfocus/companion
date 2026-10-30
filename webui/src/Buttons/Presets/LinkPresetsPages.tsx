import { useDraggable } from '@dnd-kit/react'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observer } from 'mobx-react-lite'
import { useContext, useMemo, useState } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	formatLinkIdFingerprint,
	type LinkRemotePage,
	type LinkRemotePagesResult,
} from '@companion-app/shared/Model/Link.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { ButtonsSidebarSection } from '~/Buttons/ButtonsSidebarSection.js'
import { STATUS_EXPLANATIONS } from '~/Buttons/EditButton/LinkPeerChoices.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { ButtonPreviewBase, RedImage } from '~/Components/ButtonPreview.js'
import { PanelCollapseHelperProvider, usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { PRESET_FEEDBACK_PLUGINS, type PresetDragItem } from './PresetDragItem.js'
import { PresetSectionHeader } from './PresetSectionHeader.js'

/** How often the pages are asked for again while they are shown, to follow changes to them */
const PAGES_REFRESH_MS = 10_000

/** Why the pages of an installation can't be shown */
const PAGES_ERRORS: Record<Extract<LinkRemotePagesResult, { ok: false }>['error'], string> = {
	unknown_peer: 'This installation is no longer known.',
	incompatible: 'This installation runs an incompatible version of Companion Link.',
	offline: 'This installation is not reachable right now.',
	denied: "This installation doesn't share its buttons with this one.",
	timeout: "This installation didn't answer. It will be asked again shortly.",
}

interface LinkPresetsPagesProps {
	peerId: string
	clearSelection: () => void
}

/** The pages of another installation, each as its grid of buttons, to drag onto the grid as remote buttons */
export const LinkPresetsPages = observer(function LinkPresetsPages({
	peerId,
	clearSelection,
}: LinkPresetsPagesProps): React.JSX.Element {
	const { link } = useContext(RootAppStoreContext)
	const peer = link.peers.find((p) => p.id === peerId)

	const query = useQuery(trpc.link.remotePages.queryOptions({ peerId }, { refetchInterval: PAGES_REFRESH_MS }))
	const result = query.data
	// Keep showing the last pages when a refresh fails, rather than unmounting what is open or being dragged
	const [pages, setPages] = useState<Extract<LinkRemotePagesResult, { ok: true }> | null>(null)
	if (result?.ok && result !== pages) setPages(result)
	const pageIds = useMemo(() => pages?.pages.map((page) => String(page.pageNumber)) ?? [], [pages])

	return (
		<PanelCollapseHelperProvider
			storageId={`link-preset-pages-${peerId}`}
			knownPanelIds={pageIds}
			defaultCollapsed={true}
		>
			<ButtonsSidebarSection className="presets-panel" title="Presets" actions={null}>
				<div className="presets-detail-navigation">
					<Button variant="ghost" size="sm" onClick={clearSelection}>
						<FontAwesomeIcon icon={faArrowLeft} /> Back
					</Button>
					<span title={peer?.fingerprint}>{peer?.name ?? formatLinkIdFingerprint(peerId)}</span>
				</div>

				{result && !result.ok && <StaticAlert color="warning">{PAGES_ERRORS[result.error]}</StaticAlert>}
				{pages ? (
					<>
						<p className="presets-intro">Drag a button onto the grid, to show it there and press it from there.</p>
						<div className="collapsible-tree presets-sections-tree">
							{pages.pages.map((page) => (
								<LinkPresetPage key={page.pageNumber} peerId={peerId} page={page} gridSize={pages.gridSize} />
							))}
						</div>
					</>
				) : (
					!result && (
						<LoadingRetryOrError
							error={query.error}
							dataReady={false}
							doRetry={() => void query.refetch()}
							design="pulse"
						/>
					)
				)}
			</ButtonsSidebarSection>
		</PanelCollapseHelperProvider>
	)
})

interface LinkPresetPageProps {
	peerId: string
	page: LinkRemotePage
	gridSize: UserConfigGridSize
}

/**
 * A page of another installation, laid out as its grid is, so that its buttons are where they are there. A place with
 * no button is drawn as an empty button, as on the grid
 */
const LinkPresetPage = observer(function LinkPresetPage({ peerId, page, gridSize }: LinkPresetPageProps) {
	const { isCollapsed, toggleCollapsed } = usePanelCollapseHelperContextForPanel(null, String(page.pageNumber))

	const occupied = useMemo(() => new Set(page.buttons.map(({ row, column }) => `${row}/${column}`)), [page.buttons])

	const cells: React.ReactNode[] = []
	if (!isCollapsed) {
		for (let row = gridSize.minRow; row <= gridSize.maxRow; row++) {
			for (let column = gridSize.minColumn; column <= gridSize.maxColumn; column++) {
				const key = `${row}/${column}`
				cells.push(
					occupied.has(key) ? (
						<RemoteButtonPreview key={key} peerId={peerId} location={{ pageNumber: page.pageNumber, row, column }} />
					) : (
						<EmptyRemoteButtonPreview
							key={key}
							peerId={peerId}
							location={{ pageNumber: page.pageNumber, row, column }}
						/>
					)
				)
			}
		}
	}

	return (
		<>
			<PresetSectionHeader
				name={page.name ? `${page.pageNumber}: ${page.name}` : `Page ${page.pageNumber}`}
				description={page.buttons.length === 0 ? 'No buttons' : null}
				isCollapsed={isCollapsed}
				toggleCollapsed={toggleCollapsed}
			/>
			{!isCollapsed && page.buttons.length > 0 && (
				<div className="presets-section-content">
					<div
						className="presets-link-grid"
						// As many columns as the page has, at full size, scrolling rather than shrinking or wrapping
						style={{ gridTemplateColumns: `repeat(${gridSize.maxColumn - gridSize.minColumn + 1}, 72px)` }}
					>
						{cells}
					</div>
				</div>
			)}
		</>
	)
})

/** Lets a place on a page of another installation be dragged onto the grid, as a remote button showing it */
function useRemoteButtonDrag(peerId: string, location: ControlLocation) {
	const { pageNumber, row, column } = location
	const dragData: PresetDragItem = { kind: 'link', peerId, location }
	return useDraggable<PresetDragItem>({
		id: `link-preset:${peerId}:${pageNumber}/${row}/${column}`,
		type: 'preset',
		data: dragData,
		plugins: PRESET_FEEDBACK_PLUGINS,
	})
}

/** A place with no button, which can still be placed, eg to fill in there later */
function EmptyRemoteButtonPreview({ peerId, location }: { peerId: string; location: ControlLocation }) {
	const { ref: drag, isDragSource } = useRemoteButtonDrag(peerId, location)
	return (
		<ButtonPreviewBase
			dragRef={drag}
			className={isDragSource ? 'preset-drag-source' : undefined}
			title={`${location.pageNumber}/${location.row}/${location.column}`}
			preview={null}
		/>
	)
}

function RemoteButtonPreview({ peerId, location }: { peerId: string; location: ControlLocation }) {
	const { pageNumber, row, column } = location
	const { ref: drag, isDragSource } = useRemoteButtonDrag(peerId, location)

	const sub = useSubscription(trpc.link.watchRemoteButton.subscriptionOptions({ peerId, location }))

	const explanation = sub.data ? STATUS_EXPLANATIONS[sub.data.status] : null

	return (
		<ButtonPreviewBase
			dragRef={drag}
			className={isDragSource ? 'preset-drag-source' : undefined}
			title={explanation ?? `${pageNumber}/${row}/${column}`}
			preview={sub.error || explanation ? RedImage : sub.data?.dataUrl}
		/>
	)
}
