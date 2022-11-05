import moment from 'moment'

export const EventDefinitions = {
	interval: {
		name: 'Time Interval',
		options: [
			{
				id: 'seconds',
				type: 'number',
				label: 'Interval (seconds)',
				min: 1,
				default: 10,
			},
		],
	},
	timeofday: {
		name: 'Time of Day',
		options: [
			{
				id: 'time',
				label: 'Time',
				type: 'textinput',
				placeholder: 'HH:MM:SS',
				pattern: '(0[0-9]|1[0-9]|2[0-3])(:[0-5][0-9]){2}',
				default: '',
			},
			{
				id: 'days',
				label: 'Days',
				type: 'multidropdown',
				minChoicesForSearch: 10,
				minSelection: 1,
				choices: Array.from(Array(7).keys()).map((i) => {
					return {
						id: i,
						label: moment().weekday(i).format('ddd'),
					}
				}),
				default: Array.from(Array(7).keys()),
			},
		],
	},
	startup: {
		name: 'Startup',
		options: [
			{
				id: 'delay',
				type: 'number',
				label: 'Delay (milliseconds)',
				min: 0,
				default: 10000,
			},
		],
	},
	client_connect: {
		name: 'Web client connect',
		options: [
			{
				id: 'delay',
				type: 'number',
				label: 'Delay (milliseconds)',
				min: 0,
				default: 0,
			},
		],
	},
	button_press: {
		name: 'On any button press',
		options: [],
	},
	button_depress: {
		name: 'On any button depress',
		options: [],
	},
	condition_true: {
		name: 'On condition becoming true',
		options: [],
	},
}
