import React from 'react'
import { SketchPicker } from 'react-color';

function splitColors(number) {
	return {
		r: ((number >> 16) & 0xff),
		g: ((number >> 8) & 0xff),
		b: (number & 0xff)
	}
}

export class ColorInputField extends React.Component {

	state = {
		displayColorPicker: false,
		currentColor: null,
	}

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default, false)
	}
	// componentDidUpdate(prevProps) {
	// 	if (prevProps.value !== this.props.value) {
	// 		this.onChange(this.props.value)
	// 	}
	// }

	handleClick = () => {
		this.setState({ displayColorPicker: !this.state.displayColorPicker })
	};

	handleClose = () => {
		this.setState({ displayColorPicker: false })
	};

	onChange = (newValue, updateState) => {
		console.log('change', newValue)
		this.props.setValue(newValue, true)
		if (updateState) {
			this.setState({ currentColor: newValue })
		}
	}

	onChangeComplete = (newValue) => {
		console.log('complete', newValue)
		this.props.setValue(newValue, true)
		this.setState({ currentColor: null })
	}

	render() {
		const { definition, value } = this.props

		const color = splitColors(this.state.newValue ?? value ?? definition.default)

		const styles = {
			color: {
				width: '36px',
				height: '14px',
				borderRadius: '2px',
				background: `rgb(${color.r}, ${color.g}, ${color.b})`,
			},
			swatch: {
				padding: '5px',
				background: '#fff',
				borderRadius: '1px',
				boxShadow: '0 0 0 1px rgba(0,0,0,.1)',
				display: 'inline-block',
				cursor: 'pointer',
			},
			popover: {
				position: 'absolute',
				zIndex: '2',
			},
			cover: {
				position: 'fixed',
				top: '0px',
				right: '0px',
				bottom: '0px',
				left: '0px',
			},
		}

		return (
			<div>
				<div style={styles.swatch} onClick={this.handleClick}>
					<div style={styles.color} />
				</div>
				{ this.state.displayColorPicker ? <div style={styles.popover}>
					<div style={styles.cover} onClick={this.handleClose} />
					<SketchPicker
						color={color}
						onChange={(c) => this.onChange(parseInt(c.hex.substr(1), 16), true)}
						onChangeComplete={(c) => this.onChangeComplete(parseInt(c.hex.substr(1), 16))}
						disableAlpha={true}
						presetColors={PICKER_COLORS}
					/>
				</div> : null}

			</div>
		)
	}
}


const PICKER_COLORS = [
	"#000000",
	"#FFFFFF",
	"#003366",
	"#336699",
	"#3366CC",
	"#003399",
	"#000099",
	"#0000CC",
	"#000066",
	"#006666",
	"#006699",
	"#0099CC",
	"#0066CC",
	"#0033CC",
	"#0000FF",
	"#3333FF",
	"#333399",
	"#669999",
	"#009999",
	"#33CCCC",
	"#00CCFF",
	"#0099FF",
	"#0066FF",
	"#3366FF",
	"#3333CC",
	"#666699",
	"#339966",
	"#00CC99",
	"#00FFCC",
	"#00FFFF",
	"#33CCFF",
	"#3399FF",
	"#6699FF",
	"#6666FF",
	"#6600FF",
	"#6600CC",
	"#339933",
	"#00CC66",
	"#00FF99",
	"#66FFCC",
	"#66FFFF",
	"#66CCFF",
	"#99CCFF",
	"#9999FF",
	"#9966FF",
	"#9933FF",
	"#9900FF",
	"#006600",
	"#00CC00",
	"#00FF00",
	"#66FF99",
	"#99FFCC",
	"#CCFFFF",
	"#CCCCFF",
	"#CC99FF",
	"#CC66FF",
	"#CC33FF",
	"#CC00FF",
	"#9900CC",
	"#003300",
	"#009933",
	"#33CC33",
	"#66FF66",
	"#99FF99",
	"#CCFFCC",
	"#FFCCFF",
	"#FF99FF",
	"#FF66FF",
	"#FF00FF",
	"#CC00CC",
	"#660066",
	"#336600",
	"#009900",
	"#66FF33",
	"#99FF66",
	"#CCFF99",
	"#FFFFCC",
	"#FFCCCC",
	"#FF99CC",
	"#FF66CC",
	"#FF33CC",
	"#CC0099",
	"#993399",
	"#333300",
	"#669900",
	"#99FF33",
	"#CCFF66",
	"#FFFF99",
	"#FFCC99",
	"#FF9999",
	"#FF6699",
	"#FF3399",
	"#CC3399",
	"#990099",
	"#666633",
	"#99CC00",
	"#CCFF33",
	"#FFFF66",
	"#FFCC66",
	"#FF9966",
	"#FF6666",
	"#FF0066",
	"#CC6699",
	"#993366",
	"#999966",
	"#CCCC00",
	"#FFFF00",
	"#FFCC00",
	"#FF9933",
	"#FF6600",
	"#FF5050",
	"#CC0066",
	"#660033",
	"#996633",
	"#CC9900",
	"#FF9900",
	"#CC6600",
	"#FF3300",
	"#FF0000",
	"#CC0000",
	"#990033",
	"#663300",
	"#996600",
	"#CC3300",
	"#993300",
	"#990000",
	"#800000",
	"#993333"
];
