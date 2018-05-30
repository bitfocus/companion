var debug   = require('debug')('lib/bank');


function rgb(r,g,b) {
	return (
		((r & 0xff) << 16) |
		((g & 0xff) << 8) |
		(b & 0xff)
	);
};

function bank(system) {
	var self = this;

	self.config = {};

	self.fields = {
		'bigtext': [
			{
				type: 'textinput',
				id: 'text',
				label: 'Button text',
				width: 12
			},
			{
				type: 'colorpicker',
				id: 'color',
				label: 'Text color',
				width: 6,
			},
			{
				type: 'colorpicker',
				id: 'bgcolor',
				label: 'Background color',
				width: 6
			}
		],
		'smalltext': [
			{
				type: 'textinput',
				id: 'text',
				label: 'Button text',
				width: 12
			},
			{
				type: 'colorpicker',
				id: 'color',
				label: 'Text color',
				width: 6,
			},
			{
				type: 'colorpicker',
				id: 'bgcolor',
				label: 'Background color',
				width: 6
			}
		],
		'png': [
			{
				type: 'filepicker',
				id: 'png',
				label: 'PNG Icon file'
			},
		]
	}

	system.emit('db_get', 'bank', function(res) {
		//debug("LOADING ------------",res);
		if (res !== undefined) {
			self.config = res;
		} else {
			for (var x = 1; x <= 99; x++) {
				if (self.config[x] === undefined) {
					self.config[x] = {};
					for (var y = 1; y <= 12; y++) {
						if (self.config[y] === undefined) {
							self.config[x][y] = {};
						}
					}
				}
			}
		}
	});

	system.on('bank-update', function(cfg) {
		debug('bank-update saving');
		system.emit('db_set', 'bank', cfg );
		system.emit('db_save');
	});

	system.emit('io_get', function(io) {

		io.on('connect', function(client) {

			client.on('get_bank', function(page,bank) {

				system.emit('get_bank', page, bank, function(config) {
					var fields = [];
					if (config.style !== undefined && self.fields[config.style] !== undefined) {
						fields = self.fields[config.style];
					}

					client.emit('get_bank:results', page, bank, config, fields);

				});
			});

			client.on('bank_changefield', function(page, bank, key, val) {
				self.config[page][bank][key] = val;
				system.emit('bank-update', self.config);
				system.emit('graphics_invalidate_bank', page, bank);
			});

			client.on('bank_style', function(page, bank, style) {

				if (self.config[page] === undefined) self.config[page] = {};

				if (style == 'none' || self.config[page][bank] === undefined || self.config[page][bank].style === undefined) {
					self.config[page][bank] = {
						'text': 'Unnamed',
						'bgcolor': rgb(0,0,0),
						'color': rgb(255,255,255)
					};
				}

				if (style == 'none') {
					client.emit('bank_style:results', page, bank, self.config[page][bank], undefined);
					system.emit('bank-update', self.config, undefined);
					system.emit('graphics_invalidate_bank', page, bank);
					return;
				}

				self.config[page][bank].style = style;

				var fields = [];
				if (self.fields[style] !== undefined) {
					fields = self.fields[style];
				}

				client.emit('bank_style:results', page, bank, self.config[page][bank], fields);
				system.emit('bank-update', self.config, fields);
				system.emit('graphics_invalidate_bank', page, bank);
			});

		});
	});

	system.on('get_bank', function(page,bank,cb) {
		if (self.config[page] === undefined) cb({});
		else if (self.config[page][bank] === undefined) cb({});
		else cb(self.config[page][bank]);
	});

	system.on('request-bank-update', function() {
		system.emit('bank-update', self.config);
	});

	system.on('ready', function() {
		system.emit('bank-update', self.config);
	});

}

exports = module.exports = function (system) {
	return new bank(system);
};
