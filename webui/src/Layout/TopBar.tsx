import './TopBar.css'
import {
	faBars,
	faCheck,
	faChevronRight,
	faCircleArrowUp,
	faExternalLinkSquare,
	faLifeRing,
	faLock,
	faMagnifyingGlass,
	faPalette,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, useLocation } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { PopoverActionMenu, type MenuItemProps } from '~/Components/ActionMenu.js'
import { Popover } from '~/Components/Popover.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { THEME_CHOICES } from '~/Theme/themeChoices.js'
import { themeStore } from '~/Theme/ThemeState.js'
import { AdminLockContext } from './AdminLockContext.js'
import { commandPaletteOpen } from './CommandPaletteState.js'
import { navLocationForPath } from './navRegistry.js'
import { ContextHelpButton } from './PanelIcons.js'
import { useSidebarState } from './Sidebar.js'
import type { TopBarPage } from './TopBarContext.js'
import { useHelpMenuItems } from './useHelpMenuItems.js'
import { useUpdateInfo } from './useUpdateInfo.js'

/** Apple keyboards use ⌘ for the command palette shortcut; everything else uses Ctrl. */
const IS_APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

interface TopBarProps {
	/** What the open page has said about itself, or `null` for a page without a header */
	page: TopBarPage | null
}

/**
 * The app's header: where you are on the left, and what applies everywhere (search, status, help, lock) on the
 * right, so none of it scrolls out of reach with the sidebar.
 */
export const TopBar = observer(function TopBar({ page }: TopBarProps) {
	const { userConfig } = useContext(RootAppStoreContext)
	const { canLock, setLocked } = useContext(AdminLockContext)
	const { mobileMode, handleShowSidebar } = useSidebarState()

	const installName = userConfig.properties?.installName?.trim()

	return (
		<header className="top-bar">
			{mobileMode && (
				<button type="button" className="top-bar-icon-button" onClick={handleShowSidebar} title="Show navigation">
					<FontAwesomeIcon icon={faBars} />
				</button>
			)}

			<TopBarBreadcrumb page={page} />

			<div className="top-bar-actions">
				{installName && (
					<span className="top-bar-install-name" title="Installation name">
						{installName}
					</span>
				)}

				<TopBarUpdateNotice />
				<TopBarSearchButton />
				<TopBarThemeMenu />
				<TopBarHelpMenu />

				{canLock && (
					<button type="button" className="top-bar-icon-button" onClick={setLocked} title="Lock Admin UI">
						<FontAwesomeIcon icon={faLock} />
					</button>
				)}
			</div>
		</header>
	)
})

/**
 * Section › Page for a page inside a section, whose own title is only the section's name; otherwise the page's own
 * title. The page crumb links back to the page, for when a child route of it (an item from its list) is open.
 */
function TopBarBreadcrumb({ page }: { page: TopBarPage | null }) {
	const { pathname } = useLocation()
	const location = navLocationForPath(pathname)

	const icon = page?.icon ?? location?.section?.icon ?? location?.page.icon
	const pageLabel = location?.section
		? (location.page.shortLabel ?? location.page.label)
		: (page?.title ?? location?.page.label)

	if (!pageLabel) return <div className="top-bar-breadcrumb" />

	return (
		<nav className="top-bar-breadcrumb" aria-label="Breadcrumb">
			{icon && <FontAwesomeIcon icon={icon} className="top-bar-breadcrumb-icon" />}
			<ol>
				{location?.section && (
					<li className="top-bar-breadcrumb-section">
						<span>{location.section.label}</span>
						<FontAwesomeIcon icon={faChevronRight} className="top-bar-breadcrumb-separator" />
					</li>
				)}
				<li className="top-bar-breadcrumb-page">
					{/* The page's own heading, now that the page doesn't draw one */}
					<h1>
						{location && pathname !== location.page.path ? (
							<Link to={location.page.path}>{pageLabel}</Link>
						) : (
							<span aria-current="page">{pageLabel}</span>
						)}
					</h1>
				</li>
			</ol>
			{page?.helpAction && <ContextHelpButton action={page.helpAction} />}
		</nav>
	)
}

function TopBarSearchButton() {
	const shortcutLabel = IS_APPLE_PLATFORM ? '⌘K' : 'Ctrl+K'

	return (
		<button
			type="button"
			className="top-bar-search"
			onClick={() => commandPaletteOpen.set(true)}
			title={`Search or jump to... (${shortcutLabel})`}
		>
			<FontAwesomeIcon icon={faMagnifyingGlass} />
			<span className="top-bar-search-label">Search or jump...</span>
			<kbd className="top-bar-search-shortcut">{shortcutLabel}</kbd>
		</button>
	)
}

/**
 * A new release, called out in the bar itself rather than tucked in a menu, since acting on it is the point. Links
 * to the download; the full message is in its tooltip.
 */
function TopBarUpdateNotice() {
	const updateInfo = useUpdateInfo()
	if (!updateInfo) return null

	return (
		<a
			className="top-bar-update"
			href={updateInfo.link || 'https://companion.free/'}
			target="_blank"
			rel="noopener noreferrer"
			title={[updateInfo.message, updateInfo.message2].filter(Boolean).join('\n')}
		>
			<FontAwesomeIcon icon={faCircleArrowUp} />
			<span className="top-bar-update-label">{updateInfo.message}</span>
			<FontAwesomeIcon icon={faExternalLinkSquare} className="top-bar-update-external" />
		</a>
	)
}

/** Light, dark, or follow the system. The trigger shows the current choice */
const TopBarThemeMenu = observer(function TopBarThemeMenu() {
	const preference = themeStore.preference
	const current = THEME_CHOICES.find((choice) => choice.id === preference) ?? THEME_CHOICES[0]

	const menuItems: MenuItemProps[] = THEME_CHOICES.map((choice) => ({
		id: choice.id,
		label: choice.label,
		icon: choice.id === preference ? faCheck : choice.icon,
		tooltip: choice.description,
		do: () => themeStore.setPreference(choice.id),
	}))

	return (
		<Popover.Root>
			{/* A fixed palette icon, so the control is recognisable whichever theme is chosen; the menu shows the choice */}
			<Popover.Trigger color={null} className="top-bar-icon-button" title={`Theme: ${current.label}`}>
				<FontAwesomeIcon icon={faPalette} />
			</Popover.Trigger>
			<Popover.Popup side="bottom" align="end">
				<PopoverActionMenu menuItems={menuItems} />
			</Popover.Popup>
		</Popover.Root>
	)
})

function TopBarHelpMenu() {
	const helpMenuItems = useHelpMenuItems()

	return (
		<Popover.Root>
			{/* Labelled, and a life-ring rather than a "?", so it isn't mistaken for the page's own help by the breadcrumb */}
			<Popover.Trigger
				color={null}
				className="top-bar-icon-button top-bar-help-button"
				title="Help and version information"
			>
				<FontAwesomeIcon icon={faLifeRing} />
				<span className="top-bar-help-label">Help</span>
			</Popover.Trigger>
			<Popover.Popup side="bottom" align="end">
				<PopoverActionMenu menuItems={helpMenuItems} />
			</Popover.Popup>
		</Popover.Root>
	)
}
