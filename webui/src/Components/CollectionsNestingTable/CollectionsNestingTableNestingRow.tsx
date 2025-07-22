import classNames from 'classnames'
import React from 'react'

export function CollectionsNestingTableNestingRow({
	nestingLevel,
	className,
	children,
}: React.PropsWithChildren<{ nestingLevel: number; className: string }>): React.JSX.Element {
	return (
		<div
			style={{
				// @ts-expect-error variables are not typed
				'--collection-nesting-level': nestingLevel,
			}}
			className={classNames(className, {
				'collections-nesting-table-nesting': nestingLevel > 0,
			})}
		>
			{children}
		</div>
	)
}
