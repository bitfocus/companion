import React from 'react'

// interface OptionGroup {
// 	options: unknown[]
// }

// export function calcOptionsLength(options: Array<OptionGroup | unknown>): number {
// 	options = options || []
// 	const head = (options[0] as OptionGroup) || {}
// 	const isGrouped = head.options !== undefined

// 	return isGrouped
// 		? (options as OptionGroup[]).reduce((result, group) => result + group.options.length, 0)
// 		: options.length
// }

export function flattenGroupedChildren(children: React.ReactNode[]): React.ReactNode[] {
	return children.reduce<React.ReactNode[]>((result, child) => {
		if (!React.isValidElement<{ children?: React.ReactNode[]; type?: string }>(child)) return [...result, child]

		if (child.props.children != null && typeof child.props.children === 'string') {
			return [...result, child]
		} else {
			const {
				props: { children: nestedChildren = [] },
			} = child

			return [...result, React.cloneElement(child, { type: 'group' }, []), ...nestedChildren]
		}
	}, [])
}

export function isFocused(child: React.ReactNode): boolean {
	return React.isValidElement<{ isFocused?: boolean }>(child) && child.props.isFocused === true
}

export function getCurrentIndex(children: React.ReactNode[]): number {
	return Math.max(children.findIndex(isFocused), 0)
}

interface HeightStyles {
	height?: number
}

export function createGetHeight({
	groupHeadingStyles,
	noOptionsMsgStyles,
	optionStyles,
	loadingMsgStyles,
}: {
	groupHeadingStyles: HeightStyles
	noOptionsMsgStyles: HeightStyles
	optionStyles: HeightStyles
	loadingMsgStyles: HeightStyles
}): (child: React.ReactNode) => number {
	return function getHeight(child: React.ReactNode): number {
		if (
			!React.isValidElement<{
				type?: string
				children?: unknown
				inputValue?: string
				selectProps?: {
					noOptionsMessage?: ((opts: { inputValue: string }) => unknown) | null
					loadingMessage?: ((opts: { inputValue: string }) => unknown) | null
				}
			}>(child)
		)
			return 35

		const { type, children, inputValue = '', selectProps: { noOptionsMessage, loadingMessage } = {} } = child.props

		if (type === 'group') {
			const { height = 25 } = groupHeadingStyles
			return height
		} else if (type === 'option') {
			const { height = 35 } = optionStyles
			return height
		} else if (typeof noOptionsMessage === 'function' && children === noOptionsMessage({ inputValue })) {
			const { height = 35 } = noOptionsMsgStyles
			return height
		} else if (typeof loadingMessage === 'function' && children === loadingMessage({ inputValue })) {
			const { height = 35 } = loadingMsgStyles
			return height
		} else {
			return 35
		}
	}
}
