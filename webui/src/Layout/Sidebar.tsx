import './Sidebar.css'
import { Popover as BasePopover } from '@base-ui/react/popover'
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons'
import {
	faArrowsDownToLine,
	faCheck,
	faChevronRight,
	faClipboardList,
	faClock,
	faCloud,
	faExternalLinkSquare,
	faFileImport,
	faGamepad,
	faImages,
	faInfo,
	faMagnifyingGlass,
	faPlug,
	faPuzzlePiece,
	faStar,
	faTableCells,
	faTabletScreenButton,
	faWandMagicSparkles,
	type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, useLocation } from '@tanstack/react-router'
import classNames from 'classnames'
import {
	createContext,
	memo,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type HTMLAttributes,
	type MouseEventHandler,
	type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import { Transition } from 'react-transition-group'
import { PopoverActionMenu, type MenuActionItemProps, type MenuItemProps } from '~/Components/ActionMenu.js'
import { ContextMenu } from '~/Components/ContextMenu'
import { Popover } from '~/Components/Popover.js'
import { Tooltip } from '~/Components/Tooltip.js'
import { useContextMenuState } from '~/Components/useContextMenuProps'
import { useMobileMode } from '~/Hooks/useLayoutMode'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ConnectionsTabNotifyIcon, SurfacesTabNotifyIcon } from '~/Surfaces/TabNotifyIcon.js'
import { commandPaletteOpen } from './CommandPaletteState.js'
import { SETTINGS_SECTION, VARIABLES_SECTION, type NavSection } from './navRegistry.js'
import { SidebarFooter, SidebarHeader } from './SidebarHeader'
import { useCompanionVersion } from './useCompanionVersion'

function foldableIcon(foldable: boolean): ReactElement {
	return <FontAwesomeIcon icon={faArrowsDownToLine} style={{ rotate: foldable ? '-90deg' : '90deg' }} />
}
export interface SidebarStateProps {
	mobileMode: boolean
	handleShowSidebar: () => void
	handleHideSidebar: () => void
	showSidebarEvent: EventTarget
}
const SidebarStateContext = createContext<SidebarStateProps | null>(null)
const NarrowModeContext = createContext(false) // used locally for labelling: true if in narrow mode

const defaultSidebarState: SidebarStateProps = {
	mobileMode: false,
	handleShowSidebar: () => {},
	handleHideSidebar: () => {},
	showSidebarEvent: new EventTarget(),
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarState(): SidebarStateProps {
	const props = useContext(SidebarStateContext)
	return props ?? defaultSidebarState
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
			handleHideSidebar: () => {
				event.dispatchEvent(new Event('hide'))
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
 * NarrowModePopover - creates a "tooltip" showing the label text in narrow mode; otherwise is a no-op.
 * @param label - the tooltip text
 */
function NarrowModePopover({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
	const isNarrow = useContext(NarrowModeContext)
	if (!isNarrow) return <>{children}</>

	return (
		<Tooltip.Root>
			<Tooltip.Trigger render={children as React.ReactElement} delay={100} closeDelay={100} />
			<Tooltip.Popup side="right" arrow noPadding>
				{title}
			</Tooltip.Popup>
		</Tooltip.Root>
	)
}

/** Apple keyboards use ⌘ for the command palette shortcut; everything else uses Ctrl. */
const IS_APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

function SidebarSearchButton() {
	const isNarrow = useContext(NarrowModeContext)

	const openSearch = () => {
		commandPaletteOpen.set(true)
	}

	const shortcutLabel = IS_APPLE_PLATFORM ? '⌘K' : 'Ctrl+K'

	return (
		<div className="px-3 py-1.5 list-none">
			<button
				type="button"
				onClick={openSearch}
				title={`Search or Jump to... (${shortcutLabel})`}
				className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-surface-muted/70 hover:bg-surface-muted text-muted hover:text-body border border-border/70 text-xs transition-colors cursor-pointer text-left"
			>
				<div className="flex items-center gap-2 min-w-0">
					<FontAwesomeIcon icon={faMagnifyingGlass} className="text-2xs" />
					{!isNarrow && <span className="truncate">Search or jump...</span>}
				</div>
				{!isNarrow && (
					<span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-3xs font-mono font-medium text-zinc-400 bg-black/25 border border-white/10 rounded leading-none">
						{shortcutLabel}
					</span>
				)}
			</button>
		</div>
	)
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

			<span className="flex-auto truncate full-label">
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

	// const groupCtx = useContext(SidebarGroupContext)
	// Ensure the active link is visible
	// TODO: this is a bit flawed, it doesn't allow the current group to be collapsed
	// Maybe it could be hooked into the router so that it only changes when entering/leaving the group..
	// useEffect(() => {
	// 	if (active && groupCtx) groupCtx.setGroupVisible()
	// }, [active, groupCtx])

	// note: NarrowModePopover must wrap CNavLink directly to get a ref-forwarding component. It didn't work with CNavItem
	return (
		<li className={item.subheading ? 'nav-two-line' : undefined} onContextMenu={blockPropagation}>
			<NarrowModePopover title={item.title || item.name}>
				{item.path ? (
					<Link
						className="nav-link"
						to={item.path}
						target={item.target}
						onClick={onClick2}
						title={isNarrow ? undefined : item.title /* In narrow mode we put the title in the popover */}
					>
						<SidebarMenuItemLabel {...item} />
					</Link>
				) : (
					<a className="nav-link cursor-pointer" onClick={onClick2} title={isNarrow ? undefined : item.title}>
						<SidebarMenuItemLabel {...item} />
					</a>
				)}
			</NarrowModePopover>
		</li>
	)
}

// const SidebarGroupContext = createContext<{
// 	setGroupVisible: () => void
// }>({
// 	setGroupVisible: () => {},
// })

function HelpSidebarMenuItem() {
	const { whatsNewModal, notifier, wizardOpen } = useContext(RootAppStoreContext)
	const whatsNewOpen = useCallback(() => whatsNewModal.current?.show(), [whatsNewModal])
	const openWizard = useCallback(() => wizardOpen.set(true), [wizardOpen])

	const { versionName, versionBuild, os, browser } = useCompanionVersion(true)
	const sysinfo = useMemo(() => {
		let version = versionName || 'version unknown'
		let versionPlus = 'Companion: ' + version
		if (versionBuild) {
			version += '\n' + versionBuild
			versionPlus += ' ' + versionBuild
		}
		versionPlus += `\nOS: ${os}\nBrowser: ${browser}\n`
		return { version, versionPlus }
	}, [versionName, versionBuild, os, browser])

	const copyVersionToClipboard = useMemo(
		(): MenuActionItemProps['copyToClipboard'] => ({
			text: sysinfo.versionPlus,
			onCopy: (_text, result) => {
				const success = 'Version info copied!'
				const failure = 'Failed to copy version-string to the clipboard'
				notifier.show('', result ? success : failure, 1000)
			},
		}),
		[sysinfo, notifier]
	)

	const helpMenuItems: MenuItemProps[] = useMemo(
		() => [
			{
				id: 'user-guide',
				label: 'User Guide / Help',
				icon: faInfo,
				href: makeAbsolutePath('/user-guide/'),
				tooltip: 'Open the User Guide in a new tab.',
				inNewTab: true,
			},
			{
				id: 'setup-wizard',
				label: 'Getting Started Wizard',
				icon: faWandMagicSparkles,
				do: openWizard,
				tooltip: 'Open the initial setup and configuration wizard.',
				inNewTab: false,
			},
			{
				id: 'whats-new',
				label: "What's New",
				icon: faStar,
				do: whatsNewOpen,
				tooltip: 'Show the current release notes.',
				inNewTab: false,
			},
			{
				id: 'version',
				label: sysinfo.version,
				fullWidth: true,
				do: () => {},
				tooltip: 'Click to copy version info including OS and browser to the clipboard.',
				copyToClipboard: copyVersionToClipboard,
			},
		],
		[copyVersionToClipboard, openWizard, sysinfo, whatsNewOpen]
	)

	return (
		<li onContextMenu={blockPropagation}>
			<Popover.Root>
				<NarrowModePopover title="Help and Version Information">
					<BasePopover.Trigger
						render={
							<a className="nav-link cursor-pointer">
								<SidebarMenuItemLabel name="Help" icon={faCircleQuestion} />
							</a>
						}
					/>
				</NarrowModePopover>
				<Popover.Popup side="right" align="center" sideOffset={12}>
					<PopoverActionMenu menuItems={helpMenuItems} />
				</Popover.Popup>
			</Popover.Root>
		</li>
	)
}

interface SidebarSubMenuItemProps {
	name: string
	path: string
	target?: string
}

function SidebarSubMenuItem({ name, path, target }: SidebarSubMenuItemProps) {
	return (
		<li>
			<Link className="nav-link nav-sub-link" to={path} target={target} activeOptions={{ exact: true }}>
				<span className="nav-sub-dot" />
				{name}
				{target === '_blank' && <FontAwesomeIcon icon={faExternalLinkSquare} className="ms-1 full-label" />}
			</Link>
		</li>
	)
}

/** A nav group whose sub-items are a section of the shared nav registry. */
function SidebarSectionNavGroup({ section }: { section: NavSection }) {
	return (
		<SidebarNavGroup
			name={section.label}
			icon={section.icon}
			basePaths={section.pages.flatMap((page) => [page.path, ...(page.alsoMatches ?? [])])}
		>
			{section.pages.map((page) => (
				<SidebarSubMenuItem key={page.id} name={page.shortLabel ?? page.label} path={page.path} />
			))}
		</SidebarNavGroup>
	)
}

interface SidebarNavGroupProps {
	name: string
	icon: IconDefinition
	basePaths: readonly string[]
	children: React.ReactNode
}

function SidebarNavGroup({ name, icon, basePaths, children }: SidebarNavGroupProps) {
	const isNarrow = useContext(NarrowModeContext)
	const { pathname } = useLocation()
	const isGroupActive = basePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
	const [isOpen, setIsOpen] = useState(isGroupActive)

	useEffect(() => {
		if (isGroupActive) {
			setIsOpen(true)
		}
	}, [isGroupActive])

	const toggleOpen = (e: React.MouseEvent) => {
		e.preventDefault()
		setIsOpen((val) => !val)
	}

	if (isNarrow) {
		return (
			<li className="nav-group-wrapper" onContextMenu={blockPropagation}>
				<Popover.Root>
					<BasePopover.Trigger
						render={
							<a
								className={classNames('nav-link cursor-pointer nav-group-toggle', {
									active: isGroupActive,
								})}
							>
								<SidebarMenuItemLabel name={name} icon={icon} />
							</a>
						}
					/>
					<Popover.Popup side="right" align="center" sideOffset={12}>
						<div className="sidebar-popover-menu">
							<span className="text-3xs uppercase font-bold text-zinc-500 px-2.5 py-1 mb-1.5 select-none">{name}</span>
							<ul className="sidebar-popover-list">{children}</ul>
						</div>
					</Popover.Popup>
				</Popover.Root>
			</li>
		)
	}

	return (
		<li className="nav-group-wrapper" onContextMenu={blockPropagation}>
			<NarrowModePopover title={name}>
				<button
					type="button"
					aria-expanded={isOpen}
					className={classNames('nav-link cursor-pointer nav-group-toggle', {
						active: isGroupActive,
						open: isOpen,
					})}
					onClick={toggleOpen}
				>
					<SidebarMenuItemLabel name={name} icon={icon} />
					<FontAwesomeIcon
						icon={faChevronRight}
						className={classNames('ms-auto w-3 h-3 transition-transform duration-200', {
							'rotate-90': isOpen,
						})}
					/>
				</button>
			</NarrowModePopover>
			{isOpen && <ul className="nav-sub-list">{children}</ul>}
		</li>
	)
}

export const MySidebar = memo(function MySidebar() {
	// unfold-able, not un-foldable! Unfortunately "unfoldable" is CoreUI terminology, so probably shouldn't be changed.
	const [unfoldable, setUnfoldable] = useLocalStorage('sidebar_foldable', false)
	const [narrowMode, setNarrowMode] = useLocalStorage('sidebar_narrow_mode', false)
	const { mobileMode, handleHideSidebar } = useSidebarState()

	// tempNarrow is used in unfoldable mode to make it temporarily narrow on click, so it is independent of narrowMode
	const [tempNarrow, setTempNarrow] = useState(false)

	const toggleUnfoldable = useCallback(() => {
		setUnfoldable((val) => {
			// enabling folding → fold now; disabling folding → unfold now
			setTempNarrow(!val)
			return !val
		})
	}, [setUnfoldable])

	const toggleNarrowMode = useCallback(() => {
		setNarrowMode((val) => {
			if (!val) setTempNarrow(false) // so sidebar unfolds when we later turn narrowMode off
			return !val
		})
	}, [setNarrowMode])

	const contextMenuItems: MenuItemProps[] = useMemo(
		() => [
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
		[mobileMode, narrowMode, unfoldable, toggleUnfoldable, toggleNarrowMode]
	)

	// we need the following primarily to provide the onContextMenu callback, which resides in the parent, not the component.
	const contextState = useContextMenuState(contextMenuItems)
	const DontSetOrUnset: React.Dispatch<React.SetStateAction<boolean>> = () => {}

	return (
		<NarrowModeContext.Provider value={tempNarrow || narrowMode}>
			<SidebarRoot
				unfoldable={unfoldable}
				narrow={tempNarrow || narrowMode}
				setNarrow={narrowMode ? DontSetOrUnset : setTempNarrow}
				onContextMenu={contextState.onContextMenu}
			>
				<ContextMenu {...contextState} />
				<SidebarHeader />

				<SidebarSearchButton />

				<ul className="sidebar-nav nav-main-scroller">
					{/* Category: Program */}
					<li className="nav-title">Program</li>
					<SidebarMenuItem name="Buttons" icon={faTableCells} path="/buttons" />
					<SidebarMenuItem name="Triggers" icon={faClock} path="/triggers" />
					<SidebarSectionNavGroup section={VARIABLES_SECTION} />
					<SidebarMenuItem name="Image Library" icon={faImages} path="/image-library" />

					{/* Category: Connect */}
					<li className="nav-title">Connect</li>
					<SidebarMenuItem
						name="Connections"
						icon={faPlug}
						notifications={ConnectionsTabNotifyIcon}
						path="/connections"
					/>
					<SidebarMenuItem name="Surfaces" icon={faGamepad} notifications={SurfacesTabNotifyIcon} path="/surfaces" />
					<SidebarMenuItem name="Modules" icon={faPuzzlePiece} path="/modules" />
					<SidebarNavGroup name="Interactive Buttons" icon={faTabletScreenButton} basePaths={['/interactive-buttons']}>
						<SidebarSubMenuItem name="Emulator" path="/emulator" target="_blank" />
						<SidebarSubMenuItem name="Web Buttons" path="/tablet" target="_blank" />
					</SidebarNavGroup>

					{/* Category: System */}
					<li className="nav-title">System</li>
					<SidebarMenuItem name="Log" icon={faClipboardList} path="/log" />
					<SidebarSectionNavGroup section={SETTINGS_SECTION} />
					<SidebarMenuItem name="Import / Export" icon={faFileImport} path="/import-export" />
					<HelpSidebarMenuItem />
					{window.localStorage.getItem('show_companion_cloud') === '1' && (
						<SidebarMenuItem name="Cloud" icon={faCloud} path="/cloud" />
					)}
				</ul>
				<div className="sidebar-bottom-shadow-container">
					<div className="sidebar-bottom-shadow" />
				</div>
				<SidebarFooter
					onContextMenu={contextState.onContextMenu}
					onToggleNarrow={toggleNarrowMode}
					isNarrow={narrowMode}
					mobileMode={mobileMode}
					onCloseMobile={handleHideSidebar}
				/>
			</SidebarRoot>
		</NarrowModeContext.Provider>
	)
})

/**
 * This is a stripped down copy of CSidebar from coreui-react.
 * Since changing the sidebar, it no longer makes sense to be able to hide it entirely,
 * but coreui doesn't give us the tools to use the toggling behaviour on mobile and avoid allowing it to be hidden on desktop.
 * There was also a bug on mobile where it took 2 clicks to show, because we are maintaining a boolean state, which it was not updating.
 */
interface SidebarRootProps {
	/**
	 * Expand narrowed sidebar on hover.
	 */
	unfoldable?: boolean
	narrow: boolean
	setNarrow: React.Dispatch<React.SetStateAction<boolean>>
	onContextMenu: MouseEventHandler<HTMLDivElement>
}
function SidebarRoot({
	children,
	unfoldable,
	narrow,
	setNarrow,
	onContextMenu,
}: React.PropsWithChildren<SidebarRootProps>) {
	const sidebarRef = useRef<HTMLDivElement>(null)

	const [visibleMobile, setVisibleMobile] = useState<boolean>(false)

	const { showSidebarEvent: toggleEvent, mobileMode } = useSidebarState()

	// handle the "hamburger" to show the sidebar in mobile mode
	useEffect(() => {
		const event = toggleEvent
		const showHandler = () => {
			setVisibleMobile(true)
		}
		const hideHandler = () => {
			setVisibleMobile(false)
		}
		event.addEventListener('show', showHandler)
		event.addEventListener('hide', hideHandler)

		return () => {
			event.removeEventListener('show', showHandler)
			event.removeEventListener('hide', hideHandler)
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

			if (target.closest('.block-collapse')) return // ignore clicks on certain elements

			// The footer toggler only opens the context menu now; folding is toggled from there (see toggleUnfoldable).
			if (target.closest('.sidebar-footer2')) return

			// If the user clicked on the text of a sidebar "button", it's not a nav-link so we need to
			// search up the DOM for a nav-link to capture all possibilities.
			const navLink = target.closest('.nav-link')
			const navGroupToggle = navLink?.closest('.nav-group-toggle')
			if (!navLink || navGroupToggle) return // only act for click on sidebar elements (excludes the context-menu, blank areas,...)

			// if we got here the user clicked on a nav-link, not a non-active area, group-toggle or context-menu item
			if (mobileMode) {
				// Mobile mode ("hamburger" toggle reveals sidebar; click on item hides sidebar)
				setVisibleMobile(false)
			} else if (unfoldable) {
				// In folding mode, clicking a nav-link makes the sidebar temporarily narrow so it folds after the click.
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
				className={classNames('sidebar sidebar-fixed', {
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
				onMouseLeave={handleMouseLeave}
				onContextMenu={onContextMenu}
			>
				{children}
			</div>
			{typeof window !== 'undefined' &&
				mobileMode &&
				createPortal(<Backdrop className="sidebar-backdrop" visible={mobileMode && visibleMobile} />, document.body)}
		</>
	)
}

interface BackdropProps extends HTMLAttributes<HTMLDivElement> {
	/**
	 * A string of all className you want applied to the base component.
	 */
	className?: string
	/**
	 * Toggle the visibility of modal component.
	 */
	visible?: boolean
}

function Backdrop({ className = 'modal-backdrop', visible, ...rest }: BackdropProps) {
	const backdropRef = useRef<HTMLDivElement>(null)

	return (
		<Transition in={visible} mountOnEnter nodeRef={backdropRef} timeout={150} unmountOnExit>
			{(state) => (
				<div
					className={classNames(className, 'fade', {
						show: state === 'entered',
					})}
					{...rest}
					ref={backdropRef}
				/>
			)}
		</Transition>
	)
}

const blockPropagation = (e: React.MouseEvent) => {
	e.stopPropagation()
}
