import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
	faBorderAll,
	faClipboardList,
	faClock,
	faCog,
	faCogs,
	faDollarSign,
	faFileImport,
	faFloppyDisk,
	faGamepad,
	faGlobe,
	faImages,
	faNetworkWired,
	faPlug,
	faPuzzlePiece,
	faSquareRootVariable,
	faTh,
	faWarning,
} from '@fortawesome/free-solid-svg-icons'
import type { FileRouteTypes } from '~/routeTree.gen'

/** Any destination the router knows about — so a nav entry cannot point at a route that isn't there. */
export type NavPath = FileRouteTypes['to']

export interface NavPage {
	/** Stable id, also the `activeTab` value for a section's tab strip. */
	id: string
	label: string
	/** Shorter label for tight places (the sidebar sub-menu), where the section name is already shown. */
	shortLabel?: string
	path: NavPath
	icon: IconDefinition
	/** Extra paths that should also mark this page active (child routes of the same tab). */
	alsoMatches?: readonly string[]
}

export interface NavSection {
	id: string
	label: string
	icon: IconDefinition
	pages: readonly NavPage[]
}

/**
 * The one description of the app's navigation. The sidebar's sub-menus, each section's tab strip and
 * the command palette all read this, so a new page is added in exactly one place.
 */
export const SETTINGS_SECTION: NavSection = {
	id: 'settings',
	label: 'Settings',
	icon: faCog,
	pages: [
		{ id: 'general', label: 'General', path: '/settings/general', icon: faCog },
		{ id: 'buttons', label: 'Buttons', path: '/settings/buttons', icon: faTh },
		{ id: 'protocols', label: 'Protocols', path: '/settings/protocols', icon: faNetworkWired },
		{ id: 'backups', label: 'Backups', path: '/settings/backups', icon: faFloppyDisk },
		{ id: 'advanced', label: 'Advanced', path: '/settings/advanced', icon: faWarning },
	],
}

export const VARIABLES_SECTION: NavSection = {
	id: 'variables',
	label: 'Variables',
	icon: faDollarSign,
	pages: [
		{
			id: 'connections',
			label: 'Connection Variables',
			shortLabel: 'Connection',
			path: '/variables',
			icon: faNetworkWired,
		},
		{ id: 'custom', label: 'Custom Variables', shortLabel: 'Custom', path: '/variables/custom', icon: faDollarSign },
		{
			id: 'expression',
			label: 'Expression Variables',
			shortLabel: 'Expressions',
			path: '/variables/expression',
			icon: faSquareRootVariable,
		},
	],
}

export const SURFACES_SECTION: NavSection = {
	id: 'surfaces',
	label: 'Surfaces',
	icon: faGamepad,
	pages: [
		{ id: 'configured', label: 'Surfaces & Groups', path: '/surfaces', icon: faGamepad },
		{ id: 'integrations', label: 'Integrations & Settings', path: '/surfaces/integrations', icon: faCogs },
		{
			id: 'remote',
			label: 'Remote & Discover',
			path: '/surfaces/remote',
			icon: faGlobe,
			alsoMatches: ['/surfaces/discover'],
		},
	],
}

/** Top-level destinations that are not part of a section. */
export const TOP_LEVEL_PAGES: readonly NavPage[] = [
	{ id: 'buttons', label: 'Buttons', path: '/buttons', icon: faBorderAll },
	{ id: 'triggers', label: 'Triggers', path: '/triggers', icon: faClock },
	{ id: 'connections', label: 'Connections', path: '/connections', icon: faPlug },
	{ id: 'modules', label: 'Modules', path: '/modules', icon: faPuzzlePiece },
	{ id: 'image-library', label: 'Image Library', path: '/image-library', icon: faImages },
	{ id: 'log', label: 'System Log', path: '/log', icon: faClipboardList },
	{ id: 'import-export', label: 'Import / Export', path: '/import-export', icon: faFileImport },
]

export const NAV_SECTIONS: readonly NavSection[] = [VARIABLES_SECTION, SURFACES_SECTION, SETTINGS_SECTION]

/** Every page reachable from the nav, flattened — what the command palette searches. */
export const ALL_NAV_PAGES: readonly NavPage[] = [
	...TOP_LEVEL_PAGES,
	...NAV_SECTIONS.flatMap((section) =>
		section.pages.map((page) => ({ ...page, label: `${section.label}: ${page.label}` }))
	),
]

/** Which page of a section the current location is on. */
export function activePageIdForPath(section: NavSection, pathname: string): string {
	let best: NavPage | undefined
	for (const page of section.pages) {
		const paths = [page.path, ...(page.alsoMatches ?? [])]
		for (const path of paths) {
			if (pathname === path || pathname.startsWith(`${path}/`)) {
				// Longest match wins, so `/surfaces/remote` beats the section root `/surfaces`
				if (!best || path.length > best.path.length) best = page
			}
		}
	}
	return (best ?? section.pages[0]).id
}
