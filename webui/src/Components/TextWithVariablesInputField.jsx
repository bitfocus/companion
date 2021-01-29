import React from 'react'
import { Mention, MentionsInput } from 'react-mentions';
import { CompanionContext } from '../util';

export class TextWithVariablesInputField extends React.Component {
	static contextType = CompanionContext

	state = {
		currentValue: null,
	}

	componentDidMount() {
		this.onChange(this.props.value ?? this.props.definition.default, false, true)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.onChange(this.props.value, true)
		}
	}

	onChange = (newValue, validateOnly, skipState) => {
		if (validateOnly && !this.props.setValid) {
			return
		}

		const { definition } = this.props

		let isValid = true

		// if required, must not be empty
		if (definition.required && newValue === '') {
			isValid = false
		}

		this.props.setValid(isValid)
		if (!validateOnly) {
			this.props.setValue(newValue)
			if (!skipState) {
				this.setState({
					currentValue: newValue
				})
			}
		}
	}

	renderSuggestion(suggestion, search, highlightedDisplay) {
		return (
			<div className="variable_suggestion">
				<span className="name">{highlightedDisplay}</span>
				<span className="label">{suggestion.label}</span>
			</div>
		)
	}

	render() {
		const { definition, value } = this.props

		const { variableDefinitions } = this.context
		const suggestions = []

		for (const [instanceLabel, variables] of Object.entries(variableDefinitions)) {
			for (const va of variables) {
				const variableId = `${instanceLabel}:${va.name}`
				suggestions.push({
					id: variableId,
					display: `$(${variableId})`,
					label: va.label,
				})
			}
		}

		return (
			<MentionsInput
				value={this.state.currentValue ?? value ?? definition.default}
				onChange={(e, val) => this.onChange(val, false)}
				onBlur={() => this.setState({ currentValue: null })}
				singleLine={true}
				className="inputwithvariables"
			>
				<Mention
					trigger="$"
					data={suggestions}
					markup="$(__id__)"
					displayTransform={(id, display) => `$(${display})`}
					renderSuggestion={this.renderSuggestion}
				/>
			</MentionsInput>
		)
	}
}
