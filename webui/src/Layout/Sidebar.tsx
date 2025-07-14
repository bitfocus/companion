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
import { CSidebarNav, CNavItem, CNavLink, CSidebarBrand, CSidebarHeader, CBackdrop } from '@coreui/react'
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
	faHatWizard,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SurfacesTabNotifyIcon } from '~/Surfaces/TabNotifyIcon.js'
import { createPortal } from 'react-dom'
import classNames from 'classnames'
import { useLocalStorage, useMediaQuery } from 'usehooks-ts'
import { Link } from '@tanstack/react-router'
import { Transition } from 'react-transition-group'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useSortedConnectionsThatHaveVariables } from '~/Stores/Util.js'
import { makeAbsolutePath } from '~/util.js'
import { trpc } from '~/TRPC'
import { useQuery } from '@tanstack/react-query'

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
		<CNavItem idx={item.path ?? item.name}>
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
				<SidebarMenuItem name="Getting Started" icon={faInfo} path="/getting-started" target="_blank" />
				<SidebarMenuItemGroup name="Help & Community" icon={faQuestionCircle}>
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
		if (
			target &&
			target.classList.contains('nav-link') &&
			!target.classList.contains('nav-group-toggle') &&
			sidebarState.showToggle
		) {
			setVisibleMobile(false)
		}
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
