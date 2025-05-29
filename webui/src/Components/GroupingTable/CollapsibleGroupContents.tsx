import { faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { observer } from 'mobx-react-lite'
import { ConnectDropTarget } from 'react-dnd'
import { CollapsibleListDropZone } from './CollapsibleListDropZone.js'
import classNames from 'classnames'

interface CollapsibleGroupContentsProps<TItem> {
	items: TItem[]
	showNoItemsMessage: boolean
	itemName: string
	nestingLevel: number
	isDragging?: boolean
	drop?: ConnectDropTarget
	children: (item: TItem, index: number) => React.ReactNode
}

export const CollapsibleGroupContents = observer(function CollapsibleGroupContents<TItem>({
	items,
	showNoItemsMessage,
	itemName,
	nestingLevel,
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

			{isDragging && items.length === 0 && <CollapsibleListDropZone drop={drop} itemName={itemName} />}

			{hiddenCount > 0 && (
				<tr
					style={{
						// @ts-expect-error variables are not typed
						'--group-nesting-level': nestingLevel,
					}}
				>
					<td colSpan={6} style={{ padding: '10px' }}>
						<div
							className={classNames({
								'collapsible-group-nesting': nestingLevel > 0,
							})}
						>
							<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
							<strong>
								{hiddenCount} {itemName}s are hidden
							</strong>
						</div>
					</td>
				</tr>
			)}

			{showNoItemsMessage && items.length === 0 && !isDragging && (
				<tr
					style={{
						// @ts-expect-error variables are not typed
						'--group-nesting-level': nestingLevel,
					}}
				>
					<td colSpan={6} style={{ padding: '10px' }}>
						<div
							className={classNames({
								'collapsible-group-nesting': nestingLevel > 0,
							})}
						>
							<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
							<strong>This groups is empty</strong>
						</div>
					</td>
				</tr>
			)}
		</>
	)
})
