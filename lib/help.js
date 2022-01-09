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

const fs = require('fs')

class help {
	debug = require('debug')('lib/help')

	constructor(system) {
		this.system = system

		this.system.on('http_req', (req, res, done) => {
			// Watch for HTTP requests made to /int/ (which emits 'http_req').
			let match

			// Return any asset made to /int/documentation/
			if ((match = req.url.match(/^\/documentation\/(.+?)(\?.+)?$/))) {
				const path = require('app-root-path') + '/documentation'
				const file = match[1].replace(/\.\.+/g, '')

				if (file.match(/\.(jpe?g|gif|png|pdf)$/) && fs.existsSync(path + '/' + file)) {
					done()
					res.sendFile(path + '/' + file)
				}
			}
		})

		this.system.on('io_connect', (client) => {
			client.on('get_help_md', (req, answer) => {
				// Return the rendered HTML for the requested Markdown file.
				// req will look like { file:'file.md' }.

				// Pass the filename requested back to the response so the receiver can watch for
				//  their response in case two different requests were made at the same time.
				let resp = {
					error: true,
					file: req.file,
					markdown: '',
				}

				if (req.file !== undefined) {
					// Prevent directory traversal
					const markdownFilename = req.file.replace(/(\.\.|\/)/g, '')
					const path = require('app-root-path') + '/documentation/' + markdownFilename

					if (fs.existsSync(path)) {
						try {
							resp.markdown = fs.readFileSync(path).toString()
							resp.baseUrl = '/int/documentation/'
							resp.error = false
						} catch (e) {
							this.debug('Error loading help ' + path)
							this.debug(e)
						}
					}
				} else {
					this.debug('Invalid get_help request')
				}

				answer(resp)
			})
		})
	}
}

exports = module.exports = function (system) {
	return new help(system)
}
