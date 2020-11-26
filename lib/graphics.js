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

var debug = require('debug')('lib/graphics');
var Image = require('./image');
var fs    = require('fs');
var _     = require('lodash');
var rgb   = Image.rgb;
var instance;

class graphics {

	constructor(system) {
		this.system = system;
		this.buffers = {};
		this.page_direction_flipped = false;
		this.page_plusminus = false;

		this.cfgDir;

		this.pushed = {};
		this.userconfig = {};
		this.page = {};
		this.style = {};
		this.pincodebuffer = {};

		this.system.on('graphics_bank_invalidate', this.invalidateBank.bind(this));
		this.system.on('graphics_indicate_push', this.indicatePush.bind(this));
		this.system.on('graphics_is_pushed', this.isPushed.bind(this));

		// get page object
		this.system.emit('get_page', (page) => {
			this.page = page;
		});

		// get userconfig object
		this.system.emit('get_userconfig', (userconfig) => {
			this.page_direction_flipped = userconfig.page_direction_flipped;
			this.page_plusminus = userconfig.page_plusminus;
		});

		// when page names are updated
		this.system.on('page_update', (page, obj) => {
			debug('page controls invalidated for page', page);
			this.system.emit('graphics_page_controls_invalidated', page);
		});

		this.system.on('action_bank_status_set', (page, bank, status) => {
			this.invalidateBank(page, bank);
		});

		this.system.on('graphics_page_controls_invalidated', (page) => {

			if (page !== undefined) {
				for (var bank = 1; bank <= global.MAX_BUTTONS; bank++) {
					var style = this.style[page + "_" + bank];
					if (style == 'pageup' || style == 'pagedown' || style == 'pagenum') {
						this.system.emit("bank_style", page, bank, style);
						this.invalidateBank(page, bank);
					}
				}
			}

			else {
				for (var page = 1; page <= 99; page++) {
					for (var bank = 1; bank <= global.MAX_BUTTONS; bank++) {
						var style = this.style[page + "_" + bank];
						if (style == 'pageup' || style == 'pagedown' || style == 'pagenum') {
							this.system.emit("bank_style", page, bank, style);
							this.invalidateBank(page, bank);
						}
					}
				}
			}
		});

		// if settings are changed, draw new up/down buttons
		this.system.on('set_userconfig_key', (key, val) => {
			if (key == 'page_direction_flipped') {
				this.page_direction_flipped = val;
				debug('page controls invalidated');
				this.system.emit('graphics_page_controls_invalidated');
			}
			if (key == 'page_plusminus') {
				this.page_plusminus = val;
				debug('page controls invalidated');
				this.system.emit('graphics_page_controls_invalidated');
			}
		});

		// draw custom bank (presets, previews etc)
		this.system.on('graphics_preview_generate', (config, cb) => {
			if (typeof cb == 'function') {
				var img = this.drawBankImage(config);
				if (img !== undefined) {
					cb(img.buffer());
				} else {
					cb(null);
				}
			}
		});

		this.system.once('bank_update', (config) => {
			if (config !== undefined) {
				this.config = config;
			}

			debug("Generating buffers");
			this.generate();
			debug("Done");
		});
	}

	drawBank(page, bank) {
		var img;

		page = parseInt(page);
		bank = parseInt(bank);

		if (this.config[page] !== undefined && this.config[page][bank] !== undefined && this.config[page][bank].style !== undefined) {

			var c = _.cloneDeep(this.config[page][bank]);

			// Fetch feedback-overrides for bank
			this.system.emit('feedback_get_style', page, bank, (style) => {
				if (style !== undefined) {
					for (var key in style) {
						c[key] = style[key];
					}
				}
			});

			img = this.drawBankImage(c, page, bank);
		}
		else {
			img = this.buffers[page+'_'+bank] = new Image(72,72);

			img.drawTextLine(2,3,page+"."+bank,img.rgb(50,50,50),0);
			img.horizontalLine(13,img.rgb(30,30,30));
		}

		return img;
	}

	drawBankImage(c, page, bank) {
		var img;
		var notStatic = page === undefined || bank === undefined;

		this.style[page+'_'+bank] = c.style;

		if (page !== undefined && bank !== undefined) {
			if (this.buffers[page+'_'+bank] === undefined) {
				img = this.buffers[page+'_'+bank] = new Image(72,72);
			}
			else {
				img = this.buffers[page+'_'+bank];
				img.boxFilled(0, 0, 71, 14, rgb(0,0,0));
			}
		}
		else {
			img = new Image(72,72);
		}

		// Don't draw the line on page buttons
		if (c.style !== 'pageup' && c.style !== 'pagedown' && c.style !== 'pagenum') {
			img.horizontalLine(13,img.rgb(255,198,0));
		}
		else {
			if (c.style == 'pageup') {

				img.backgroundColor(img.rgb(15,15,15));

				if (this.page_plusminus) {
					img.drawLetter(30, 20, this.page_direction_flipped ? '-' : '+', img.rgb(255,255,255), 0, 1);
				}
				else {
					img.drawLetter(26, 20, 'arrow_up', img.rgb(255,255,255), 'icon');
				}

				img.drawAlignedText(0,39,72,8,"UP",img.rgb(255,198,0),0,undefined,1,'center','center');

			}
			else if (c.style == 'pagedown') {

				img.backgroundColor(img.rgb(15,15,15));

				if (this.page_plusminus) {
					img.drawLetter(30, 40, this.page_direction_flipped ? '+' : '-', img.rgb(255,255,255), 0, 1);
				}
				else {
					img.drawLetter(26, 40, 'arrow_down', img.rgb(255,255,255), 'icon');
				}

				img.drawCenterText(36, 28, "DOWN",img.rgb(255,198,0),0);
			}
			else if (c.style == 'pagenum') {

				img.backgroundColor(img.rgb(15,15,15));

				if (page === undefined) { // Preview (no page/bank)
					img.drawAlignedText(0,0,72,30,'PAGE',img.rgb(255,198,0),0,undefined,1,'center','bottom');
					img.drawAlignedText(0,32,72,30,"x",img.rgb(255,255,255),18,undefined,1,'center','top');
				}
				else if (this.page[page] === undefined || this.page[page].name === 'PAGE' || this.page[page].name === '') {
					img.drawAlignedText(0,0,72,30,'PAGE',img.rgb(255,198,0),0,undefined,1,'center','bottom');
					img.drawAlignedText(0,32,72,30,""+page,img.rgb(255,255,255),18,undefined,1,'center','top');
				}
				else {
					var pagename = this.page[page].name;
					img.drawAlignedText(0,0,72,72, pagename,img.rgb(255,255,255),'18',2,0,'center','center');
				}
			}
		}

		// handle upgrade from pre alignment-support configuration
		if (c.alignment === undefined) {
			c.alignment = 'center:center';
		}

		if (c.pngalignment === undefined) {
			c.pngalignment = 'center:center';
		}

		if (page === undefined) { // Preview (no page/bank)

			img.drawTextLine(3, 3, "x.x", img.rgb(255, 198, 0), 0);
		}
		else if (this.pushed[page+'_'+bank] !== undefined) { // Pushed
			if (c.style !== 'pageup' && c.style !== 'pagedown' && c.style !== 'pagenum') {
				img.boxFilled(0, 0, 71, 14, rgb(255, 198, 0));
				img.drawTextLine(3, 3, page + "." + bank, img.rgb(0, 0, 0), 0);
			}
		}
		else { // not pushed
			if (c.style !== 'pageup' && c.style !== 'pagedown' && c.style !== 'pagenum') {
				img.drawTextLine(3, 3, page + "." + bank, img.rgb(255, 198, 0), 0);
			}
		}

		if (!notStatic) {
			this.system.emit('action_bank_status_get', page, bank, (status) => {
				var colors = [0, img.rgb(255, 127, 0), img.rgb(255, 0, 0)];

				if (status > 0) {
					img.boxFilled(62, 2, 70, 10, colors[status]);
				}
			});

			this.system.emit('action_running_get', page, bank, (status) => {
				if (status) {
					img.drawLetter(55,3,'play',img.rgb(0, 255, 0),'icon');
				}
			});
		}

		if (c.style == 'png' || c.style == 'text') {
			img.boxFilled(0, 14, 71, 71, c.bgcolor);
		}

		if (c.style == 'png' || c.style == 'text') {

			if (c.png64 !== undefined) {
				try {
					var data = new Buffer(c.png64, 'base64');
					var halign = c.pngalignment.split(":",2)[0];
					var valign = c.pngalignment.split(":",2)[1];
					img.drawFromPNGdata(data, 0, 14, 72, 58, halign, valign);
				}
				catch (e) {
					img.boxFilled(0, 14, 71, 57, 0);
					img.drawAlignedText(2,18,68,52, 'PNG ERROR', img.rgb(255,0 ,0), 0, 2, 1, 'center', 'center');
					return img;
				}
			}
			else {
				if (this.cfgDir === undefined) {
					this.system.emit('configdir_get', (_cfgDir) => {
						this.cfgDir = _cfgDir;
					});
				}

				if (fs.existsSync(this.cfgDir + '/banks/' + page + '_' + bank + '.png')) {
					// one last time
					img.drawFromPNG(this.cfgDir + '/banks/' + page + '_' + bank + '.png', 0, 14);

					// Upgrade config with base64 and delete file
					try {
						data = fs.readFileSync(this.cfgDir + '/banks/' + page + '_' + bank + '.png');
						this.system.emit('bank_set_key', page, bank, 'png64', data.toString('base64'));
						fs.unlink(this.cfgDir + '/banks/' + page + '_' + bank + '.png');
					}
					catch (e) {
						debug("Error upgrading config to inline png for bank " + page + "." + bank);
						debug("Reason:" + e.message);
					}
				}
			}

			/* raw image buffers */
			if (c.img64 !== undefined) {
				img.drawPixelBuffer(0, 14, 72, 58, c.img64, 'base64');
			}
		}

		if (c.style == 'text' || c.style == 'png') {
			var text;

			this.system.emit('variable_parse', c.text, (str) => {
				text = str;
			});

			var halign = c.alignment.split(":",2)[0];
			var valign = c.alignment.split(":",2)[1];

			switch(c.size) {
				case 'small':
					img.drawAlignedText(2,18,68,52, text, c.color, 0, 2, 1, halign, valign);
					break;
				case 'large':
					img.drawAlignedText(2,18,68,52, text, c.color, 14, 2, 1, halign, valign);
					break;
				case '7':
					img.drawAlignedText(2,18,68,52, text, c.color, 0, 2, 1, halign, valign);
					break;
				case '14':
					img.drawAlignedText(2,18,68,52, text, c.color, 14, undefined, 1, halign, valign);
					break;
				case '18':
					img.drawAlignedText(2,18,68,52, text, c.color, 18, undefined, 1, halign, valign);
					break;
				case '24':
					img.drawAlignedText(2,18,68,52, text, c.color, 24, undefined, 1, halign, valign);
					break;
				case '30':
					img.drawAlignedText(2,18,68,52, text, c.color, 30, undefined, 1, halign, valign);
					break;
				case '44':
					img.drawAlignedText(2,18,68,52, text, c.color, 44, undefined, 1, halign, valign);
					break;
				case 'auto':
					img.drawAlignedText(2,18,68,52, text, c.color, 'auto', undefined, 1, halign, valign);
					break;
				default:
					img.drawAlignedText(2,18,68,52, text, c.color, 0, 2, 1, halign, valign);
					break;
			}
		}

		return img;
	}

	drawControls() {
		// page up
		var img = this.buffers['up'] = new Image(72,72);
		img.backgroundColor(img.rgb(15,15,15));

		if (this.page_plusminus) {
			img.drawLetter(30, 20, this.page_direction_flipped ? '-' : '+', img.rgb(255,255,255), 0, 1);
		}
		else {
			img.drawLetter(26, 20, 'arrow_up', img.rgb(255,255,255), 'icon');
		}

		img.drawAlignedText(0,39,72,8,"PAGE UP",img.rgb(255,198,0),0,undefined,1,'center','center');

		// page down
		var img = this.buffers['down'] = new Image(72,72);
		img.backgroundColor(img.rgb(15,15,15));

		if (this.page_plusminus) {
			img.drawLetter(30, 40, this.page_direction_flipped ? '+' : '-', img.rgb(255,255,255), 0, 1);
		}
		else {
			img.drawLetter(26, 40, 'arrow_down', img.rgb(255,255,255), 'icon');
		}

		img.drawCenterText(36,28,"PAGE DOWN",img.rgb(255,198,0),0);
	}

	drawPage(page) {

		for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
			var img = this.drawBank(page, bank);
		}
	}

	generate() {

		for (var p = 1; p <= 99; p++) {
			this.drawPage(p);
		}
	}

	getBank(page, bank) {
		var img = this.buffers[page + '_' + bank];

		if (img === undefined) {
			this.drawBank(page, bank);
			img = this.buffers[page + '_' + bank];
		}

		if (img === undefined) {
			debug('!!!! ERROR: UNEXPECTED ERROR while fetching image for unbuffered bank: ' + page + '.' + bank);

			// continue gracefully, even though something is terribly wrong
			return { buffer: new Image(72,72), updated: Date.now() };
		}

		return { buffer: img.buffer(), updated: img.lastUpdate };
	}

	getImagesForPage(page) {
		var result = {};

		for (var i = 0; i < global.MAX_BUTTONS; ++i) {
			if (this.buffers[page + '_' + (parseInt(i)+1)] === undefined) {
				result[i] = (new Image(72,72)).bufferAndTime();
			}
			else {
				result[i] = this.buffers[page + '_' + (parseInt(i)+1)].bufferAndTime();
			}
		}

		return result;
	}

	getImagesForPincode(pincode) {
		var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);
		var img;

		if (this.pincodebuffer[0] === undefined) {

			for (var i = 0; i < 10; i++) {
				img = new Image(72,72);
				img.backgroundColor(img.rgb(15,15,15));
				img.drawAlignedText(0,0,72,72,i.toString(),img.rgb(255,255,255),44,undefined,44,'center','center');
				this.pincodebuffer[i] = img.bufferAndTime();
			}
		}

		img = new Image(72,72);
		img.backgroundColor(img.rgb(15,15,15));
		img.drawAlignedText(0,-10,72,72,"Lockout",img.rgb(255,198,0),14,undefined,44,'center','center');

		if (!(pincode === undefined)) {
			img.drawAlignedText(0,15,72,72,pincode.replace(/[a-z0-9]/gi, '*'),img.rgb(255,255,255),18,undefined,44,'center','center');
		}

		this.pincodebuffer[10] = img.bufferAndTime();

		img = new Image(72,72);
		img.backgroundColor(img.rgb(15,15,15));
		this.pincodebuffer[11] = img.bufferAndTime();

		return this.pincodebuffer;
	}

	getPageButton(page) {
		var img = new Image(72,72);

		img.backgroundColor(img.rgb(15,15,15));
		img.drawAlignedText(0,0,72,30,(this.page[page] !== undefined ? this.page[page].name : ''),img.rgb(255,198,0),0,undefined,1,'center','bottom');
		img.drawAlignedText(0,32,72,30,""+page,img.rgb(255,255,255),18,undefined,1,'center','top');
		return img;
	}

	indicatePush(page, bank, state) {
		this.buffers[page + '_' + bank] = undefined;

		if (state) {
			/* indicate push */
			this.buffers[page + '_' + bank] = undefined;
			this.pushed[page + '_' + bank] = 1;
		} else {
			this.buffers[page + '_' + bank] = undefined;
			delete this.pushed[page + '_' + bank];
		}

		this.drawBank(page, bank);
		this.system.emit('graphics_bank_invalidated', page, bank);
	}

	invalidateBank(page, bank) {
		this.buffers[page + '_' + bank] = undefined;
		this.style[page + '_' + bank] = undefined;
		this.drawBank(page, bank);

		this.system.emit('graphics_bank_invalidated', page, bank);
	}

	isPushed(page, bank, cb) {
		cb(this.pushed[page + '_' + bank]);
	}
}

// Graphics is a singleton class
exports = module.exports = function (system) {
	if (instance === undefined) {
		return instance = new graphics(system);
	} else {
		return instance;
	}
};
