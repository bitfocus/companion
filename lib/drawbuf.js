function drawbuf(width,height) {
	var self = this;

	self.width = width;
	self.height = height;
	self.canvas = [];

	for (var y = 0; y < self.height; y++) {
		var buf = new Buffer(self.width * 3); // * 3 for RGB.
		for (var x = 0; x < self.width * 3; x++) {
			buf.writeUInt8(255, x);
		}
		self.canvas.push(buf);
	}

	return self;

}

drawbuf.prototype.pixel = function (x, y, color) {
	var self = this;
	var line = self.canvas[y];
	line.writeUIntBE(color, x*3, 3);
	return true;
};

drawbuf.prototype.rgb = function (r,g,b) {
	var self = this;
	var buf = new Buffer(3);
	buf.writeUInt8(r, 0);
	buf.writeUInt8(g, 1);
	buf.writeUInt8(b, 2);
	return buf;
};

drawbuf.prototype.buffer = function() {
	var self = this;
	return Buffer.concat(self.canvas);
}

exports = module.exports = function (width, height) {
	return new drawbuf(width, height);
};
