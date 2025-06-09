import React from 'react'

export const Tuck = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
	return (
		<div
			style={{
				width: 25,
				backgroundColor: '#444',
				color: '#fff',
				borderRadius: 3,
				marginRight: 5,
				display: 'inline-block',
				textAlign: 'center',
			}}
		>
			<div style={{ margin: '0 auto' }}>{children}</div>
		</div>
	)
}
