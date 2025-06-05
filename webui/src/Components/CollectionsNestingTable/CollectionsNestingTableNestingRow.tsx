import classNames from 'classnames'
import React from 'react'

export function CollectionsNestingTableNestingRow({
	nestingLevel,
	children,
}: React.PropsWithChildren<{ nestingLevel: number }>) {
	return (
		<div
			style={{
				// @ts-expect-error variables are not typed
				'--collection-nesting-level': nestingLevel,
			}}
			className={classNames('flex flex-row align-items-center', {
				'collections-nesting-table-nesting': nestingLevel > 0,
			})}
		>
			{children}
		</div>
	)
}
