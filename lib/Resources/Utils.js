exports = module.exports = {
	SendResult: function (client, answer, name, ...args) {
		if (typeof answer === 'function') {
			answer(...args)
		} else {
			client.emit(name, ...args)
		}
	},
}
