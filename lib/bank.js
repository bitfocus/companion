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
				file: './icons/test.png'
			},
			9: {
				style: 'bigtext',
				text: 'big text',
				color: rgb(255,0,0),
				bgcolor: rgb(100,0,0)
			}
		}
	};

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
