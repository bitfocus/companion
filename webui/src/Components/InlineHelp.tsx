import React from 'react'
import { Popover } from './Popover.js'

export const InlineHelp = ({ help, children }: { help: string; children: React.ReactNode }): JSX.Element => {
	return (
		<>
			<Popover content={help} className="inline-help">
				<span className="inline-help-outer">{children}</span>
			</Popover>
		</>
	)
}
