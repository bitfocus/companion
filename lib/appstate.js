/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

var system
var debug = require('debug')('lib/appstate')

function appstate(system) {
	var self = this

	self.stateLabel = {
		web: 'Webserver',
		elgato: 'Elgato',
	}

	self.state = {
		web: false,
		elgato: false,
	}

	self.stateText = {
		web: '',
		elgato: '',
	}

	system.on('appstate_update', function (app, state) {
		self.state[app] = state
		system.emit('appstate', self.state)
	})

	system.on('appstate_update', function (app, state) {
		self.state[app] = state
	})

	system.on('appstate_update', function (app, state) {
		self.state[app] = state
	})

	return self
}

appstate.prototype.log = function () {
	var self = this
}

exports = module.exports = function (system) {
	return new appstate(system)
}
