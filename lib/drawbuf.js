// Super primitive drawing library!

var fs = require('fs');
var PNG = require('pngjs').PNG;

function drawbuf(width,height) {
	var self = this;

	self.width  = width;
	self.height = height;
	self.canvas = [];

	for (var y = 0; y < self.height; y++) {
		var buf = new Buffer(self.width * 3); // * 3 for RGB.
		self.canvas.push(buf);
	}

	return self;
}

drawbuf.prototype.backgroundColor = function(backgroundColor) {
	var self = this;

	for (var y = 0; y < self.height; y++) {
		for (var x = 0; x < self.width; x++) {
			self.pixel(x,y,backgroundColor);
		}
	}

	return true;
};

drawbuf.prototype.pixel = function (x, y, color) {
	var self = this;

	var line = self.canvas[y];
	line.writeUIntBE(color.readUIntBE(0, 3), x * 3, 3);

	return true;
};

drawbuf.prototype.horizontalLine = function (y, color) {
	var self = this;

	for (var x = 0; x < self.width; x++) {
		self.pixel(x,y,color);
	}

	return true;
};

drawbuf.prototype.verticalLine = function (x, color) {
	var self = this;

	for (var y = 0; y < self.height; y++) {
		self.pixel(x,y,color);
	}

	return true;
};

drawbuf.prototype.boxFilled = function (x1,y1,x2,y2,color) {
	var self = this;

	for (var y = y1; y < y2; y++) {
		for (var x = x1; x < x2; x++) {
			self.pixel(x,y,color);
		}
	}

	return true;
};

drawbuf.prototype.boxLine = function (x1,y1,x2,y2,color) {
	var self = this;

	for (var y = y1; y <= y2; y++) {
		var line = self.canvas[y];

		// draw horizontal lines
		if (y == y1 || y == y2) {
			for (var x = x1; x <= x2; x++) {
				self.pixel(x,y,color);
			}
		}

		// draw vertical lines
		if (y > y1 || y < y2) {
			self.pixel(x1,y,color);
			self.pixel(x2,y,color);
		}
	}

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

drawbuf.prototype.drawFromPNG = function(file,xStart,yStart) {
	var self = this;
	var data = fs.readFileSync(file);
	var png = PNG.sync.read(data);
	for (var y = 0; y < png.height && y < self.height - yStart; y++) {
		for (var x = 0; x < png.width && x < self.width - xStart; x++) {
			var idx = (png.width * y + x) << 2;
			var r = png.data[idx];
			var g = png.data[idx+1];
			var b = png.data[idx+2];
			self.pixel(xStart + x, yStart + y, self.rgb(r,g,b));
		}
	}
}

drawbuf.prototype.buffer = function() {
	var self = this;
	return Buffer.concat(self.canvas);
}

exports = module.exports = function (width, height) {
	return new drawbuf(width, height);
};
