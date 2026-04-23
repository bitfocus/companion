import { CDropdownDivider, CDropdownItem, CDropdownMenu } from '@coreui/react'
import { type IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faCircle as faOpenCircle } from '@fortawesome/free-regular-svg-icons'
import { faExternalLinkSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, type LinkOptions } from '@tanstack/react-router'
import { type ElementType, type ReactElement } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'

// provide a declarative menu specification:
interface MenuItemBaseProps {
	readonly label: string
	readonly id?: string
	readonly icon?: IconDefinition | (() => ReactElement) | 'none'
	readonly fullWidth?: boolean
	readonly tooltip?: string
	readonly inNewTab?: boolean
	readonly copyToClipboard?: Omit<CopyToClipboard.Props, 'children'>
}

interface MenuFnItemProps extends MenuItemBaseProps {
	readonly do: () => void
	// note: MenuItemFn can set inNewTab to show the "external link" icon but needs to manage opening the window on its own.
	readonly to?: never
	readonly href?: never
}

interface MenuRouteItemProps extends MenuItemBaseProps {
	readonly to: LinkOptions['to']
	readonly do?: never
	readonly href?: never
}

interface MenuHttpItemProps extends MenuItemBaseProps {
	readonly href: string
	readonly do?: never
	readonly to?: never
}

export type MenuActionItemProps = MenuRouteItemProps | MenuHttpItemProps | MenuFnItemProps

interface MenuSeparatorProps {
	readonly label?: string // to create a "group" heading
	readonly id?: string // used for key and to allow individually styled items, see code
	readonly isSeparator: true
}

export type MenuItemProps = MenuActionItemProps | MenuSeparatorProps

export interface MenuItemList {
	readonly menuItems: MenuItemProps[]
	readonly style?: React.CSSProperties
}

export function ActionMenu({ menuItems, style }: MenuItemList): React.JSX.Element {
	return (
		<CDropdownMenu style={style}>
			{menuItems.map((option, idx) => (
				<MenuItem key={option.id || `item-${idx}`} data={option} />
			))}
		</CDropdownMenu>
	)
}

// create menu-entries with (1) optional left-hand icon, (2) label, (3) optional right-side "external link" icon
// The menu action can be either a URL or a function call
export function MenuItem({ data }: { data: MenuItemProps }): React.JSX.Element {
	if ('isSeparator' in data) {
		return (
			<div className={data.id && `dropdown-sep-${data.id}`}>
				<CDropdownDivider />
				{data.label && <div className="dropdown-group-label">{data.label}</div>}
			</div>
		)
	} else {
		//Note 'to' expects a Tanstack route; 'href' expect an "external" link, i.e. one not served by Tanstack
		const isCallback = data.do !== undefined
		const isExternalLink = data.href !== undefined // currently, this includes /user-guide links (and /int, /img, ...)

		const navProps = isCallback
			? { as: 'button' as ElementType, onClick: data.do }
			: {
					// note: using Link for href items causes CDropDownItem to mark them as active, so just use 'a'
					...(isExternalLink
						? { href: data.href, as: 'a' as ElementType, rel: 'noopener noreferrer' }
						: { to: data.to, as: Link, activeOptions: { exact: true } }),
					target: data.inNewTab ? '_blank' : undefined,
				}

		// Structure: [CDropdownItem [CNavLink [left-icon, text, right-icon ]]]
		const menuItem = (
			// note: CDropdownItem has CSS class: dropdown-item. Here we only add the optional item-specific class
			<CDropdownItem
				type={isCallback ? 'button' : undefined}
				className={'d-flex justify-content-start' + (data.id ? ` dropdown-item-${data.id}` : '')}
				title={data.tooltip}
				{...navProps}
			>
				{!data.fullWidth && data.icon !== 'none' && (
					<span className="dropdown-item-icon">
						{typeof data.icon === 'function' ? (
							data.icon()
						) : (
							<FontAwesomeIcon
								icon={data.icon ? data.icon : faOpenCircle}
								className={data.icon ? 'visible' : 'invisible'}
							/>
						)}
					</span>
				)}
				<span className="dropdown-item-label">{data.label}</span>

				{!data.fullWidth && (data.inNewTab ? <FontAwesomeIcon className="ms-auto" icon={faExternalLinkSquare} /> : ' ')}
			</CDropdownItem>
		)

		const clip = data.copyToClipboard
		return clip ? <CopyToClipboard {...clip}>{menuItem}</CopyToClipboard> : menuItem
	}
}
