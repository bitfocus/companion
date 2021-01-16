import React from 'react'
import Select from 'react-select'
import { CButton, CInput, CInputCheckbox, CInputFile } from "@coreui/react"
import classnames from 'classnames'
import { SketchPicker } from 'react-color';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { socketEmit } from '../util';

export function ConfigField(props) {
	const { definition } = props
	switch (definition.type) {
		case 'text':
			return <p title={definition.tooltip}>{definition.value}</p>
		case 'textinput':
			return <TextInputField {...props} />
		case 'number':
			return <NumberInputField {...props} />
		case 'checkbox':
			return <CheckboxInputField {...props} />
		case 'dropdown':
			return <DropdownInputField {...props} />
		// TODO dropdown-native but it appears to be unused
		default:
			return <p>Unknown field "{definition.type}"</p>
	}
}

export class TextInputField extends React.Component {

	compileRegex() {
		const { definition } = this.props

		if (definition.regex) {
			// Compile the regex string
			const match = definition.regex.match(/^\/(.*)\/(.*)$/)
			if (match) {
				return new RegExp(match[1], match[2])
			}
		}

		return null
	}

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.onChange(this.props.value, true)
		}
	}

	onChange = (newValue, validateOnly) => {
		if (validateOnly && !this.props.setValid) {
			return
		}

		const { definition } = this.props

		let isValid = true

		// Must match the regex
		const regex = this.compileRegex()
		if (regex && (newValue === undefined || !newValue.match(regex))) {
			isValid = false
		}

		// if required, must not be empty
		if (definition.required && newValue === '') {
			isValid = false
		}

		if (validateOnly) {
			this.props.setValid(isValid)
		} else {
			this.props.setValue(newValue, isValid)
		}
	}

	render() {
		const { definition, value, valid } = this.props

		return <CInput
			type='text'
			value={value}
			style={{ color: !valid ? 'red' : undefined }}
			tooltip={definition.tooltip}
			onChange={(e) => this.onChange(e.currentTarget.value, false)}
		/>
	}
}

export class NumberInputField extends React.Component {

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.onChange(this.props.value)
		}
	}

	onChange = (rawValue) => {
		const { definition } = this.props

		let isValid = true
		const parsedValue = parseFloat(rawValue)
		const processedValue = isNaN(parsedValue) ? rawValue : parsedValue

		if (rawValue === '') {
			// If required, it must not be empty
			if (definition.required) {
				isValid = false
			}
		} else {
			// If has a value, it must be a number
			if (isNaN(parsedValue)) {
				isValid = false
			}

			// Verify the value range
			if (definition.min !== undefined && parsedValue < definition.min) {
				isValid = false
			}
			if (definition.max !== undefined && parsedValue > definition.max) {
				isValid = false
			}
		}

		this.props.setValue(processedValue, isValid)
	}

	render() {
		const { definition, value, valid } = this.props

		return <CInput
			type='number'
			value={value ?? definition.default}
			min={definition.min}
			max={definition.max}
			style={{ color: !valid ? 'red' : undefined }}
			tooltip={definition.tooltip}
			onChange={(e) => this.onChange(e.currentTarget.value)}
		/>
	}
}

export class CheckboxInputField extends React.Component {

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.onChange(this.props.value)
		}
	}

	onChange = (newValue) => {
		console.log('checked', newValue, !!newValue)
		// TODO - test this
		this.props.setValue(!!newValue, true)
	}

	render() {
		const { definition, value } = this.props

		return <CInputCheckbox
			type='checkbox'
			checked={!!value}
			value={true}
			tooltip={definition.tooltip}
			onChange={(e) => this.onChange(e.currentTarget.checked)}
		/>
	}
}

export class DropdownInputField extends React.Component {

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.onChange(this.props.value)
		}
	}

	onChange = (newValue) => {
		const { definition } = this.props
		const isMultiple = !!definition.multiple

		let isValid = true

		// TODO multiple etc

		if (isMultiple) {
			for (const val of newValue) {
				// Require the selected choices to be valid
				if (!definition.choices.find(c => c.id === val)) {
					isValid = false
				}
			}

			if (typeof definition.minSelection === 'number' && newValue.length < definition.minSelection && newValue.length <= (this.props.value || []).length) {
				// Block change if too few are selected
				return
			}

			if (typeof definition.maximumSelectionLength === 'number' && newValue.length > definition.maximumSelectionLength && newValue.length >= (this.props.value || []).length) {
				// Block change if too many are selected
				return
			}

		} else {

			// Require the selected choice to be valid
			if (!definition.choices.find(c => c.id === newValue)) {
				isValid = false
			}
		}

		this.props.setValue(newValue, isValid)
	}

	render() {
		const { definition, value, valid } = this.props

		const options = []
		for (const choice of definition.choices) {
			const entry = { value: choice.id, label: choice.label }
			options.push(entry)
		}

		const isMultiple = !!definition.multiple
		const selectedValue = Array.isArray(value) ? value : [value]

		let currentValue = []
		for (const val of selectedValue) {
			// eslint-disable-next-line eqeqeq
			const entry = options.find(o => o.value == val) // Intentionally loose for compatability
			if (entry) {
				currentValue.push(entry)
			} else {
				currentValue.push({ value: val, label: `?? (${val})` })
			}
		}

		// if (option.tags === true) {
		//     selectoptions.tags = true;
		//     if (typeof option.regex !== 'undefined') {
		//         var flags = option.regex.replace(/.*\/([gimy]*)$/, '$1');
		//         var pattern = option.regex.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
		//         let regex = new RegExp(pattern, flags);
		//         selectoptions.createTag = function (params) {
		//             if (regex.test(params.term) === false) {
		//                 return null;
		//             }
		//             return {
		//                 id: params.term,
		//                 text: params.term
		//             }
		//         };
		//     }
		// }

		return <Select
			isClearable={false}
			isSearchable={typeof definition.minChoicesForSearch === 'number' && definition.minChoicesForSearch <= options.length}
			isMulti={isMultiple}
			tooltip={definition.tooltip}
			options={options}
			value={isMultiple ? currentValue : currentValue[0]}
			onChange={(e) => isMultiple ? this.onChange(e?.map(v => v.value) ?? []) : this.onChange(e?.value)}
		/>
	}
}


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
		this.props.setValue(newValue, true)
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

function splitColors(number) {
	return {
		r: ((number >> 16) & 0xff),
		g: ((number >> 8) & 0xff),
		b: (number & 0xff)
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

export class PNGInputField extends React.Component {

	inputRef = React.createRef()

	onChange = (e) => {
		const { definition } = this.props
		const newFiles = e.currentTarget.files
		e.currentTarget.files = null
		console.log('change', newFiles)

		//check whether browser fully supports all File API
		if (window.File && window.FileReader && window.FileList && window.Blob) {
			if (!newFiles.length || newFiles[0].type !== 'image/png') {
				alert('Sorry. Only proper PNG files are supported.');
				return;
			}

			var fr = new FileReader();
			fr.onload = () => { // file is loaded
				var img = new Image();

				img.onload = () => { // image is loaded; sizes are available
					if (definition?.min && (img.width < definition.min.width || img.height < definition.min.height)) {
						alert(`Image dimensions must be at least ${definition.min.width}x${definition.min.height}`);
					} else if (definition?.max && (img.width > definition.max.width || img.height > definition.max.height)) {
						alert(`Image dimensions must be at most ${definition.max.width}x${definition.max.height}`);
					} else {
						this.props.onSelect(fr.result, newFiles[0].name)
					}
				};

				img.src = fr.result; // is the data URL because called with readAsDataURL
			};
			fr.readAsDataURL(newFiles[0]);
		} else {
			alert('I am sorry, Companion requires a newer browser');
		}
	}

	onClick = () => {
		this.inputRef.current.click()
	}

	render() {
		// const { definition, value } = this.props

		return <CButton color="primary" className="pnginputfield" onClick={this.onClick}>
			Browse
			<CInputFile innerRef={this.inputRef} onChange={this.onChange} />
		</CButton>
	}
}
