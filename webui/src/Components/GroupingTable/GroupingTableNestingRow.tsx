import classNames from 'classnames'
import React from 'react'

export function GroupingTableNestingRow({ nestingLevel, children }: React.PropsWithChildren<{ nestingLevel: number }>) {
	return (
		<div
			style={{
				// @ts-expect-error variables are not typed
				'--group-nesting-level': nestingLevel,
			}}
			className={classNames('flex flex-row align-items-center', {
				'grouping-table-nesting': nestingLevel > 0,
			})}
		>
			{children}
		</div>
	)
}
