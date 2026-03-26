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
