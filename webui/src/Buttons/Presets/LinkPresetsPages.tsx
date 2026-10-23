import { useDraggable } from '@dnd-kit/react'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useMemo } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { LinkRemotePage, LinkRemotePagesResult } from '@companion-app/shared/Model/Link.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { ButtonsSidebarSection } from '~/Buttons/ButtonsSidebarSection.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { ButtonPreviewBase, RedImage } from '~/Components/ButtonPreview.js'
import { PanelCollapseHelperProvider, usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc } from '~/Resources/TRPC.js'
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
export function LinkPresetsPages({ peerId, clearSelection }: LinkPresetsPagesProps): React.JSX.Element {
	const peers = useSubscription(trpc.link.watchPeers.subscriptionOptions())
	const peer = peers.data?.find((p) => p.id === peerId)

	const query = useQuery(trpc.link.remotePages.queryOptions({ peerId }, { refetchInterval: PAGES_REFRESH_MS }))
	const result = query.data
	const pageIds = useMemo(() => (result?.ok ? result.pages.map((page) => String(page.pageNumber)) : []), [result])

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
					<span title={peer?.fingerprint}>{peer?.name ?? peerId}</span>
				</div>

				{!result ? (
					<LoadingRetryOrError
						error={query.error}
						dataReady={false}
						doRetry={() => void query.refetch()}
						design="pulse"
					/>
				) : !result.ok ? (
					<StaticAlert color="warning">{PAGES_ERRORS[result.error]}</StaticAlert>
				) : (
					<>
						<p className="presets-intro">Drag a button onto the grid, to show it there and press it from there.</p>
						<div className="collapsible-tree presets-sections-tree">
							{result.pages.map((page) => (
								<LinkPresetPage key={page.pageNumber} peerId={peerId} page={page} gridSize={result.gridSize} />
							))}
						</div>
					</>
				)}
			</ButtonsSidebarSection>
		</PanelCollapseHelperProvider>
	)
}

interface LinkPresetPageProps {
	peerId: string
	page: LinkRemotePage
	gridSize: UserConfigGridSize
}

/** A page of another installation, laid out as its grid is, so that its buttons are where they are there */
function LinkPresetPage({ peerId, page, gridSize }: LinkPresetPageProps) {
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
						<div key={key} className="presets-link-empty" />
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
						// As many columns as the page has, shrinking to fit rather than wrapping
						style={{ gridTemplateColumns: `repeat(${gridSize.maxColumn - gridSize.minColumn + 1}, minmax(0, 72px))` }}
					>
						{cells}
					</div>
				</div>
			)}
		</>
	)
}

function RemoteButtonPreview({ peerId, location }: { peerId: string; location: ControlLocation }) {
	const { pageNumber, row, column } = location
	const dragData: PresetDragItem = { kind: 'link', peerId, location }
	const { ref: drag, isDragSource } = useDraggable<PresetDragItem>({
		id: `link-preset:${peerId}:${pageNumber}/${row}/${column}`,
		type: 'preset',
		data: dragData,
		plugins: PRESET_FEEDBACK_PLUGINS,
	})

	const sub = useSubscription(trpc.link.watchRemoteButton.subscriptionOptions({ peerId, location }))

	return (
		<ButtonPreviewBase
			dragRef={drag}
			className={isDragSource ? 'preset-drag-source' : undefined}
			title={`${pageNumber}/${row}/${column}`}
			preview={sub.error ? RedImage : sub.data}
		/>
	)
}
