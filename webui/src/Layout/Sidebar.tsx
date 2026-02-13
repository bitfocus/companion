import React, {
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
} from 'react'
import { CSidebarNav, CNavItem, CNavLink, CSidebarBrand, CSidebarHeader, CBackdrop } from '@coreui/react'
import {
	type IconDefinition,
	faFileImport,
	faCog,
	faClipboardList,
	faCloud,
	faTh,
	faClock,
	faPlug,
	faDollarSign,
	faGamepad,
	faExternalLinkSquare,
	faHeadset,
	faBug,
	faUsers,
	faComments,
	faSquareCaretRight,
	faPuzzlePiece,
	faInfo,
	faStar,
	faHatWizard,
	faSquareRootVariable,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	SurfacesConfiguredTabNotifyIcon,
	ConnectionsTabNotifyIcon,
	SurfacesTabNotifyIcon,
	SurfacesInstancesTabNotifyIcon,
} from '~/Surfaces/TabNotifyIcon.js'
import { createPortal } from 'react-dom'
import classNames from 'classnames'
import { useLocalStorage, useMediaQuery } from 'usehooks-ts'
import { Link } from '@tanstack/react-router'
import { Transition } from 'react-transition-group'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useSortedConnectionsThatHaveVariables, type ClientConnectionConfigWithId } from '~/Stores/Util.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { trpc } from '~/Resources/TRPC'
import { useQuery } from '@tanstack/react-query'
import type { ConnectionCollection } from '@companion-app/shared/Model/Connections.js'

export interface SidebarStateProps {
	showToggle: boolean
	clickToggle: () => void
	toggleEvent: EventTarget
}
const SidebarStateContext = createContext<SidebarStateProps | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarState(): SidebarStateProps {
	const props = useContext(SidebarStateContext)
	if (!props) throw new Error('Not inside a SidebarStateContext!')
	return props
}

export function SidebarStateProvider({ children }: React.PropsWithChildren): React.ReactNode {
	const isOnMobile = useMediaQuery('(max-width: 991.98px)')

	const event = useMemo(() => new EventTarget(), [])

	const value = useMemo(() => {
		return {
			showToggle: isOnMobile,
			clickToggle: () => {
				event.dispatchEvent(new Event('show'))
			},
			toggleEvent: event,
		} satisfies SidebarStateProps
	}, [isOnMobile, event])

	return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>
}

interface SidebarMenuItemProps {
	name: string
	subheading?: string
	icon: IconDefinition | null | 'empty'
	notifications?: React.ComponentType<Record<string, never>>
	path?: string
	onClick?: () => void
	target?: string
	title?: string
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

			<span className="flex-fill text-truncate">
				<span>{item.name}</span>
				{!!item.subheading && (
					<>
						<br />
						<small>{item.subheading}</small>
					</>
				)}
			</span>

			{item.target === '_blank' && <FontAwesomeIcon icon={faExternalLinkSquare} className="ms-1" />}
			{!!item.notifications && <item.notifications />}
		</>
	)
}

function SidebarMenuItem(item: SidebarMenuItemProps) {
	const onClick2 = (e: React.MouseEvent) => {
		if (!item.onClick) return
		e.preventDefault()
		item.onClick()
	}
	return (
		<CNavItem idx={item.path ?? item.name} className={item.subheading ? 'nav-two-line' : undefined}>
			{item.path ? (
				<CNavLink to={item.path} target={item.target} as={Link} onClick={onClick2} title={item.title}>
					<SidebarMenuItemLabel {...item} />
				</CNavLink>
			) : (
				<CNavLink onClick={onClick2} style={{ cursor: 'pointer' }} title={item.title}>
					<SidebarMenuItemLabel {...item} />
				</CNavLink>
			)}
		</CNavItem>
	)
}

interface SidebarMenuItemGroupProps extends SidebarMenuItemProps {
	children?: React.ReactNode
}

function SidebarMenuItemGroup(item: SidebarMenuItemGroupProps) {
	return (
		<CNavGroup toggler={<SidebarMenuItemLabel {...item} />} to={item.path}>
			{item.children}
		</CNavGroup>
	)
}

export const MySidebar = memo(function MySidebar() {
	const { whatsNewModal, showWizard } = useContext(RootAppStoreContext)
	const [unfoldable, setUnfoldable] = useLocalStorage('sidebar-foldable', false)

	const doToggle = useCallback(() => setUnfoldable((val) => !val), [setUnfoldable])

	const whatsNewOpen = useCallback(() => whatsNewModal.current?.show(), [whatsNewModal])

	return (
		<CSidebar unfoldable={unfoldable}>
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
				<SidebarMenuItem name="Buttons" icon={faTh} path="/buttons" />
				<SidebarMenuItemGroup name="Surfaces" icon={faGamepad} notifications={SurfacesTabNotifyIcon} path="/surfaces">
					<SidebarMenuItem
						name="Configured"
						icon={null}
						notifications={SurfacesConfiguredTabNotifyIcon}
						path="/surfaces/configured"
					/>
					<SidebarMenuItem
						name="Integrations"
						notifications={SurfacesInstancesTabNotifyIcon}
						icon={null}
						path="/surfaces/integrations"
					/>
					<SidebarMenuItem name="Remote" icon={null} path="/surfaces/remote" />
				</SidebarMenuItemGroup>
				<SidebarMenuItem name="Triggers" icon={faClock} path="/triggers" />
				<SidebarMenuItemGroup name="Variables" icon={faDollarSign} path="/variables">
					<SidebarMenuItem name="Custom Variables" icon={faDollarSign} path="/variables/custom" />
					<SidebarMenuItem name="Expression Variables" icon={faSquareRootVariable} path="/variables/expression" />
					<SidebarMenuItem name="Internal" icon={null} path="/variables/connection/internal" />
					<SidebarVariablesGroups />
				</SidebarMenuItemGroup>
				<SidebarMenuItem name="Modules" icon={faPuzzlePiece} path="/modules" />
				<SidebarMenuItemGroup name="Settings" icon={faCog} path="/settings">
					<SidebarMenuItem name="Configuration Wizard" icon={faHatWizard} onClick={showWizard} />
					<SidebarMenuItem name="General" icon={null} path="/settings/general" />
					<SidebarMenuItem name="Buttons" icon={null} path="/settings/buttons" />
					<SidebarMenuItem name="Surfaces" icon={null} path="/settings/surfaces" />
					<SidebarMenuItem name="Protocols" icon={null} path="/settings/protocols" />
					<SidebarMenuItem name="Backups" icon={null} path="/settings/backups" />
					<SidebarMenuItem name="Advanced" icon={null} path="/settings/advanced" />
				</SidebarMenuItemGroup>
				<SidebarMenuItem name="Import / Export" icon={faFileImport} path="/import-export" />
				<SidebarMenuItem name="Log" icon={faClipboardList} path="/log" />
				{window.localStorage.getItem('show_companion_cloud') === '1' && (
					<SidebarMenuItem name="Cloud" icon={faCloud} path="/cloud" />
				)}
				<SidebarMenuItemGroup name="Interactive Buttons" icon={faSquareCaretRight}>
					<SidebarMenuItem name="Emulator" icon={null} path="/emulator" target="_blank" />
					<SidebarMenuItem name="Web buttons" icon={null} path="/tablet" target="_blank" />
				</SidebarMenuItemGroup>
			</CSidebarNav>
			<div className="sidebar-bottom-shadow-container">
				<div className="sidebar-bottom-shadow" />
			</div>
			<CSidebarNav className="nav-secondary border-top">
				<SidebarMenuItem name="What's New" icon={faStar} onClick={whatsNewOpen} />
				<SidebarMenuItem name="User Guide" icon={faInfo} path="/user-guide/" target="_blank" />
				<SidebarMenuItemGroup name="Support" icon={faHeadset}>
					<SidebarMenuItem name="Bugs & Features" icon={faBug} path="https://bfoc.us/fiobkz0yqs" target="_blank" />
					<SidebarMenuItem name="Community Forum" icon={faUsers} path="https://bfoc.us/qjk0reeqmy" target="_blank" />
					<SidebarMenuItem name="Slack Chat" icon={faComments} path="https://bfoc.us/ke7e9dqgaz" target="_blank" />
					<SidebarMenuItem name="Donate" icon={faDollarSign} path="https://bfoc.us/ccfbf8wm2x" target="_blank" />
				</SidebarMenuItemGroup>
			</CSidebarNav>
			<CSidebarHeader className="border-top d-none d-lg-flex sidebar-header-toggler">
				<SidebarTogglerAndVersion doToggle={doToggle} />
			</CSidebarHeader>
		</CSidebar>
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
			<SidebarMenuItemGroup key={collection.id} name={collection.label} icon={null} path={undefined}>
				{childCollectionsRendered}
				{childConnections?.map(renderConnection)}
			</SidebarMenuItemGroup>
		)
	}

	return (
		<>
			{connections.rootCollections().map((c) => renderCollection(c))}
			{rootConnections.map(renderConnection)}
		</>
	)
})

const SidebarTogglerAndVersion = observer(function SidebarTogglerAndVersion({ doToggle }: { doToggle: () => void }) {
	const versionInfo = useQuery(trpc.appInfo.version.queryOptions())

	let versionString = ''
	let versionSubheading = ''

	if (versionInfo.data) {
		if (versionInfo.data.appBuild.includes('-stable-')) {
			versionString = `v${versionInfo.data.appVersion}`
		} else {
			// split appBuild into parts.
			const splitPoint = versionInfo.data.appBuild.indexOf('-')
			if (splitPoint === -1) {
				versionString = `v${versionInfo.data.appBuild}`
			} else {
				versionString = `v${versionInfo.data.appBuild.substring(0, splitPoint)}`
				versionSubheading = versionInfo.data.appBuild.substring(splitPoint + 1)
			}
		}
	}

	return (
		<div className="nav-link sidebar-header-toggler2">
			<span className="nav-icon-wrapper" onClick={doToggle}>
				<span className="nav-icon sidebar-toggler"></span>
			</span>

			<span className="flex-fill text-truncate">
				<span className="version">{versionString || 'Unknown'}</span>
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
}
function CSidebar({ children, unfoldable }: React.PropsWithChildren<CSidebarProps>) {
	const sidebarRef = useRef<HTMLDivElement>(null)

	const [visibleMobile, setVisibleMobile] = useState<boolean>(false)

	const sidebarState = useSidebarState()

	useEffect(() => {
		const event = sidebarState.toggleEvent
		const handler = () => {
			setVisibleMobile(true)
		}
		event.addEventListener('show', handler)

		return () => {
			event.removeEventListener('show', handler)
		}
	}, [sidebarState.toggleEvent, setVisibleMobile])

	useEffect(() => {
		if (sidebarState.showToggle) setVisibleMobile(false)
	}, [sidebarState.showToggle])

	const handleOnClick = useCallback(
		(event: Event) => {
			const target = event.target as HTMLAnchorElement
			if (
				target &&
				target.classList.contains('nav-link') &&
				!target.classList.contains('nav-group-toggle') &&
				sidebarState.showToggle
			) {
				setVisibleMobile(false)
			}
		},
		[sidebarState.showToggle]
	)

	const handleKeyup = useCallback(
		(event: Event) => {
			if (sidebarState.showToggle && sidebarRef.current && !sidebarRef.current.contains(event.target as HTMLElement)) {
				setVisibleMobile(false)
			}
		},
		[sidebarState.showToggle, sidebarRef]
	)
	const handleClickOutside = useCallback(
		(event: Event) => {
			if (sidebarState.showToggle && sidebarRef.current && !sidebarRef.current.contains(event.target as HTMLElement)) {
				setVisibleMobile(false)
			}
		},
		[sidebarState.showToggle, sidebarRef]
	)

	useEffect(() => {
		window.addEventListener('mouseup', handleClickOutside)
		window.addEventListener('keyup', handleKeyup)

		const sideBarElement = sidebarRef.current

		sideBarElement?.addEventListener('mouseup', handleOnClick)

		return () => {
			window.removeEventListener('mouseup', handleClickOutside)
			window.removeEventListener('keyup', handleKeyup)

			sideBarElement?.removeEventListener('mouseup', handleOnClick)
		}
	}, [sidebarRef, handleOnClick, handleKeyup, handleClickOutside])

	return (
		<>
			<div
				className={classNames('sidebar sidebar-dark sidebar-fixed', {
					// [`sidebar-${colorScheme}`]: colorScheme,
					// 'sidebar-narrow': narrow,
					// 'sidebar-overlaid': overlaid,
					// [`sidebar-${placement}`]: placement,
					// [`sidebar-${position}`]: position,
					// [`sidebar-${size}`]: size,
					'sidebar-narrow-unfoldable': unfoldable,
					show: sidebarState.showToggle && visibleMobile,
					// hide: visibleDesktop === false && !sidebarState.showToggle && !overlaid,
				})}
				ref={sidebarRef}
			>
				{children}
			</div>
			{typeof window !== 'undefined' &&
				sidebarState.showToggle &&
				createPortal(
					<CBackdrop className="sidebar-backdrop" visible={sidebarState.showToggle && visibleMobile} />,
					document.body
				)}
		</>
	)
}

interface CNavGroupProps {
	to?: string

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
	 * Show nav group items.
	 */
	visible?: boolean
}

/*
 * A variant of CNavGroup from coreui-react that allows for making the group item be a link
 */
function CNavGroup({
	children,
	to,
	className,
	compact,
	toggler,
	visible,
	...rest
}: React.PropsWithChildren<CNavGroupProps>) {
	const [height, setHeight] = useState<number | string>()
	const navItemsRef = useRef<HTMLUListElement>(null)

	const [_visible, setVisible] = useState(Boolean(visible))

	const handleTogglerOnCLick = (event: React.MouseEvent<HTMLElement>) => {
		event.preventDefault()
		setVisible(!_visible)
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
		exiting: { display: 'block', height: height },
		exited: { height: height },
		unmounted: {},
	}

	return (
		<li className={classNames('nav-group', { show: _visible }, className)} {...rest}>
			{to ? (
				<div
					className="nav-link nav-group-toggle nav-group-toggle-link"
					onClick={(event) => handleTogglerOnCLick(event)}
				>
					<Link
						to={to}
						className="nav-link"
						onClick={(e) => {
							e.stopPropagation()
							setVisible(!_visible)
						}}
					>
						{toggler}
					</Link>
				</div>
			) : (
				<a
					className="nav-link nav-group-toggle nav-group-toggle-basic"
					onClick={(event) => handleTogglerOnCLick(event)}
				>
					{toggler}
				</a>
			)}

			<Transition
				in={_visible}
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
