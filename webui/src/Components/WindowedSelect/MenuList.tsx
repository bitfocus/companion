import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { type ListChildComponentProps, VariableSizeList as List } from 'react-window'
import type { GroupBase, MenuListProps } from 'react-select'
import { createGetHeight, flattenGroupedChildren, getCurrentIndex } from './util.js'

export function WindowedMenuList<Option, IsMulti extends boolean, Group extends GroupBase<Option>>(
	props: MenuListProps<Option, IsMulti, Group>
): JSX.Element {
	const children = useMemo(() => {
		const children = React.Children.toArray(props.children)

		const head = children[0]

		if (React.isValidElement<{ data?: { options?: unknown[] } }>(head)) {
			const { props: { data: { options = [] } = {} } = {} } = head
			const isGrouped = options.length > 0

			return isGrouped ? flattenGroupedChildren(children) : children
		} else {
			return []
		}
	}, [props.children])

	// getStyles is called with MenuListProps as a proxy for component-specific props;
	// only the returned height/maxHeight/padding values are used, not the input props
	const getStyles = props.getStyles as (
		key: string,
		styleProps: unknown
	) => React.CSSProperties & { height?: number; maxHeight: number }
	const groupHeadingStyles = getStyles('groupHeading', props)
	const loadingMsgStyles = getStyles('loadingMessage', props)
	const noOptionsMsgStyles = getStyles('noOptionsMessage', props)
	const optionStyles = getStyles('option', props)
	const getHeight = createGetHeight({
		groupHeadingStyles,
		noOptionsMsgStyles,
		optionStyles,
		loadingMsgStyles,
	})

	const heights = useMemo(() => children.map(getHeight), [children, getHeight])
	const currentIndex = useMemo(() => getCurrentIndex(children), [children])

	const itemCount = children.length

	const [measuredHeights, setMeasuredHeights] = useState<Record<string, number | undefined>>({})

	// calc menu height
	const {
		maxHeight,
		paddingBottom = 0,
		paddingTop = 0,
		...menuListStyle
	} = getStyles('menuList', props) as {
		maxHeight: number
		paddingBottom?: number
		paddingTop?: number
	} & React.CSSProperties
	const totalHeight = useMemo(() => {
		return heights.reduce((sum, height, idx) => sum + (measuredHeights[idx] ?? height), 0)
	}, [heights, measuredHeights])
	const totalMenuHeight = totalHeight + paddingBottom + paddingTop
	const menuHeight = Math.min(maxHeight, totalMenuHeight)
	const estimatedItemSize = Math.floor(totalHeight / itemCount)

	const { innerRef, selectProps } = props

	const { classNamePrefix, isMulti } = selectProps || {}
	const list = useRef<List>(null)

	// Clear the measured heights when the children change, as they may no longer be accurate
	useEffect(() => setMeasuredHeights({}), [props.children])

	// method to pass to inner item to set this items outer height
	const setMeasuredHeight: SetMeasuredHeightFn = useCallback(
		({ index, measuredHeight }) => {
			if (measuredHeights[index] !== undefined && measuredHeights[index] === measuredHeight) {
				return
			}

			setMeasuredHeights((measuredHeights) => ({
				...measuredHeights,
				[index]: measuredHeight,
			}))

			// this forces the list to rerender items after the item positions resizing
			if (list.current) {
				list.current.resetAfterIndex(index)
			}
		},
		[measuredHeights]
	)

	React.useEffect(() => {
		/**
		 * enables scrolling on key down arrow
		 */
		if (currentIndex >= 0 && list.current !== null) {
			list.current.scrollToItem(currentIndex)
		}
	}, [currentIndex, children, list])

	return (
		<List
			className={
				classNamePrefix
					? `${classNamePrefix}__menu-list${isMulti ? ` ${classNamePrefix}__menu-list--is-multi` : ''}`
					: ''
			}
			style={menuListStyle}
			ref={list}
			outerRef={innerRef}
			estimatedItemSize={estimatedItemSize}
			innerElementType={React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
				({ style, ...rest }, ref) => (
					<div
						ref={ref}
						style={{
							...style,
							height: `${parseFloat(String(style?.height ?? 0)) + paddingBottom + paddingTop}px`,
						}}
						{...rest}
					/>
				)
			)}
			height={menuHeight}
			width="100%"
			itemCount={itemCount}
			itemData={children}
			itemSize={(index) => measuredHeights[index] || heights[index]}
		>
			{({ data, index, style }: ListChildComponentProps) => {
				return (
					<div
						style={{
							...style,
							top: `${parseFloat(String(style.top ?? 0)) + paddingTop}px`,
						}}
					>
						<MenuItem data={data[index]} index={index} setMeasuredHeight={setMeasuredHeight} />
					</div>
				)
			}}
		</List>
	)
}

type SetMeasuredHeightFn = (args: { index: number; measuredHeight: number }) => void

function MenuItem({
	data,
	index,
	setMeasuredHeight,
}: {
	data: React.ReactNode
	index: number
	setMeasuredHeight: SetMeasuredHeightFn
}) {
	const ref = useRef<HTMLDivElement>(null)

	// using useLayoutEffect prevents bounciness of options of re-renders
	useLayoutEffect(() => {
		if (ref.current) {
			const measuredHeight = ref.current.getBoundingClientRect().height

			setMeasuredHeight({ index, measuredHeight })
		}
	}, [index, setMeasuredHeight])

	return (
		<div key={`option-${index}`} ref={ref}>
			{data}
		</div>
	)
}
