import React, { type ElementType, type ReactElement } from 'react'
import { CDropdownItem, CDropdownDivider } from '@coreui/react'
import { faExternalLinkSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircle as faOpenCircle } from '@fortawesome/free-regular-svg-icons'
import { type IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Link } from '@tanstack/react-router'

// provide a declarative menu specification:
interface MenuActiveData {
	readonly label: string
	readonly to: string | (() => void) // URL string or action callback
	readonly id?: string // used for key and to allow individually styled items, see code
	readonly icon?: IconDefinition | (() => ReactElement) | 'none'
	readonly tooltip?: string
	readonly inNewTab?: boolean
}

interface MenuSeparatorData {
	readonly label?: string // to create a "group" heading
	readonly id?: string // used for key and to allow individually styled items, see code
	readonly isSeparator: true
}

export type MenuItemData = MenuActiveData | MenuSeparatorData

// create menu-entries with (1) optional left-hand icon, (2) label, (3) optional right-side "external link" icon
// The menu action can be either a URL or a function call
export function MenuItem({ data }: { data: MenuItemData }): React.JSX.Element {
	if ('isSeparator' in data) {
		return (
			<div className={data.id && `dropdown-sep-${data.id}`}>
				<CDropdownDivider />
				{data.label && <div className="dropdown-group-label">{data.label}</div>}
			</div>
		)
	} else {
		const isUrl = typeof data.to === 'string'
		const isHTTP = isUrl && /^https?:\/\//i.test(data.to) // "http://" or "https://"

		const navProps = isUrl
			? {
					...(isHTTP ? { href: data.to, as: 'a' as ElementType } : { to: data.to, as: Link }),
					rel: 'noopener noreferrer',
					target: data.inNewTab ? '_blank' : '_self',
				}
			: { as: 'button' as ElementType, onClick: data.to }

		// Structure: [CDropdownItem [CNavLink [left-icon, text, right-icon ]]]
		return (
			// note: CDropdownItem has CSS class: dropdown-item. Here we only add the optional item-specific class
			<CDropdownItem
				type={isUrl ? undefined : 'button'}
				className={'d-flex justify-content-start' + (data.id ? ` dropdown-item-${data.id}` : '')}
				title={data.tooltip}
				{...navProps}
			>
				{data.icon !== 'none' && (
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

				{data.inNewTab ? <FontAwesomeIcon className="ms-auto" icon={faExternalLinkSquare} /> : ' '}
			</CDropdownItem>
		)
	}
}
