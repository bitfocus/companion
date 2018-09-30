function common() {
	console.log("common");
}

common.prototype.getConfig = function () {
	var self = this;

	self.log('getConfig');

	return self.config;
};

common.prototype.handleBuffer = function(buffer) {
	var self = this;

	if (buffer.type == 'Buffer') {
		buffer = new Buffer(buffer.data);
	}

	if (buffer === undefined || buffer.length != 15552) {
		self.log("buffer was not 15552, but " + buffer.length);
		var args = [].slice.call(arguments);
		return false;
	}

	if (self.config.rotation === -90) {
		var buf = new Buffer(15552);

		for (var x = 0; x < 72; ++x) {
			for (var y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE((x*72*3)+(y*3),3), (y*72*3) + ((71-x) * 3), 3);
			}
		}
		buffer = buf;
	}

	if (self.config.rotation === 180) {
		var buf = new Buffer(15552);

		for (var x = 0; x < 72; ++x) {
			for (var y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE((x*72*3)+(y*3),3), ((71-x)*72*3) + ((71-y) * 3), 3);
			}
		}
		buffer = buf;
	}

	if (self.config.rotation === 90) {
		var buf = new Buffer(15552);

		for (var x = 0; x < 72; ++x) {
			for (var y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE((x * 72 * 3) + (y * 3),3), ((71-y)*72*3) + (x * 3), 3);
			}
		}
		buffer = buf;
	}

	return buffer;
};

exports = module.exports = common;
