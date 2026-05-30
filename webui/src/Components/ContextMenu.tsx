import { useMemo } from 'react'
import { PopoverActionMenu, type MenuItemProps } from './ActionMenu'
import { Popover } from './Popover'

interface ContextMenuProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	position: { x: number; y: number }
	menuItems: MenuItemProps[]
}

export const ContextMenu = ({ open, onOpenChange, position, menuItems = [] }: ContextMenuProps): React.JSX.Element => {
	const virtualAnchor = useMemo(
		() => ({
			getBoundingClientRect: () => DOMRect.fromRect({ x: position.x, y: position.y, width: 0, height: 0 }),
		}),
		[position.x, position.y]
	)

	return (
		<Popover.Root open={open} onOpenChange={onOpenChange}>
			<Popover.Popup
				anchor={virtualAnchor}
				positionerClassName="context-menu"
				side="bottom"
				align="start"
				sideOffset={2}
			>
				<PopoverActionMenu menuItems={menuItems} />
			</Popover.Popup>
		</Popover.Root>
	)
}
