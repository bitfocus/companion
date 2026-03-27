import React from 'react'
import { CPopover } from '@coreui/react'
import classnames from 'classnames'

export const InlineHelp = ({
	help,
	children,
	className,
}: {
	help: string | React.ReactNode
	children: React.ReactNode
	className?: string
}): JSX.Element => {
	return (
		<>
			<CPopover
				content={<div className="inline-help">{help}</div>}
				trigger={['hover', 'focus']} // better for keyboard navigation and, possibly, screen readers.
				delay={{ show: 300, hide: 100 }}
				animation={false}
				placement="bottom"
			>
				<span className={classnames('inline-help-outer', className)}>{children}</span>
			</CPopover>
		</>
	)
}
