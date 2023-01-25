export const windowLinkOpen = ({href,sameWindow}) => {
	window.open(href, !sameWindow ? '_blank' : '', 'noreferrer')
}
export function WindowLinkOpen({ children, href, sameWindow = false, title }) {
	return (
		<div
			onClick={(e) => windowLinkOpen({ href, sameWindow })}
			style={{ display: 'inline-block', cursor: 'pointer' }}
			title={title}
		>
			{children}
		</div>
	)
}
