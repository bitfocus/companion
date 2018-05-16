function rgb(r,g,b) {
	return (
		((r & 0xff) << 16) |
		((g & 0xff) << 8) |
		(b & 0xff)
	);
};

function bank(system) {
	var self = this;
	console.log("BANK BANK BANK!");

	self.config = {

		1: {
			3: {
				style: 'smalltext',
				text: 'this is small text',
				color: rgb(255,255,255),
				bgcolor: rgb(0,0,50)
			},

			5: {
				style: 'png',
				file: 'test.png'
			},

			9: {
				style: 'bigtext',
				text: 'big text',
				color: rgb(255,0,0),
				bgcolor: rgb(100,0,0)
			}
		}


	};
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

	system.emit('io_get', function(io) {

		io.on('connect', function(client) {

			client.on('get_bank', function(page,bank) {
				console.log("client wants page and bank",page,bank);
				system.emit('get_bank', page, bank, function(config) {
					client.emit('get_bank:results', page, bank, config);
				});
			});

			client.on('bank_style', function(page, bank, style) {
				console.log('page bank style', page, bank, style);
				if (self.config[page] === undefined) self.config[page] = {};
				if (self.config[page][bank] === undefined) self.config[page][bank] = {
					'text': 'Unnamed',
					'bgcolor': rgb(0,0,0),
					'color': rgb(255,255,255)
				};

				self.config[page][bank].style = style;
				system.emit('bank-update', self.config);
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
