import React from 'react'
import { CButton, CInputFile } from "@coreui/react"

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
