import React from 'react'

export const windowLinkOpen = ({ href, sameWindow }: { href: string; sameWindow?: boolean; title?: string }) => {
	window.open(href, !sameWindow ? '_blank' : '', 'noreferrer')
}

interface WindowLinkOpenProps {
	href: string
	sameWindow?: boolean
	title?: string
}

export function WindowLinkOpen({
	children,
	href,
	sameWindow = false,
	title,
}: React.PropsWithChildren<WindowLinkOpenProps>) {
	return (
		<div
			onClick={() => windowLinkOpen({ href, sameWindow })}
			style={{ display: 'inline-block', cursor: 'pointer' }}
			title={title}
		>
			{children}
		</div>
	)
}
