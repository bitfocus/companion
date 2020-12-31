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

var debug    = require('debug')('lib/Interface/HelpHandler');
var CoreBase = require('../Core/Base');
var fs       = require('fs');
var marked   = require('marked');

class InterfaceHelpHandler extends CoreBase {

	constructor(registry) {
		super(registry, 'help');

		this.system.on('http_req', this.processHttpRequest.bind(this));

		this.system.on('io_connect', (client) => {
			client.on('get_help', (req) => {
				client.emit('get_help:result', this.getHelp(req));
			});
		});
	}

	/**
	 * Reads the Markdown file located in /documentation and returns it as HTML.
	 * 
	 * @param markdownFilename
	 */
	getDocumentationFile(markdownFilename) {

		// Prevent directory traversal
		markdownFilename = markdownFilename.replace(/(\.\.|\/)/g, '');
		var path = this.registry.getAppRoot() + '/documentation/' + markdownFilename;

		if (fs.existsSync(path)) {
			try {
				var help = fs.readFileSync(path);

				help = marked(help.toString(), {
					baseUrl      : '/int/documentation/',
					headerPrefix : 'header-',
				});

				return help;
			}
			catch (e) {
				debug('Error loading help ' + path);
				debug(e);
			}
		}

		return null;
	}

	getHelp(req) {
		// Return the rendered HTML for the requested Markdown file.
		// req will look like { file:'file.md' }.

		// Pass the filename requested back to the response so the receiver can watch for
		//  their response in case two different requests were made at the same time.
		var resp = {
			error : true,
			file  : req.file,
			html  : '',
		};

		if (req.file !== undefined) {
			var html;

			if ((html = this.getDocumentationFile(req.file)) !== null) {
				resp.error = false;
				resp.html  = html;
			}
		}
		else {
			debug('Invalid get_help request');
		}

		return resp;
	}

	processHttpRequest(req, res, done) {
		// Watch for HTTP requests made to /int/ (which emits 'http_req').
		var match;

		// Return any asset made to /int/documentation/
		if (match = req.url.match(/^\/documentation\/(.+?)(\?.+)?$/)) {
			var path = this.registry.getAppRoot() + '/documentation';
			var file = match[1].replace(/\.\.+/g, '');

			if (file.match(/\.(jpe?g|gif|png|pdf)$/) && fs.existsSync(path +'/'+ file)) {

				if (done !== undefined && typeof done == 'function') {
					done();
				}

				res.sendFile(path +'/'+ file);
			}
		}
	}
}

exports = module.exports = InterfaceHelpHandler;