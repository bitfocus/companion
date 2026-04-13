import {
	createContext,
	memo,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
	type MouseEventHandler,
	type ReactElement,
} from 'react'
import { CSidebarNav, CNavItem, CNavLink, CSidebarBrand, CSidebarHeader, CBackdrop, CPopover } from '@coreui/react'
import {
	type IconDefinition,
	faFileImport,
	faCheck,
	faCog,
	faClipboardList,
	faCloud,
	faTableCells,
	faClock,
	faPlug,
	faDollarSign,
	faGamepad,
	faExternalLinkSquare,
	faHeadset,
	faSquareCaretRight,
	faPeopleArrows,
	faPuzzlePiece,
	faInfo,
	faStar,
	faToolbox,
	faHatWizard,
	faSquareRootVariable,
	faArrowsUpToLine,
	faArrowsDownToLine,
	faNetworkWired,
	faFloppyDisk,
	faHammer,
	faScrewdriver,
	faTable,
	faTabletScreenButton,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGithub, faFacebook, faSlack } from '@fortawesome/free-brands-svg-icons'
import { ConnectionsTabNotifyIcon, SurfacesTabNotifyIcon } from '~/Surfaces/TabNotifyIcon.js'
import { createPortal } from 'react-dom'
import classNames from 'classnames'
import { useLocalStorage } from 'usehooks-ts'
import { Link, useMatchRoute } from '@tanstack/react-router'
import { Transition } from 'react-transition-group'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useSortedConnectionsThatHaveVariables, type ClientConnectionConfigWithId } from '~/Stores/Util.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { useCompanionVersion } from './useCompanionVersion'
import type { ConnectionCollection } from '@companion-app/shared/Model/Connections.js'
import { ContextMenu } from '~/Components/ContextMenu'
import { useContextMenuState, MenuSeparator } from '~/Components/useContextMenuProps'
import { type MenuItemProps } from '~/Components/ActionMenu'
import { useMobileMode } from '~/Hooks/useLayoutMode'

function foldableIcon(foldable: boolean): ReactElement {
	return <FontAwesomeIcon icon={faArrowsDownToLine} style={{ rotate: foldable ? '-90deg' : '90deg' }} />
}
export interface SidebarStateProps {
	mobileMode: boolean
	handleShowSidebar: () => void
	showSidebarEvent: EventTarget
}
const SidebarStateContext = createContext<SidebarStateProps | null>(null)
const NarrowModeContext = createContext(false) // used locally for labelling: true if in narrow mode

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarState(): SidebarStateProps {
	const props = useContext(SidebarStateContext)
	if (!props) throw new Error('Not inside a SidebarStateContext!')
	return props
}

export function SidebarStateProvider({ children }: React.PropsWithChildren): React.ReactNode {
	const mobileMode = useMobileMode()

	const event = useMemo(() => new EventTarget(), [])

	const value = useMemo(() => {
		return {
			mobileMode: mobileMode,
			// the next two are for the hamburger toggle
			handleShowSidebar: () => {
				event.dispatchEvent(new Event('show'))
			},
			showSidebarEvent: event,
		} satisfies SidebarStateProps
	}, [mobileMode, event])

	return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>
}

interface SidebarMenuItemProps {
	name: string
	subheading?: string
	icon: IconDefinition | null | 'empty'
	notifications?: React.ComponentType<Record<string, never>>
	path?: string
	activePath?: string
	onClick?: () => void
	target?: string
	title?: string
}

/**
 * NarrowModePopover - creates a CPopover "tooltip" showing the label text in narrow mode; otherwise is a no-op.
 * @param label - the tooltip text
 */
function NarrowModePopover({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
	const isNarrow = useContext(NarrowModeContext)
	if (isNarrow) {
		// CPopover defaulted to black-on-black text. Also override the default padding defined in App.scss
		const customVars = {
			'--cui-popover-body-color': 'white',
			'--cui-popover-bg': '#111',
			'--cui-popover-body-padding-y': '.5rem',
		} as React.CSSProperties

		return (
			<CPopover
				style={customVars}
				content={<span>{title}</span>}
				trigger={['hover', 'focus']} // better for keyboard navigation and, possibly, screen readers.
				delay={{ show: 100, hide: 100 }}
				animation={false}
				placement="right"
			>
				{children}
			</CPopover>
		)
	} else {
		return <>{children}</>
	}
}

function SidebarMenuItemLabel(item: SidebarMenuItemProps) {
	return (
		<>
			<span className="nav-icon-wrapper">
				{item.icon === 'empty' ? (
					''
				) : item.icon ? (
					<FontAwesomeIcon className="nav-icon" icon={item.icon} />
				) : (
					<span className="nav-icon">
						<span className="nav-icon-bullet" />
					</span>
				)}
			</span>

			<span className="flex-fill text-truncate full-label">
				<span>{item.name}</span>
				{!!item.subheading && (
					<>
						<br />
						<small>{item.subheading}</small>
					</>
				)}
			</span>

			{item.target === '_blank' && <FontAwesomeIcon icon={faExternalLinkSquare} className="ms-1 full-label" />}
			{!!item.notifications && <item.notifications />}
		</>
	)
}

function SidebarMenuItem(item: SidebarMenuItemProps) {
	const isNarrow = useContext(NarrowModeContext)
	const onClick2 = (e: React.MouseEvent) => {
		if (!item.onClick) return
		e.preventDefault()
		item.onClick()
	}
	// note: NarrowModePopover must wrap CNavLink directly to get a ref-forwarding component. It didn't work with CNavItem
	return (
		<CNavItem idx={item.path ?? item.name} className={item.subheading ? 'nav-two-line' : undefined}>
			<NarrowModePopover title={item.title || item.name}>
				{item.path ? (
					<CNavLink
						to={item.path}
						target={item.target}
						as={Link}
						onClick={onClick2}
						title={isNarrow ? undefined : item.title /* In narrow mode we put the title in the popover */}
					>
						<SidebarMenuItemLabel {...item} />
					</CNavLink>
				) : (
					<CNavLink onClick={onClick2} style={{ cursor: 'pointer' }} title={isNarrow ? undefined : item.title}>
						<SidebarMenuItemLabel {...item} />
					</CNavLink>
				)}
			</NarrowModePopover>
		</CNavItem>
	)
}

interface SidebarMenuItemGroupProps extends SidebarMenuItemProps {
	children?: React.ReactNode
	groupVisible: boolean
	groupSetVisible: (val: boolean) => void
}

function SidebarMenuItemGroup(item: SidebarMenuItemGroupProps) {
	return (
		<CNavGroup
			toggler={<SidebarMenuItemLabel {...item} />}
			title={item.title || item.name + ' group'}
			to={item.path}
			activePath={item.activePath}
			visible={item.groupVisible}
			setVisible={item.groupSetVisible}
		>
			{item.children}
		</CNavGroup>
	)
}

export const MySidebar = memo(function MySidebar() {
	const { whatsNewModal, showWizard } = useContext(RootAppStoreContext)
	// unfold-able, not un-foldable! Unfortunately "unfoldable" is CoreUI terminology, so probably shouldn't be changed.
	const [unfoldable, setUnfoldable] = useLocalStorage('sidebar_foldable', false)
	const [narrowMode, setNarrowMode] = useLocalStorage('sidebar_narrow_mode', false)
	const { mobileMode } = useSidebarState()

	const [hideHelp, setHideHelp] = useLocalStorage('hide_sidebar_help', false)
	const showHelpButtons = !hideHelp
	const [hideModuleVars, setHideModuleVars] = useLocalStorage('hide_sidebar_module_vars', false)
	const [accordionMode, setAccordionMode] = useLocalStorage('sidebar_auto_collapse', false)
	// tempNarrow is used in unfoldable mode to make it temporarily narrow on click, so it is independent of narrowMode
	const [tempNarrow, setTempNarrow] = useState(false)

	const [surfacesGroupVis, setSurfacesGroupVis] = useLocalStorage('surface_group_vis', false)
	const [variablesGroupVis, setVariablesGroupVis] = useLocalStorage('variables_group_vis', false)
	const [settingsGroupVis, setSettingsGroupVis] = useLocalStorage('settings_group_vis', false)
	const [ibuttonsGroupVis, setIbuttonsGroupVis] = useLocalStorage('ibuttons_group_vis', false)
	const [supportGroupVis, setSupportGroupVis] = useLocalStorage('support_group_vis', false)

	const toggleUnfoldable = useCallback(() => {
		setUnfoldable((val) => {
			if (!val) setTempNarrow(true) // if new value is true, make sidebar narrow so it folds now
			return !val
		})
	}, [setUnfoldable])

	const toggleNarrowMode = useCallback(() => {
		setNarrowMode((val) => {
			if (!val) setTempNarrow(false) // so sidebar unfolds when we later turn narrowMode off
			return !val
		})
	}, [setNarrowMode])

	const whatsNewOpen = useCallback(() => whatsNewModal.current?.show(), [whatsNewModal])

	const expandAllGroups = useCallback(
		(expand: boolean) => {
			const setGroupFns = [
				setSurfacesGroupVis,
				setVariablesGroupVis,
				setSettingsGroupVis,
				setIbuttonsGroupVis,
				setSupportGroupVis,
			]
			for (const setVis of setGroupFns) setVis(expand)
		},
		[setSurfacesGroupVis, setVariablesGroupVis, setSettingsGroupVis, setIbuttonsGroupVis, setSupportGroupVis]
	)

	const smartExpand = useCallback(
		(setter: (val: boolean) => void, expand: boolean) => {
			if (accordionMode && expand) expandAllGroups(false)
			setter(expand)
		},
		[accordionMode, expandAllGroups]
	)

	// note: the context menu has to be defined inside the component to use the internal states as well as `whatsNewOpen` which is a useCallback
	const contextMenuItems: MenuItemProps[] = useMemo(
		() => [
			{
				id: 'collapse-all',
				label: 'Collapse All Groups',
				do: () => expandAllGroups(false),
				tooltip: 'Collapse all top-level groups in the sidebar.',
			},
			{
				// not sure this is useful
				id: 'expand-all',
				label: 'Expand All Groups',
				do: () => {
					expandAllGroups(true)
					setAccordionMode(false)
				},
				tooltip: 'Expand all top-level groups in the sidebar. (Tip: this works best with the sidebar-help hidden.)',
			},
			{
				id: 'accordion-mode',
				label: 'Auto-Collapse Groups',
				icon: accordionMode ? faCheck : undefined,
				do: () => setAccordionMode((value) => !value),
				tooltip:
					'Allow only one top-level group to be expanded at a time: opening one top-level group closes all others.',
			},
			MenuSeparator,
			{
				id: 'hide-module-vars',
				label: hideModuleVars ? 'Show Module Variables' : 'Hide Module Variables',
				icon: faDollarSign,
				do: () => setHideModuleVars((value) => !value),
				tooltip:
					'Toggle whether to show individual modules in the sidebar Variables group. They are always accessible from the main Variables page.',
			},
			{
				id: 'hide-help',
				label: hideHelp ? 'Show Sidebar Help' : 'Hide Sidebar Help',
				icon: hideHelp ? faArrowsUpToLine : faArrowsDownToLine,
				do: () => setHideHelp((value) => !value),
				tooltip: 'Free up some space: the help items are available from the help menu in the top-right corner.',
			},
			MenuSeparator,
			...(mobileMode || narrowMode
				? []
				: [
						{
							id: 'hide-sidebar',
							label: unfoldable ? 'Full-width Sidebar' : 'Folding Sidebar',
							icon: () => foldableIcon(unfoldable),
							do: toggleUnfoldable,
							tooltip:
								'Toggle between a static, fixed-width sidebar and dynamic-width sidebar that expands when the mouse is over it.',
						},
					]),
			{
				id: 'narrow-sidebar',
				label: 'Keep Sidebar Folded',
				icon: narrowMode ? faCheck : undefined,
				do: toggleNarrowMode,
				tooltip: 'When active, the sidebar remains narrow.',
			},
		],
		[
			accordionMode,
			mobileMode,
			narrowMode,
			unfoldable,
			toggleUnfoldable,
			toggleNarrowMode,
			hideModuleVars,
			hideHelp,
			expandAllGroups,
			setAccordionMode,
			setHideModuleVars,
			setHideHelp,
		]
	)

	// we need the following primarily to provide the onContextMenu callback, which resides in the parent, not the component.
	const contextState = useContextMenuState(contextMenuItems)
	const DontSetOrUnset: React.Dispatch<React.SetStateAction<boolean>> = () => {}

	return (
		<NarrowModeContext.Provider value={tempNarrow || narrowMode}>
			<CSidebar
				unfoldable={unfoldable}
				narrow={tempNarrow || narrowMode}
				setNarrow={narrowMode ? DontSetOrUnset : setTempNarrow}
				onContextMenu={contextState.onContextMenu}
			>
				<ContextMenu {...contextState} />
				<CSidebarHeader className="brand">
					<CSidebarBrand>
						<div className="sidebar-brand-full">
							<img src={makeAbsolutePath('/img/icons/48x48.png')} height="30" alt="logo" />
							&nbsp; Bitfocus&nbsp;
							<span style={{ fontWeight: 'bold' }}>Companion</span>
						</div>
						<div className="sidebar-brand-narrow">
							<img src={makeAbsolutePath('/img/icons/48x48.png')} height="42px" alt="logo" />
						</div>
					</CSidebarBrand>
				</CSidebarHeader>
				<CSidebarNav className="nav-main-scroller">
					<SidebarMenuItem
						name="Connections"
						icon={faPlug}
						notifications={ConnectionsTabNotifyIcon}
						path="/connections"
					/>
					<SidebarMenuItem name="Buttons" icon={faTableCells} path="/buttons" />
					<SidebarMenuItemGroup
						name="Surfaces"
						icon={faGamepad}
						notifications={SurfacesTabNotifyIcon}
						path="/surfaces/configured"
						activePath="/surfaces"
						groupVisible={surfacesGroupVis}
						groupSetVisible={(expand) => smartExpand(setSurfacesGroupVis, expand)}
					>
						<SidebarMenuItem name="Remote" icon={faPeopleArrows} path="/surfaces/remote" />
					</SidebarMenuItemGroup>
					<SidebarMenuItem name="Triggers" icon={faClock} path="/triggers" />
					<SidebarMenuItemGroup
						name="Variables"
						icon={faDollarSign}
						path="/variables"
						groupVisible={variablesGroupVis}
						groupSetVisible={(expand) => smartExpand(setVariablesGroupVis, expand)}
					>
						<SidebarMenuItem name="Custom Variables" icon={faDollarSign} path="/variables/custom" />
						<SidebarMenuItem name="Expression Variables" icon={faSquareRootVariable} path="/variables/expression" />
						<SidebarMenuItem name="Internal" icon={faToolbox} path="/variables/connection/internal" />
						{!hideModuleVars && <SidebarVariablesGroups />}
					</SidebarMenuItemGroup>
					<SidebarMenuItem name="Modules" icon={faPuzzlePiece} path="/modules" />
					<SidebarMenuItemGroup
						name="Settings"
						icon={faCog}
						path="/settings"
						groupVisible={settingsGroupVis}
						groupSetVisible={(expand) => smartExpand(setSettingsGroupVis, expand)}
					>
						<SidebarMenuItem name="Configuration Wizard" icon={faHatWizard} onClick={showWizard} />
						<SidebarMenuItem name="General" icon={faScrewdriver} path="/settings/general" />
						<SidebarMenuItem name="Buttons" icon={faTableCells} path="/settings/buttons" />
						<SidebarMenuItem
							name="Surfaces"
							icon={faGamepad}
							path="/surfaces/configured/integrations"
							title="Surface settings have moved to the main Surfaces Page."
						/>
						<SidebarMenuItem name="Protocols" icon={faNetworkWired} path="/settings/protocols" />
						<SidebarMenuItem name="Backups" icon={faFloppyDisk} path="/settings/backups" />
						<SidebarMenuItem name="Advanced" icon={faHammer} path="/settings/advanced" />
					</SidebarMenuItemGroup>
					<SidebarMenuItem name="Import / Export" icon={faFileImport} path="/import-export" />
					<SidebarMenuItem name="Log" icon={faClipboardList} path="/log" />
					{window.localStorage.getItem('show_companion_cloud') === '1' && (
						<SidebarMenuItem name="Cloud" icon={faCloud} path="/cloud" />
					)}
					<SidebarMenuItemGroup
						name="Interactive Buttons"
						icon={faSquareCaretRight}
						groupVisible={ibuttonsGroupVis}
						groupSetVisible={(expand) => smartExpand(setIbuttonsGroupVis, expand)}
					>
						<SidebarMenuItem name="Emulator" icon={faTabletScreenButton} path="/emulator" target="_blank" />
						<SidebarMenuItem name="Web buttons" icon={faTable} path="/tablet" target="_blank" />
					</SidebarMenuItemGroup>
				</CSidebarNav>
				<div className="sidebar-bottom-shadow-container">
					<div className="sidebar-bottom-shadow" />
				</div>
				{showHelpButtons && (
					<CSidebarNav className="nav-secondary border-top">
						<SidebarMenuItem name="What's New" icon={faStar} onClick={whatsNewOpen} />
						<SidebarMenuItem name="User Guide" icon={faInfo} path="/user-guide/" target="_blank" />
						<SidebarMenuItemGroup
							name="Support"
							title="Support options (click to expand)."
							icon={faHeadset}
							groupVisible={supportGroupVis}
							groupSetVisible={(expand) => smartExpand(setSupportGroupVis, expand)}
						>
							<SidebarMenuItem
								name="Report an Issue"
								title="Report bugs or request features on GitHub."
								icon={faGithub}
								path="https://l.companion.free/q/QZbI6mdNd"
								target="_blank"
							/>
							<SidebarMenuItem
								name="Community Forum"
								title="Share your experience or ask questions to your Companions on Facebook."
								icon={faFacebook}
								path="https://l.companion.free/q/6pc9ciJR5"
								target="_blank"
							/>
							<SidebarMenuItem
								name="Slack Chat"
								title="Discuss technical issues on Slack."
								icon={faSlack}
								path="https://l.companion.free/q/OWxbBnDKG"
								target="_blank"
							/>
							<SidebarMenuItem
								name="Sponsor"
								title="Contribute funds to Bitfocus Companion."
								icon={faDollarSign}
								path="https://l.companion.free/q/6PtdAvZab"
								target="_blank"
							/>
						</SidebarMenuItemGroup>
					</CSidebarNav>
				)}
				{!narrowMode && (
					<CSidebarHeader className="border-top d-flex sidebar-header-toggler">
						<UnfoldTogglerAndVersion toggleUnfoldable={toggleUnfoldable} />
					</CSidebarHeader>
				)}
			</CSidebar>
		</NarrowModeContext.Provider>
	)
})

const SidebarVariablesGroups = observer(function SidebarVariablesGroups() {
	const { modules, connections } = useContext(RootAppStoreContext)

	const sortedConnections = useSortedConnectionsThatHaveVariables()

	// Group connections
	const { rootConnections, connectionsByCollection } = useMemo(() => {
		const root: ClientConnectionConfigWithId[] = []
		const byCol = new Map<string, ClientConnectionConfigWithId[]>()

		for (const conn of sortedConnections) {
			if (conn.collectionId) {
				const existing = byCol.get(conn.collectionId)
				if (existing) existing.push(conn)
				else byCol.set(conn.collectionId, [conn])
			} else {
				root.push(conn)
			}
		}
		return { rootConnections: root, connectionsByCollection: byCol }
	}, [sortedConnections])

	const renderConnection = (connectionInfo: ClientConnectionConfigWithId) => (
		<SidebarMenuItem
			key={connectionInfo.id}
			name={connectionInfo.label}
			subheading={modules.getModuleFriendlyName(connectionInfo.moduleType, connectionInfo.moduleId)}
			icon={null}
			path={`/variables/connection/${connectionInfo.label}`}
		/>
	)

	// Recursive render
	const renderCollection = (collection: ConnectionCollection): React.ReactNode => {
		const childConnections = connectionsByCollection.get(collection.id)

		const childCollectionsRendered = (collection.children || [])
			.slice()
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map((c) => renderCollection(c))
			.filter((c): c is NonNullable<typeof c> => !!c) // Filter nulls

		const hasChildren = (childConnections && childConnections.length > 0) || childCollectionsRendered.length > 0

		if (!hasChildren) return null

		return (
			<SidebarMenuItemSubGroup key={collection.id} name={collection.label} icon={null} path={undefined}>
				{childCollectionsRendered}
				{childConnections?.map(renderConnection)}
			</SidebarMenuItemSubGroup>
		)
	}

	return (
		<>
			{connections.rootCollections().map((c) => renderCollection(c))}
			{rootConnections.map(renderConnection)}
		</>
	)
})

interface SidebarMenuItemSubGroupProps extends SidebarMenuItemProps {
	children?: React.ReactNode
	// groupVisible: boolean
	// groupSetVisible: (val: boolean) => void
}

const SidebarMenuItemSubGroup = observer(function SidebarMenuItemSubGroup(props: SidebarMenuItemSubGroupProps) {
	// for the moment these won't be controlled by the context menu, which seems more appropriate anyway.
	const [visible, setVisible] = useState(true)

	return (
		<SidebarMenuItemGroup
			name={props.name}
			icon={props.icon}
			path={props.path}
			groupVisible={visible}
			groupSetVisible={setVisible}
		>
			{props.children}
		</SidebarMenuItemGroup>
	)
})

const UnfoldTogglerAndVersion = observer(function UnfoldTogglerAndVersion({
	toggleUnfoldable,
}: {
	toggleUnfoldable: () => void
}) {
	const { versionName, versionBuild: versionSubheading } = useCompanionVersion()
	const { mobileMode } = useSidebarState()

	return (
		<div className="nav-link sidebar-header-toggler2">
			<span className={classNames('nav-icon-wrapper', mobileMode ? 'd-none' : 'd-flex')} onClick={toggleUnfoldable}>
				<span className="nav-icon sidebar-toggler"></span>
			</span>

			<span className="flex-fill text-truncate">
				<span className="version">{versionName || 'Unknown'}</span>
				{/* <br /> */}
				<span className="version-sub">{versionSubheading}</span>
			</span>
		</div>
	)
})

/**
 * This is a stripped down copy of CSidebar from coreui-react.
 * Since changing the sidebar, it no longer makes sense to be able to hide it entirely,
 * but coreui doesn't give us the tools to use the toggling behaviour on mobile and avoid allowing it to be hidden on desktop.
 * There was also a bug on mobile where it took 2 clicks to show, because we are maintaining a boolean state, which it was not updating.
 */
interface CSidebarProps {
	/**
	 * Expand narrowed sidebar on hover.
	 */
	unfoldable?: boolean
	narrow: boolean
	setNarrow: React.Dispatch<React.SetStateAction<boolean>>
	onContextMenu?: MouseEventHandler<HTMLDivElement>
}
function CSidebar({ children, unfoldable, narrow, setNarrow, onContextMenu }: React.PropsWithChildren<CSidebarProps>) {
	const sidebarRef = useRef<HTMLDivElement>(null)

	const [visibleMobile, setVisibleMobile] = useState<boolean>(false)

	const { showSidebarEvent: toggleEvent, mobileMode } = useSidebarState()

	// handle the "hamburger" to show the sidebar in mobile mode
	useEffect(() => {
		const event = toggleEvent
		const handler = () => {
			setVisibleMobile(true)
		}
		event.addEventListener('show', handler)

		return () => {
			event.removeEventListener('show', handler)
		}
	}, [toggleEvent, setVisibleMobile])

	// default behavior in mobile mode: hide the sidebar
	useEffect(() => {
		if (mobileMode) setVisibleMobile(false)
	}, [mobileMode])

	// handle clicks in the sidebar for mobile mode and "unfolding" mode
	const handleOnClick = useCallback(
		(event: MouseEvent) => {
			const target = event.target
			// note: middle-click currently opens the nav-link target in a new tab, so it makes sense to close the sidebar in that case.
			// Only context-menu should leave the sidebar alone, since it is acting on the current sidebar, hence "event.button === 2".
			if (!(target instanceof Element) || event.button === 2) return // leave context menu alone (note button# is OS-independent)

			// If the user clicked on the text of a sidebar "button", it's not a nav-link so we need to
			// search up the DOM for a nav-link to capture all possibilities.
			const navLink = target.closest('.nav-link')
			const navGroupToggle = navLink?.closest('.nav-group-toggle')
			if (!navLink || navGroupToggle) return // only act for click on sidebar elements (excludes the context-menu, blank areas,...)

			// unfoldToggler: true if clicked in the "toggleFoldandVersion" area
			const unfoldToggler = target.closest('.sidebar-header-toggler') // the latter isn't strictly necessary, but makes the intent clear
			if (unfoldToggler && !target.closest('.nav-icon-wrapper')) return // ignore clicks on version text, etc.

			// if we got here the user clicked on a nav-link, not a non-active area, group-toggle or context-menu item
			if (mobileMode) {
				// Mobile mode ("hamburger" toggle reveals sidebar; click on item hides sidebar)
				setVisibleMobile(false)
			} else if ((unfoldable && !unfoldToggler) || (!unfoldable && unfoldToggler)) {
				// In folding mode make the sidebar temporarily narrow so it folds after the user clicks
				// note: we reverse the logic for clicks on the sidebar toggler, because the toggler will have flipped the state by the time this runs so:
				// unfoldable && !unfoldToggler: User clicked a _nav-link_ while in folding mode → collapse
				// !unfoldable && unfoldToggler: User clicked the _toggler_ to enable folding → collapse now
				setTimeout(() => setNarrow(true), 0) // we need to defer this action or navigation can fail due to an apparent race with re-rendering the sidebar.
			}
		},
		[setNarrow, mobileMode, unfoldable]
	)

	// if in "temporary narrow-mode" return to folding mode after the mouse leaves the sidebar
	// note that in "permanent" narrow-mode, setNarrow is passed as a no-op, so this callback is active only when not in narrow-mode
	const handleMouseLeave = useCallback(() => {
		if (narrow) setNarrow(false)
	}, [narrow, setNarrow])

	const handleKeyOrClickOutside = useCallback(
		(event: Event) => {
			if (mobileMode && sidebarRef.current && !sidebarRef.current.contains(event.target as HTMLElement)) {
				setVisibleMobile(false)
			}
		},
		[mobileMode, sidebarRef]
	)

	useEffect(() => {
		window.addEventListener('mouseup', handleKeyOrClickOutside)
		window.addEventListener('keyup', handleKeyOrClickOutside)

		const sideBarElement = sidebarRef.current

		sideBarElement?.addEventListener('mouseup', handleOnClick)

		return () => {
			window.removeEventListener('mouseup', handleKeyOrClickOutside)
			window.removeEventListener('keyup', handleKeyOrClickOutside)

			sideBarElement?.removeEventListener('mouseup', handleOnClick)
		}
	}, [sidebarRef, handleOnClick, handleKeyOrClickOutside])

	return (
		<>
			<div
				className={classNames('sidebar sidebar-dark sidebar-fixed', {
					// [`sidebar-${colorScheme}`]: colorScheme,
					'sidebar-narrow': narrow,
					//'no-transition-all': narrow, // optional, but this works only after very long transitions (modules page)
					// 'sidebar-overlaid': overlaid,
					// [`sidebar-${placement}`]: placement,
					// [`sidebar-${position}`]: position,
					// [`sidebar-${size}`]: size,
					'sidebar-narrow-unfoldable': unfoldable, // // unfold-able. This is a CoreUI class so can't be renamed for clarity.
					show: mobileMode && visibleMobile,
					// hide: visibleDesktop === false && !showToggle && !overlaid,
				})}
				ref={sidebarRef}
				onContextMenu={onContextMenu}
				onMouseLeave={handleMouseLeave}
			>
				{children}
			</div>
			{typeof window !== 'undefined' &&
				mobileMode &&
				createPortal(<CBackdrop className="sidebar-backdrop" visible={mobileMode && visibleMobile} />, document.body)}
		</>
	)
}

interface CNavGroupProps {
	to?: string
	activePath?: string

	/**
	 * A string of all className you want applied to the component.
	 */
	className?: string
	/**
	 * Make nav group more compact by cutting all `padding` in half.
	 */
	compact?: boolean
	/**
	 * Set group toggler label.
	 */
	toggler: ReactNode
	/**
	 * Set group toggler title (popover) in narrow mode.
	 */
	title: ReactNode

	/**
	 * Show nav group items.
	 */
	visible: boolean
	setVisible: (val: boolean) => void
}

/*
 * A variant of CNavGroup from coreui-react that allows for making the group item be a link
 */
function CNavGroup({
	children,
	to,
	activePath,
	className,
	compact,
	toggler,
	title,
	visible,
	setVisible,
	...rest
}: React.PropsWithChildren<CNavGroupProps>) {
	const [height, setHeight] = useState<number | string>()
	const navItemsRef = useRef<HTMLUListElement>(null)
	const matchRoute = useMatchRoute()
	//const [_visible, setVisible] = useState(Boolean(visible))

	const handleTogglerOnClick = (e: React.MouseEvent<HTMLElement>) => {
		//event.preventDefault() // don't do this now that the action is taking place on Link
		// and don't stop propagation, or it will prevent context-menus
		if (!(e.target instanceof Element)) return
		// if clicking on the caret, which is ::after, the target class will be it's "parent"
		// otherwise, clicking on the nav-link parts of the component, the target will be a child of nav-group-toggle
		if (
			e.target.classList.contains('nav-group-toggle') ||
			e.target.closest('.toggle-basic') ||
			(to && matchRoute({ to })) // note: the guard isn't strictly necessary since the previous condition implicitly excludes undefined `to`
		) {
			setVisible(!visible)
		} else {
			// open but don't close the group if clicking on a nav element. (Option: close if already on that element?)
			setVisible(true)
		}
	}

	const style: CSSProperties = {
		height: 0,
	}

	const onEntering = () => {
		if (navItemsRef.current) setHeight(navItemsRef.current.scrollHeight)
	}

	const onEntered = () => {
		setHeight('auto')
	}

	const onExit = () => {
		if (navItemsRef.current) setHeight(navItemsRef.current.scrollHeight)
	}

	const onExiting = () => {
		// @ts-expect-error reflow is necessary to get correct height of the element
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const reflow = navItemsRef.current?.offsetHeight
		setHeight(0)
	}

	const onExited = () => {
		setHeight(0)
	}

	const transitionStyles = {
		entering: { display: 'block', height: height },
		entered: { display: 'block', height: height },
		exiting: { height: height }, // adding display: block here causes it to bounce in narrow-moode when closing hides the scrollbar
		exited: { height: height },
		unmounted: {},
	}

	// note: we need nav-link on both the div and Link/span elements for the sidebar to format correctly
	// also note: the <div> around the toggler Link/span creates the split-button effect by placing the ::after caret
	// relative to the outer <div> rather than relative to the Link/span element.
	return (
		<li className={classNames('nav-group', { show: visible }, className)} {...rest}>
			<NarrowModePopover title={title}>
				<div className="nav-link nav-group-toggle" onClick={handleTogglerOnClick}>
					{to ? (
						<Link
							to={to}
							className={classNames('nav-link', {
								active: !!activePath && !!matchRoute({ to: activePath, fuzzy: true }),
							})}
						>
							{toggler}
						</Link>
					) : (
						<span className="nav-link toggle-basic">{toggler}</span>
					)}
				</div>
			</NarrowModePopover>
			<Transition
				in={visible}
				nodeRef={navItemsRef}
				onEntering={onEntering}
				onEntered={onEntered}
				onExit={onExit}
				onExiting={onExiting}
				onExited={onExited}
				timeout={300}
			>
				{(state) => (
					<ul
						className={classNames('nav-group-items', {
							compact: compact,
						})}
						style={{
							...style,
							...transitionStyles[state],
						}}
						ref={navItemsRef}
					>
						{children}
					</ul>
				)}
			</Transition>
		</li>
	)
}
