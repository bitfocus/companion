import React from 'react'

export const windowLinkOpen = ({ href, sameWindow }: { href: string; sameWindow?: boolean; title?: string }) => {
	window.open(href, !sameWindow ? '_blank' : '', 'noreferrer')
}

interface WindowLinkOpenProps {
	href: string
	sameWindow?: boolean
	title?: string
	className?: string
}

export function WindowLinkOpen({
	children,
	href,
	sameWindow = false,
	title,
	className,
}: React.PropsWithChildren<WindowLinkOpenProps>) {
	return (
		<div
			onClick={() => windowLinkOpen({ href, sameWindow })}
			style={{ display: 'inline-block', cursor: 'pointer' }}
			title={title}
			className={className}
		>
			{children}
		</div>
	)
}
