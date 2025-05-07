import { faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { observer } from 'mobx-react-lite'
import { ConnectDropTarget } from 'react-dnd'

interface CollapsibleGroupContentsProps<TItem> {
	items: TItem[]
	showNoItemsMessage: boolean
	itemName: string
	isDragging?: boolean
	drop?: ConnectDropTarget
	children: (item: TItem, index: number) => React.ReactNode
}

export const CollapsibleGroupContents = observer(function CollapsibleGroupContents<TItem>({
	items,
	showNoItemsMessage,
	itemName,
	isDragging,
	drop,
	children,
}: CollapsibleGroupContentsProps<TItem>) {
	let visibleCount = 0

	const itemRows = items
		.map((item, index) => {
			const childNode = children(item, index)

			// Apply visibility filters
			if (!childNode) {
				return null
			}

			visibleCount++

			return children(item, index)
		})
		.filter((row) => row !== null)

	// Calculate number of hidden items
	const hiddenCount = items.length - visibleCount

	return (
		<>
			{itemRows}

			{isDragging && items.length === 0 && (
				<tr ref={drop} className="collapsible-list-dropzone">
					<td colSpan={6}>
						<p>Drop {itemName} here</p>
					</td>
				</tr>
			)}

			{hiddenCount > 0 && (
				<tr>
					<td colSpan={6} style={{ padding: '10px 5px' }}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>
							{hiddenCount} {itemName}s are hidden
						</strong>
					</td>
				</tr>
			)}

			{showNoItemsMessage && items.length === 0 && !isDragging && (
				<tr>
					<td colSpan={6} style={{ padding: '10px 5px' }}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>There are no {itemName}s in this group</strong>
					</td>
				</tr>
			)}
		</>
	)
})
