import { useVirtualizer } from '@tanstack/react-virtual'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import type { GroupBase, MenuListProps } from 'react-select'
import { flattenGroupedChildren, getCurrentIndex } from './util.js'

export function WindowedMenuList<Option, IsMulti extends boolean, Group extends GroupBase<Option>>(
	props: MenuListProps<Option, IsMulti, Group>
): JSX.Element {
	const children = useMemo(() => {
		const children = React.Children.toArray(props.children)

		const head = children[0]

		if (React.isValidElement<{ data?: { options?: unknown[] } }>(head)) {
			const { props: { data: { options = [] } = {} } = {} } = head

			return options.length > 0 ? flattenGroupedChildren(children) : children
		} else {
			return []
		}
	}, [props.children])

	const currentIndex = useMemo(() => getCurrentIndex(children), [children])

	const {
		maxHeight = 300,
		paddingBottom = 0,
		paddingTop = 0,
		...menuListStyle
	} = props.getStyles('menuList', props) as React.CSSProperties

	const { innerRef, selectProps } = props
	const { classNamePrefix, isMulti } = selectProps || {}

	const parentRef = useRef<HTMLDivElement | null>(null)

	const setRefs = useCallback(
		(el: HTMLDivElement | null) => {
			parentRef.current = el
			if (innerRef == null) return
			if (typeof innerRef === 'function') {
				innerRef(el)
			} else {
				;(innerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
			}
		},
		[innerRef]
	)

	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count: children.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 60,
		overscan: 10,
		paddingStart: Number(paddingTop),
		paddingEnd: Number(paddingBottom),
	})

	useEffect(() => {
		if (currentIndex >= 0) {
			virtualizer.scrollToIndex(currentIndex, { align: 'auto' })
		}
	}, [currentIndex, children, virtualizer])

	const items = virtualizer.getVirtualItems()

	return (
		<div
			ref={setRefs}
			className={
				classNamePrefix
					? `${classNamePrefix}__menu-list${isMulti ? ` ${classNamePrefix}__menu-list--is-multi` : ''}`
					: ''
			}
			style={{
				...menuListStyle,
				maxHeight,
				overflow: 'auto',
			}}
		>
			<div
				style={{
					height: virtualizer.getTotalSize(),
					width: '100%',
					position: 'relative',
				}}
			>
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						width: '100%',
						transform: `translateY(${items[0]?.start ?? 0}px)`,
					}}
				>
					{items.map((virtualItem) => (
						<div key={virtualItem.key} data-index={virtualItem.index} ref={virtualizer.measureElement}>
							{children[virtualItem.index]}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
