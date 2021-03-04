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

var request = require('request')

var get = function (url, cb) {
	var options = {
		url: url,
		headers: {
			'User-Agent': 'request',
		},
		json: true,
	}

	request(options, function (error, response, body) {
		if (!error) {
			cb(null, response, body)
			return
		}

		cb(error, null, null)
	})
}

var lineReader = require('readline').createInterface({
	input: require('fs').createReadStream('.gitmodules'),
})

lineReader.on('line', function (line) {
	var found
	if ((found = line.match('companion-module-(.+).git'))) {
		;(function (module) {
			get(
				'http://api.github.com/repos/bitfocus/companion-module-' + module + '/issues',
				function (err, response, body) {
					if (err === null) {
						for (var i in body) {
							var issue = body[i]
							console.log('[' + module + '] #' + issue.number + ': ' + issue.title)
						}
					} else {
						console.log('error:', err)
					}
				}
			)
		})(found[1])
	}
})
