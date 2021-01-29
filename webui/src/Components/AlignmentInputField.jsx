import React from 'react'
import classnames from 'classnames'

const ALIGMENT_OPTIONS = [
	"left:top", "center:top", "right:top",
	"left:center", "center:center", "right:center",
	"left:bottom", "center:bottom", "right:bottom"
]
export class AlignmentInputField extends React.Component {

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.onChange(this.props.value)
		}
	}

	onChange = (newValue) => {
		console.log('change', newValue)
		this.props.setValue(newValue)
	}

	render() {
		const { definition, value } = this.props

		return <div className="alignmentinput">
			{ALIGMENT_OPTIONS.map((align) => {
				return <div key={align} className={classnames({ selected: align === value ?? definition.default })} onClick={() => this.onChange(align)}>&nbsp;</div>
			})}
		</div>
	}
}
