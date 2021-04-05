module.exports = {
	addUpgradeScripts() {
		// Version 1 = from 15 to 32 keys config
		this.addUpgradeScript((config, actions) => {
			for (var i = 0; i < actions.length; ++i) {
				var action = actions[i]

				if (action.options !== undefined && action.options.page !== undefined && action.options.bank !== undefined) {
					var bank = parseInt(action.options.bank)

					this.system.emit('bank_get15to32', bank, function (_bank) {
						action.options.bank = _bank
					})
				}
			}
		})

		// rename for consistency
		this.addUpgradeScript((config, actions, upActions) => {
			var changed = false

			function upgrade(actions) {
				for (var i = 0; i < actions.length; ++i) {
					var action = actions[i]

					if ('panic_one' == action.action) {
						action.action = 'panic_bank'
						action.label = action.instance + ':' + action.action
						changed = true
					}
				}
				return changed
			}
			changed = upgrade(actions)
			changed = upgrade(upActions) || changed

			return changed
		})

		// v1.1.3 > v1.1.4
		this.addUpgradeScript((config, actions, releaseActions, feedbacks) => {
			let changed = false

			let checkUpgrade = (fb, changed) => {
				switch (fb.type) {
					case 'instance_status':
						if (fb.options.instance_id === undefined) {
							fb.options.instance_id = 'all'
							changed = true
						}
						if (fb.options.ok_fg === undefined) {
							fb.options.ok_fg = this.rgb(255, 255, 255)
							changed = true
						}
						if (fb.options.ok_bg === undefined) {
							fb.options.ok_bg = this.rgb(0, 200, 0)
							changed = true
						}
						if (fb.options.warning_fg === undefined) {
							fb.options.warning_fg = this.rgb(0, 0, 0)
							changed = true
						}
						if (fb.options.warning_bg === undefined) {
							fb.options.warning_bg = this.rgb(255, 255, 0)
							changed = true
						}
						if (fb.options.error_fg === undefined) {
							fb.options.error_fg = this.rgb(255, 255, 255)
							changed = true
						}
						if (fb.options.error_bg === undefined) {
							fb.options.error_bg = this.rgb(200, 0, 0)
							changed = true
						}
						break
				}

				return changed
			}

			for (let k in feedbacks) {
				changed = checkUpgrade(feedbacks[k], changed)
			}

			return changed
		})
	},
}
