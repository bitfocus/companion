import React from 'react'

export class Card extends React.Component {
	render() {
		return (
			<div
				style={{ border: '1px solid #ddd', boxShadow: '0px 2px 21px -10px rgba(0,0,0,0.3)', padding: 16 }}
				{...this.props}
			>
				{this.props.children}
			</div>
		)
	}
}
