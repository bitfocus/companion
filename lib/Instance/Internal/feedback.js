module.export = {
	init_feedback() {
		var feedbacks = {}

		var instance_choices = []

		Object.entries(this.instances).forEach((entry) => {
			const [key, value] = entry
			if (value.label == 'internal') {
				instance_choices.push({ id: 'all', label: 'All Instances' })
			} else {
				instance_choices.push({ id: key, label: value.label })
			}
		})

		feedbacks['instance_status'] = {
			label: 'Companion Instance Status',
			description: 'If any companion instance encounters any errors, this will turn red',
			options: [
				{
					type: 'dropdown',
					label: 'Instance',
					id: 'instance_id',
					choices: instance_choices,
					default: 'all',
				},
				{
					type: 'colorpicker',
					label: 'OK foreground color',
					id: 'ok_fg',
					default: this.rgb(255, 255, 255),
				},
				{
					type: 'colorpicker',
					label: 'OK background color',
					id: 'ok_bg',
					default: this.rgb(0, 200, 0),
				},
				{
					type: 'colorpicker',
					label: 'Warning foreground color',
					id: 'warning_fg',
					default: this.rgb(0, 0, 0),
				},
				{
					type: 'colorpicker',
					label: 'Warning background color',
					id: 'warning_bg',
					default: this.rgb(255, 255, 0),
				},
				{
					type: 'colorpicker',
					label: 'Error foreground color',
					id: 'error_fg',
					default: this.rgb(255, 255, 255),
				},
				{
					type: 'colorpicker',
					label: 'Error background color',
					id: 'error_bg',
					default: this.rgb(200, 0, 0),
				},
			],
			callback: ({ options }) => {
				if (this.instance_status.hasOwnProperty(options.instance_id)) {
					var cur_instance = this.instance_status[options.instance_id]

					if (cur_instance[0] == 2) {
						return {
							color: options.error_fg,
							bgcolor: options.error_bg,
						}
					}

					if (cur_instance[0] == 1) {
						return {
							color: options.warning_fg,
							bgcolor: options.warning_bg,
						}
					}

					return {
						color: options.ok_fg,
						bgcolor: options.ok_bg,
					}
				}

				if (this.instance_errors > 0) {
					return {
						color: options.error_fg,
						bgcolor: options.error_bg,
					}
				}

				if (this.instance_warns > 0) {
					return {
						color: options.warning_fg,
						bgcolor: options.warning_bg,
					}
				}

				return {
					color: options.ok_fg,
					bgcolor: options.ok_bg,
				}
			},
		}

		this.setFeedbackDefinitions(feedbacks)
	},
}
