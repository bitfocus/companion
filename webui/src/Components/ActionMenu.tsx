import { type IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faCircle as faOpenCircle } from '@fortawesome/free-regular-svg-icons'
import { faExternalLinkSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate, type LinkOptions } from '@tanstack/react-router'
import copy from 'copy-to-clipboard'
import { type ReactElement } from 'react'
import { Popover } from './Popover.js'

// provide a declarative menu specification:
interface MenuItemBaseProps {
	readonly label: string
	readonly id?: string
	readonly icon?: IconDefinition | (() => ReactElement) | 'none'
	readonly fullWidth?: boolean
	readonly tooltip?: string
	readonly inNewTab?: boolean
	readonly copyToClipboard?: {
		text: string
		onCopy?: (text: string, result: boolean) => void
		options?: { debug?: boolean; message?: string; format?: string }
	}
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

export function PopoverActionMenu({ menuItems }: { menuItems: MenuItemProps[] }): React.JSX.Element {
	const noIcons = menuItems.every((item) => 'isSeparator' in item || item.icon === undefined)
	return (
		<>
			{menuItems.map((option, idx) => (
				<PopoverMenuItem key={option.id || `item-${idx}`} data={noIcons ? { ...option, icon: 'none' } : option} />
			))}
		</>
	)
}

function PopoverMenuItemContents({ data }: { data: MenuActionItemProps }): React.JSX.Element {
	return (
		<>
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
		</>
	)
}

function PopoverRouteItem({
	data,
}: {
	data: MenuActionItemProps & { to: NonNullable<LinkOptions['to']> }
}): React.JSX.Element {
	// Separate element so that this useNavigate isn't required unless using a router link
	const navigate = useNavigate()

	return (
		<Popover.Item
			className={data.id ? `dropdown-item-${data.id}` : undefined}
			title={data.tooltip}
			onClick={() => void navigate({ to: data.to })}
		>
			<PopoverMenuItemContents data={data} />
		</Popover.Item>
	)
}

function PopoverMenuItem({ data }: { data: MenuItemProps }): React.JSX.Element {
	if ('isSeparator' in data) {
		return (
			<div className={data.id ? `dropdown-sep-${data.id}` : undefined}>
				<hr className="dropdown-divider" />
				{data.label && <div className="dropdown-group-label">{data.label}</div>}
			</div>
		)
	}

	if (data.to !== undefined) {
		return <PopoverRouteItem data={{ ...data, to: data.to }} />
	}

	const handleClick = () => {
		if (data.do) {
			data.do()
		} else if (data.href) {
			window.open(data.href, data.inNewTab ? '_blank' : '_self', 'noopener,noreferrer')
		}

		const clip = data.copyToClipboard
		if (clip) {
			copy(clip.text, clip.options)
				.then((res) => {
					clip.onCopy?.(clip.text, res)
				})
				.catch((err) => {
					clip.onCopy?.(clip.text, false)
					console.error('Copy to clipboard failed', err)
				})
		}
	}

	return (
		<Popover.Item
			className={data.id ? `dropdown-item-${data.id}` : undefined}
			title={data.tooltip}
			onClick={handleClick}
		>
			<PopoverMenuItemContents data={data} />
		</Popover.Item>
	)
}
