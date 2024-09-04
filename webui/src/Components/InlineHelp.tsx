import React from 'react'
import { CPopover } from '@coreui/react'

export const InlineHelp = ({ help, children }: { help: string; children: React.ReactNode }): JSX.Element => {
	return (
		<>
			<CPopover
				content={<div className="inline-help">{help}</div>}
				trigger="hover"
				delay={{ show: 300, hide: 100 }}
				animation={false}
				placement="bottom"
			>
				<span className="inline-help-outer">{children}</span>
			</CPopover>
		</>
	)
}
