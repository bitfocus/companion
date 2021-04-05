module.exports = {
	init_actions() {
		this.CHOICES_SURFACES.length = 0
		this.CHOICES_SURFACES.push({
			label: 'Current surface',
			id: 'self',
		})
		for (var i = 0; i < this.devices.length; ++i) {
			this.CHOICES_SURFACES.push({
				label: this.devices[i].type + ' (' + this.devices[i].serialnumber + ')',
				id: this.devices[i].serialnumber,
			})
		}

		this.CHOICES_PAGES = [{ label: 'This page', id: 0 }]

		for (var page in this.pages) {
			var name = page

			if (this.pages[page].name !== undefined && this.pages[page].name != 'PAGE') {
				name += ' (' + this.pages[page].name + ')'
			}
			this.CHOICES_PAGES.push({
				label: name,
				id: page,
			})
		}

		actions = {
			instance_control: {
				label: 'Enable or disable instance',
				options: [
					{
						type: 'dropdown',
						label: 'Instance',
						id: 'instance_id',
						default: this.CHOICES_INSTANCES.length > 0 ? this.CHOICES_INSTANCES[0].id : undefined,
						choices: this.CHOICES_INSTANCES,
					},
					{
						type: 'dropdown',
						label: 'Enable',
						id: 'enable',
						default: 'true',
						choices: this.CHOICES_YESNO_BOOLEAN,
					},
				],
				callback: ({ options }) => {
					this.system.emit('instance_enable', options.instance_id, options.enable == 'true')
				},
			},
			set_page: {
				label: 'Set surface with s/n to page',
				options: [
					{
						type: 'dropdown',
						label: 'Surface / controller',
						id: 'controller',
						default: 'self',
						choices: this.CHOICES_SURFACES,
					},
					{
						type: 'dropdown',
						label: 'Page',
						id: 'page',
						default: '1',
						choices: [{ id: 'back', label: 'Back' }, { id: 'forward', label: 'Forward' }, ...this.CHOICES_PAGES],
					},
				],
			},
			set_page_byindex: {
				label: 'Set surface with index to page',
				options: [
					{
						type: 'number',
						label: 'Surface / controller',
						id: 'controller',
						tooltip: 'Emulator is 0, all other controllers in order of type and serial-number',
						min: 0,
						max: 100,
						default: 0,
						required: true,
						range: false,
					},
					{
						type: 'dropdown',
						label: 'Page',
						id: 'page',
						default: '1',
						choices: [{ id: 'back', label: 'Back' }, { id: 'forward', label: 'Forward' }, ...this.CHOICES_PAGES],
					},
				],
			},
			lockout_device: {
				label: 'Trigger a device to lockout immediately.',
				options: [
					{
						type: 'dropdown',
						label: 'Surface / controller',
						id: 'controller',
						default: 'self',
						choices: this.CHOICES_SURFACES,
					},
				],
			},
			unlockout_device: {
				label: 'Trigger a device to unlock immediately.',
				options: [
					{
						type: 'dropdown',
						label: 'Surface / controller',
						id: 'controller',
						default: 'self',
						choices: this.CHOICES_SURFACES,
					},
				],
			},
			exec: {
				label: 'Run shell path (local)',
				options: [
					{
						type: 'textinput',
						label: 'Path',
						id: 'path',
					},
					{
						type: 'number',
						label: 'Timeout (ms, between 500 and 20000)',
						id: 'timeout',
						default: 5000,
						min: 500,
						max: 20000,
						required: true,
					},
				],
			},
			lockout_all: {
				label: 'Trigger all devices to lockout immediately.',
			},
			unlockout_all: {
				label: 'Trigger all devices to unlock immediately.',
			},
			inc_page: {
				label: 'Increment page number',
				options: [
					{
						type: 'dropdown',
						label: 'Surface / controller',
						id: 'controller',
						default: 'self',
						choices: this.CHOICES_SURFACES,
					},
				],
			},
			dec_page: {
				label: 'Decrement page number',
				options: [
					{
						type: 'dropdown',
						label: 'Surface / controller',
						id: 'controller',
						default: 'self',
						choices: this.CHOICES_SURFACES,
					},
				],
			},

			button_pressrelease: {
				label: 'Button press and release',
				options: [
					{
						type: 'dropdown',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: '0',
						choices: this.CHOICES_PAGES,
					},
					{
						type: 'dropdown',
						label: 'Bank',
						tooltip: 'Choosing This Button will ignore choice of Page',
						id: 'bank',
						default: '0',
						choices: this.CHOICES_BANKS,
					},
				],
			},

			button_press: {
				label: 'Button Press',
				options: [
					{
						type: 'dropdown',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: '0',
						choices: this.CHOICES_PAGES,
					},
					{
						type: 'dropdown',
						label: 'Bank',
						tooltip: 'Choosing This Button will ignore choice of Page',
						id: 'bank',
						default: '0',
						choices: this.CHOICES_BANKS,
					},
				],
			},

			button_release: {
				label: 'Button Release',
				options: [
					{
						type: 'dropdown',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: '0',
						choices: this.CHOICES_PAGES,
					},
					{
						type: 'dropdown',
						label: 'Bank',
						tooltip: 'Choosing This Button will ignore choice of Page',
						id: 'bank',
						default: '0',
						choices: this.CHOICES_BANKS,
					},
				],
			},

			button_text: {
				label: 'Button Text',
				options: [
					{
						type: 'textinput',
						label: 'Button Text',
						id: 'label',
						default: '',
					},
					{
						type: 'dropdown',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: '0',
						choices: this.CHOICES_PAGES,
					},
					{
						type: 'dropdown',
						label: 'Bank',
						tooltip: 'Choosing This Button will ignore choice of Page',
						id: 'bank',
						default: '0',
						choices: this.CHOICES_BANKS,
					},
				],
			},

			textcolor: {
				label: 'Button Text Color',
				options: [
					{
						type: 'colorpicker',
						label: 'Text Color',
						id: 'color',
						default: '0',
					},
					{
						type: 'dropdown',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: '0',
						choices: this.CHOICES_PAGES,
					},
					{
						type: 'dropdown',
						label: 'Bank',
						tooltip: 'Choosing This Button will ignore choice of Page',
						id: 'bank',
						default: '0',
						choices: this.CHOICES_BANKS,
					},
				],
			},

			bgcolor: {
				label: 'Button Background Color',
				options: [
					{
						type: 'colorpicker',
						label: 'Background Color',
						id: 'color',
						default: '0',
					},
					{
						type: 'dropdown',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: '0',
						choices: this.CHOICES_PAGES,
					},
					{
						type: 'dropdown',
						label: 'Bank',
						tooltip: 'Choosing This Button will ignore choice of Page',
						id: 'bank',
						default: '0',
						choices: this.CHOICES_BANKS,
					},
				],
			},
			rescan: {
				label: 'Rescan USB for devices',
			},

			panic_bank: {
				label: 'Abort actions on button',
				options: [
					{
						type: 'dropdown',
						label: 'Page',
						tooltip: 'What page is the button on?',
						id: 'page',
						default: '0',
						choices: this.CHOICES_PAGES,
					},
					{
						type: 'dropdown',
						label: 'Bank',
						tooltip: 'Choosing This Button will ignore choice of Page',
						id: 'bank',
						default: '0',
						choices: this.CHOICES_BANKS,
					},
					{
						type: 'checkbox',
						label: 'Unlatch?',
						id: 'unlatch',
						default: false,
					},
				],
			},

			panic: {
				label: 'Abort all delayed actions',
			},

			app_exit: {
				label: 'Kill companion',
			},
			app_restart: {
				label: 'Restart companion',
			},
		}

		this.setActions(actions)
	},
}
