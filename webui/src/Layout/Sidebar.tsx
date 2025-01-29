import React, {
	createContext,
	CSSProperties,
	memo,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import {
	CSidebarNav,
	CNavItem,
	CNavLink,
	CSidebarBrand,
	CSidebarToggler,
	CSidebarHeader,
	CBackdrop,
} from '@coreui/react'
import {
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
	faQuestionCircle,
	faBug,
	faUsers,
	faComments,
	IconDefinition,
	faSquareCaretRight,
	faPuzzlePiece,
	faInfo,
	faStar,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SurfacesTabNotifyIcon } from '../Surfaces/TabNotifyIcon.js'
import { createPortal } from 'react-dom'
import classNames from 'classnames'
import { useLocalStorage, useMediaQuery } from 'usehooks-ts'
import { Link } from '@tanstack/react-router'
import { Transition, TransitionStatus } from 'react-transition-group'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { useSortedConnectionsThatHaveVariables } from '../Stores/Util.js'

export interface SidebarStateProps {
	showToggle: boolean
	clickToggle: () => void
	toggleEvent: EventTarget
}
const SidebarStateContext = createContext<SidebarStateProps | null>(null)

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
	icon: IconDefinition | null
	notifications?: React.ComponentType<Record<string, never>>
	path?: string
	onClick?: () => void
	target?: string
}

function SidebarMenuItemLabel(item: SidebarMenuItemProps) {
	return (
		<>
			<span className="nav-icon-wrapper">
				{item.icon ? (
					<FontAwesomeIcon className="nav-icon" icon={item.icon} />
				) : (
					<span className="nav-icon">
						<span className="nav-icon-bullet" />
					</span>
				)}
			</span>

			<span className="flex-fill">
				<span>{item.name}</span>
				{!!item.subheading && (
					<>
						<br />
						<small>{item.subheading}</small>
					</>
				)}
			</span>

			{item.target === '_new' && <FontAwesomeIcon icon={faExternalLinkSquare} />}
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
		<CNavItem idx={item.path}>
			<CNavLink to={item.path} target={item.target} as={Link} onClick={onClick2}>
				<SidebarMenuItemLabel {...item} />
			</CNavLink>
		</CNavItem>
	)
}

interface SidebarMenuItemGroupProps extends SidebarMenuItemProps {
	children?: Array<React.ReactElement | null>
}

function SidebarMenuItemGroup(item: SidebarMenuItemGroupProps) {
	return (
		<CNavGroup toggler={<SidebarMenuItemLabel {...item} />} to={item.path}>
			{item.children}
		</CNavGroup>
	)
}

export const MySidebar = memo(function MySidebar() {
	const { whatsNewModal } = useContext(RootAppStoreContext)
	const [unfoldable, setUnfoldable] = useLocalStorage('sidebar-foldable', false)

	const whatsNewOpen = useCallback(() => whatsNewModal.current?.show(), [])

	return (
		<CSidebar unfoldable={unfoldable}>
			<CSidebarHeader className="brand">
				<CSidebarBrand>
					<div className="sidebar-brand-full">
						<img src="/img/icons/48x48.png" height="30" alt="logo" />
						&nbsp; Bitfocus&nbsp;
						<span style={{ fontWeight: 'bold' }}>Companion</span>
					</div>
					<div className="sidebar-brand-narrow">
						<img src="/img/icons/48x48.png" height="42px" alt="logo" />
					</div>
				</CSidebarBrand>
			</CSidebarHeader>
			<CSidebarNav>
				<SidebarMenuItem name="Connections" icon={faPlug} path="/connections" />
				<SidebarMenuItem name="Buttons" icon={faTh} path="/buttons" />
				<SidebarMenuItemGroup name="Surfaces" icon={faGamepad} notifications={SurfacesTabNotifyIcon} path="/surfaces">
					<SidebarMenuItem name="Configured" icon={null} path="/surfaces/configured" />
					<SidebarMenuItem name="Discover" icon={null} path="/surfaces/discover" />
					<SidebarMenuItem name="Remote" icon={null} path="/surfaces/outbound" />
				</SidebarMenuItemGroup>
				<SidebarMenuItem name="Triggers" icon={faClock} path="/triggers" />
				<SidebarMenuItemGroup name="Variables" icon={faDollarSign} path="/variables">
					<SidebarMenuItem name="Custom Variables" icon={null} path="/variables/custom" />
					<SidebarMenuItem name="Internal" icon={null} path="/variables/internal" />
					<SidebarVariablesGroups />
				</SidebarMenuItemGroup>
				<SidebarMenuItem name="Modules" icon={faPuzzlePiece} path="/modules" />
				<SidebarMenuItem name="Settings" icon={faCog} path="/settings" />
				<SidebarMenuItem name="Import / Export" icon={faFileImport} path="/import-export" />
				<SidebarMenuItem name="Log" icon={faClipboardList} path="/log" />
				{window.localStorage.getItem('show_companion_cloud') === '1' && (
					<SidebarMenuItem name="Cloud" icon={faCloud} path="/cloud" />
				)}
				<SidebarMenuItemGroup name="Interactive Buttons" icon={faSquareCaretRight}>
					<SidebarMenuItem name="Emulator" icon={null} path="/emulator" target="_new" />
					<SidebarMenuItem name="Web buttons" icon={null} path="/tablet" target="_new" />
				</SidebarMenuItemGroup>
			</CSidebarNav>
			<CSidebarNav className="nav-secondary">
				<SidebarMenuItem name="What's New" icon={faStar} onClick={whatsNewOpen} />
				<SidebarMenuItem name="Getting Started" icon={faInfo} path="/getting-started" target="_new" />
				<SidebarMenuItemGroup name="Help & Community" icon={faQuestionCircle}>
					<SidebarMenuItem
						name="Bugs & Features"
						icon={faBug}
						path="https://github.com/bitfocus/companion/issues"
						target="_new"
					/>
					<SidebarMenuItem
						name="Facebook"
						icon={faUsers}
						path="https://www.facebook.com/groups/companion/"
						target="_new"
					/>
					<SidebarMenuItem
						name="Slack Chat"
						icon={faComments}
						path="https://bitfocus.io/api/slackinvite"
						target="_new"
					/>
					<SidebarMenuItem
						name="Donate"
						icon={faDollarSign}
						path="https://donorbox.org/bitfocus-opensource"
						target="_new"
					/>
				</SidebarMenuItemGroup>
			</CSidebarNav>
			<CSidebarHeader className="border-top d-none d-lg-flex sidebar-header-toggler">
				<CSidebarToggler onClick={() => setUnfoldable((val) => !val)} />
			</CSidebarHeader>
		</CSidebar>
	)
})

const SidebarVariablesGroups = observer(function SidebarVariablesGroups() {
	const { modules } = useContext(RootAppStoreContext)

	const sortedConnections = useSortedConnectionsThatHaveVariables()

	return (
		<>
			{sortedConnections.map((connectionInfo) => (
				<SidebarMenuItem
					key={connectionInfo.id}
					name={connectionInfo.label}
					subheading={modules.getModuleFriendlyName(connectionInfo.instance_type)}
					icon={null}
					path={`/variables/${connectionInfo.label}`}
				/>
			))}
		</>
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
		sidebarState.showToggle && setVisibleMobile(false)
	}, [sidebarState.showToggle])

	useEffect(() => {
		window.addEventListener('mouseup', handleClickOutside)
		window.addEventListener('keyup', handleKeyup)

		sidebarRef.current?.addEventListener('mouseup', handleOnClick)

		return () => {
			window.removeEventListener('mouseup', handleClickOutside)
			window.removeEventListener('keyup', handleKeyup)

			sidebarRef.current?.removeEventListener('mouseup', handleOnClick)
		}
	})

	const handleKeyup = (event: Event) => {
		if (sidebarState.showToggle && sidebarRef.current && !sidebarRef.current.contains(event.target as HTMLElement)) {
			setVisibleMobile(false)
		}
	}
	const handleClickOutside = (event: Event) => {
		if (sidebarState.showToggle && sidebarRef.current && !sidebarRef.current.contains(event.target as HTMLElement)) {
			setVisibleMobile(false)
		}
	}

	const handleOnClick = (event: Event) => {
		const target = event.target as HTMLAnchorElement
		target &&
			target.classList.contains('nav-link') &&
			!target.classList.contains('nav-group-toggle') &&
			sidebarState.showToggle &&
			setVisibleMobile(false)
	}

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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const navItemsRef = useRef<any>(null)

	const [_visible, setVisible] = useState(Boolean(visible))

	const handleTogglerOnCLick = (event: React.MouseEvent<HTMLElement>) => {
		event.preventDefault()
		setVisible(!_visible)
	}

	const style: CSSProperties = {
		height: 0,
	}

	const onEntering = () => {
		navItemsRef.current && setHeight(navItemsRef.current.scrollHeight)
	}

	const onEntered = () => {
		setHeight('auto')
	}

	const onExit = () => {
		navItemsRef.current && setHeight(navItemsRef.current.scrollHeight)
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
				<a className="nav-link nav-group-toggle nav-group-toggle-link" onClick={(event) => handleTogglerOnCLick(event)}>
					<Link
						to={to}
						className="nav-link"
						onClick={(e) => {
							e.stopPropagation()
							setVisible(true)
						}}
					>
						{toggler}
					</Link>
				</a>
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
							...transitionStyles[state as TransitionStatus],
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
