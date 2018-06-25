// Super primitive drawing library!

var fs = require('fs');
var PNG = require('pngjs').PNG;
var debug   = require('debug')('lib/image');

// Here's our hand made 7px font!
var font = {};
font[0] = {
	"33":[[2,0],[2,1],[2,2],[2,3],[2,4],[2,6]],
	"34":[[0,0],[3,0],[0,1],[1,1],[3,1],[4,1]],
	"35":[[1,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[1,2],[3,2],[1,3],[3,3],[1,4],[3,4],[0,5],[1,5],[2,5],[3,5],[4,5],[1,6],[3,6]],
	"36":[[1,0],[2,0],[3,0],[0,1],[2,1],[4,1],[0,2],[2,2],[1,3],[2,3],[3,3],[2,4],[4,4],[0,5],[2,5],[4,5],[1,6],[2,6],[3,6]],
	"37":[[0,0],[1,0],[4,0],[0,1],[1,1],[4,1],[3,2],[2,3],[1,4],[0,5],[3,5],[4,5],[0,6],[3,6],[4,6]],
	"38":[[1,0],[2,0],[0,1],[3,1],[0,2],[3,2],[1,3],[2,3],[4,3],[0,4],[3,4],[0,5],[3,5],[1,6],[2,6],[4,6]],
	"39":[[2,0],[2,1]],
	"40":[[2,0],[3,0],[1,1],[1,2],[1,3],[1,4],[1,5],[2,6],[3,6]],
	"41":[[1,0],[2,0],[3,1],[3,2],[3,3],[3,4],[3,5],[1,6],[2,6]],
	"42":[[1,1],[3,1],[2,2],[0,3],[1,3],[2,3],[3,3],[4,3],[2,4],[1,5],[3,5]],
	"43":[[2,1],[2,2],[0,3],[1,3],[2,3],[3,3],[4,3],[2,4],[2,5]],
	"44":[[1,5],[2,5],[2,6]],
	"45":[[0,3],[1,3],[2,3],[3,3],[4,3]],
	"46":[[1,6]],
	"47":[[3,0],[3,1],[2,2],[2,3],[2,4],[1,5],[1,6]],
	"48":[[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[3,2],[4,2],[0,3],[2,3],[4,3],[0,4],[1,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"49":[[2,0],[1,1],[2,1],[0,2],[2,2],[2,3],[2,4],[2,5],[0,6],[1,6],[2,6],[3,6],[4,6]],
	"50":[[1,0],[2,0],[3,0],[0,1],[4,1],[4,2],[1,3],[2,3],[3,3],[0,4],[0,5],[0,6],[1,6],[2,6],[3,6],[4,6]],
	"51":[[1,0],[2,0],[3,0],[0,1],[4,1],[4,2],[2,3],[3,3],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"52":[[3,0],[4,0],[2,1],[4,1],[1,2],[4,2],[0,3],[4,3],[0,4],[1,4],[2,4],[3,4],[4,4],[4,5],[4,6]],
	"53":[[0,0],[1,0],[2,0],[3,0],[4,0],[0,1],[0,2],[1,2],[2,2],[3,2],[0,3],[4,3],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"54":[[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[0,3],[1,3],[2,3],[3,3],[0,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"55":[[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[3,3],[2,4],[2,5],[2,6]],
	"56":[[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[1,3],[2,3],[3,3],[0,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"57":[[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[1,3],[2,3],[3,3],[4,3],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"58":[[2,2],[2,4]],
	"59":[[2,2],[1,5],[2,5],[2,6]],
	"60":[[3,1],[2,2],[1,3],[2,4],[3,5]],
	"61":[[0,2],[1,2],[2,2],[3,2],[4,2],[0,4],[1,4],[2,4],[3,4],[4,4]],
	"62":[[1,1],[2,2],[3,3],[2,4],[1,5]],
	"63":[[1,0],[2,0],[3,0],[0,1],[4,1],[4,2],[2,3],[3,3],[2,4],[2,6]],
	"64":[[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[2,2],[3,2],[4,2],[0,3],[2,3],[4,3],[0,4],[2,4],[3,4],[4,4],[0,5],[1,6],[2,6],[3,6],[4,6]],
	"65":[[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3],[4,3],[0,4],[4,4],[0,5],[4,5],[0,6],[4,6]],
	"66":[[0,0],[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3],[0,4],[4,4],[0,5],[4,5],[0,6],[1,6],[2,6],[3,6]],
	"67":[[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[0,3],[0,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"68":[[0,0],[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[4,3],[0,4],[4,4],[0,5],[4,5],[0,6],[1,6],[2,6],[3,6]],
	"69":[[0,0],[1,0],[2,0],[3,0],[4,0],[0,1],[0,2],[0,3],[1,3],[2,3],[3,3],[0,4],[0,5],[0,6],[1,6],[2,6],[3,6],[4,6]],
	"70":[[0,0],[1,0],[2,0],[3,0],[4,0],[0,1],[0,2],[0,3],[1,3],[2,3],[3,3],[0,4],[0,5],[0,6]],
	"71":[[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[0,3],[0,4],[3,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"72":[[0,0],[4,0],[0,1],[4,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3],[4,3],[0,4],[4,4],[0,5],[4,5],[0,6],[4,6]],
	"73":[[0,0],[1,0],[2,0],[3,0],[4,0],[2,1],[2,2],[2,3],[2,4],[2,5],[0,6],[1,6],[2,6],[3,6],[4,6]],
	"74":[[0,0],[1,0],[2,0],[3,0],[4,0],[0,1],[4,1],[4,2],[4,3],[0,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"75":[[0,0],[4,0],[0,1],[4,1],[0,2],[3,2],[0,3],[1,3],[2,3],[0,4],[3,4],[0,5],[4,5],[0,6],[4,6]],
	"76":[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,6],[2,6],[3,6],[4,6]],
	"77":[[0,0],[4,0],[0,1],[4,1],[0,2],[1,2],[3,2],[4,2],[0,3],[2,3],[4,3],[0,4],[2,4],[4,4],[0,5],[4,5],[0,6],[4,6]],
	"78":[[0,0],[4,0],[0,1],[4,1],[0,2],[1,2],[4,2],[0,3],[2,3],[4,3],[0,4],[3,4],[4,4],[0,5],[4,5],[0,6],[4,6]],
	"79":[[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[4,3],[0,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"80":[[0,0],[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3],[0,4],[0,5],[0,6]],
	"81":[[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[4,3],[0,4],[2,4],[4,4],[0,5],[3,5],[1,6],[2,6],[4,6]],
	"82":[[0,0],[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3],[0,4],[2,4],[0,5],[3,5],[0,6],[4,6]],
	"83":[[1,0],[2,0],[3,0],[4,0],[0,1],[0,2],[1,3],[2,3],[3,3],[4,4],[4,5],[0,6],[1,6],[2,6],[3,6]],
	"84":[[0,0],[1,0],[2,0],[3,0],[4,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6]],
	"85":[[0,0],[4,0],[0,1],[4,1],[0,2],[4,2],[0,3],[4,3],[0,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"86":[[0,0],[4,0],[0,1],[4,1],[0,2],[4,2],[0,3],[4,3],[0,4],[4,4],[1,5],[3,5],[2,6]],
	"87":[[0,0],[4,0],[0,1],[4,1],[0,2],[2,2],[4,2],[0,3],[2,3],[4,3],[0,4],[2,4],[4,4],[0,5],[2,5],[4,5],[1,6],[3,6]],
	"88":[[0,0],[4,0],[0,1],[4,1],[1,2],[3,2],[2,3],[1,4],[3,4],[0,5],[4,5],[0,6],[4,6]],
	"89":[[0,0],[4,0],[0,1],[4,1],[1,2],[3,2],[2,3],[2,4],[2,5],[2,6]],
	"90":[[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[3,2],[2,3],[1,4],[0,5],[0,6],[1,6],[2,6],[3,6],[4,6]],
	"91":[[1,0],[2,0],[3,0],[1,1],[1,2],[1,3],[1,4],[1,5],[1,6],[2,6],[3,6]],
	"92":[[0,0],[0,1],[1,2],[2,3],[3,4],[4,5],[4,6]],
	"93":[[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[1,6],[2,6],[3,6]],
	"94":[[2,0],[1,1],[3,1],[0,2],[4,2]],
	"95":[[0,6],[1,6],[2,6],[3,6],[4,6]],
	"96":[[1,0],[2,1]],
	"97":[[0,1],[1,1],[2,1],[3,2],[1,3],[2,3],[3,3],[0,4],[3,4],[0,5],[3,5],[1,6],[2,6],[4,6]],
	"98":[[0,0],[0,1],[0,2],[0,3],[1,3],[2,3],[3,3],[0,4],[4,4],[0,5],[4,5],[0,6],[1,6],[2,6],[3,6]],
	"99":[[1,1],[2,1],[3,1],[0,2],[4,2],[0,3],[0,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"100":[[4,0],[4,1],[4,2],[1,3],[2,3],[3,3],[4,3],[0,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6],[4,6]],
	"101":[[1,1],[2,1],[3,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3],[4,3],[0,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"102":[[3,0],[4,0],[2,1],[1,2],[2,2],[3,2],[2,3],[2,4],[2,5],[2,6]],
	"103":[[1,0],[2,0],[4,0],[0,1],[3,1],[1,2],[2,2],[0,3],[1,4],[2,4],[3,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"104":[[0,0],[0,1],[0,2],[1,2],[2,2],[3,2],[0,3],[4,3],[0,4],[4,4],[0,5],[4,5],[0,6],[4,6]],
	"105":[[2,0],[2,2],[2,3],[2,4],[2,5],[2,6]],
	"106":[[3,0],[3,2],[3,3],[3,4],[0,5],[3,5],[1,6],[2,6]],
	"107":[[0,0],[0,1],[0,2],[3,2],[0,3],[2,3],[0,4],[1,4],[2,4],[0,5],[3,5],[0,6],[4,6]],
	"108":[[2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[3,6]],
	"109":[[0,1],[1,1],[3,1],[0,2],[2,2],[4,2],[0,3],[2,3],[4,3],[0,4],[2,4],[4,4],[0,5],[2,5],[4,5],[0,6],[2,6],[4,6]],
	"110":[[0,1],[2,1],[3,1],[0,2],[1,2],[4,2],[0,3],[4,3],[0,4],[4,4],[0,5],[4,5],[0,6],[4,6]],
	"111":[[1,1],[2,1],[3,1],[0,2],[4,2],[0,3],[4,3],[0,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"112":[[0,1],[1,1],[2,1],[3,1],[0,2],[4,2],[0,3],[4,3],[0,4],[1,4],[2,4],[3,4],[0,5],[0,6]],
	"113":[[1,1],[2,1],[3,1],[4,1],[0,2],[4,2],[0,3],[4,3],[1,4],[2,4],[3,4],[4,4],[4,5],[4,6]],
	"114":[[1,1],[3,1],[4,1],[1,2],[2,2],[1,3],[1,4],[1,5],[1,6]],
	"115":[[1,1],[2,1],[3,1],[0,2],[4,2],[1,3],[2,3],[3,4],[0,5],[4,5],[1,6],[2,6],[3,6]],
	"116":[[2,0],[2,1],[1,2],[2,2],[3,2],[2,3],[2,4],[2,5],[3,6],[4,6]],
	"117":[[0,1],[4,1],[0,2],[4,2],[0,3],[4,3],[0,4],[4,4],[0,5],[3,5],[4,5],[1,6],[2,6],[4,6]],
	"118":[[0,1],[4,1],[0,2],[4,2],[1,3],[3,3],[1,4],[3,4],[2,5],[2,6]],
	"119":[[0,1],[2,1],[4,1],[0,2],[2,2],[4,2],[0,3],[2,3],[4,3],[1,4],[3,4],[1,5],[3,5],[1,6],[3,6]],
	"120":[[0,1],[4,1],[1,2],[3,2],[2,3],[2,4],[1,5],[3,5],[0,6],[4,6]],
	"121":[[0,1],[4,1],[0,2],[4,2],[1,3],[3,3],[2,4],[2,5],[0,6],[1,6]],
	"122":[[0,1],[1,1],[2,1],[3,1],[4,1],[4,2],[3,3],[2,4],[1,5],[0,6],[1,6],[2,6],[3,6],[4,6]],
	"123":[[1,0],[2,0],[3,0],[1,1],[1,2],[0,3],[1,3],[1,4],[1,5],[1,6],[2,6],[3,6]],
	"124":[[2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6]],
	"125":[[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[4,3],[3,4],[3,5],[1,6],[2,6],[3,6]],
	"126":[[1,2],[4,2],[0,3],[2,3],[4,3],[0,4],[3,4]],
	"176":[[1,0],[2,0],[0,1],[3,1],[0,2],[3,2],[1,3],[2,3]],
	"223":[[1,0],[2,0],[0,1],[3,1],[0,2],[3,2],[0,3],[2,3],[3,3],[0,4],[4,4],[0,5],[4,5],[0,6],[2,6],[3,6]]
};

font['icon'] = {
	"arrow_up" : [
		[9,0],[8,1],[9,1],[10,1],[7,2],
		[8,2],[10,2],[11,2],[6,3],[7,3],
		[11,3],[12,3],[5,4],[6,4],[12,4],
		[13,4],[4,5],[5,5],[13,5],[14,5],
		[3,6],[4,6],[14,6],[15,6],[2,7],
		[3,7],[15,7],[16,7],[1,8],[2,8],
		[16,8],[17,8],[0,9],[1,9],[17,9],
		[18,9],[0,10],[18,10]
	],
	"arrow_down": [
		[0,0],[18,0],[0,1],[1,1],[17,1],
		[18,1],[1,2],[2,2],[16,2],[17,2],
		[2,3],[3,3],[15,3],[16,3],[3,4],
		[4,4],[14,4],[15,4],[4,5],[5,5],
		[13,5],[14,5],[5,6],[6,6],[12,6],
		[13,6],[6,7],[7,7],[11,7],[12,7],
		[7,8],[8,8],[10,8],[11,8],[8,9],
		[9,9],[10,9],[9,10]
	],
	"play": [
		[0,0],[0,1],[1,1],[0,2],[1,2],
		[2,2],[0,3],[1,3],[2,3],[3,3],
		[0,4],[1,4],[2,4],[3,4],[0,5],
		[1,5],[2,5],[0,6],[1,6],[0,7]
	]
};

function image(width,height) {
	var self = this;

	self.lastUpdate = Date.now();
	self.width  = width;
	self.height = height;
	self.canvas = [];
	self.lastBackgroundColor = self.rgb(0,0,0);

	for (var y = 0; y < self.height; y++) {
		var buf = new Buffer(self.width * 3); // * 3 for RGB.
		self.canvas.push(buf);
	}

	return self;
}

image.prototype.backgroundColor = function(backgroundColor) {
	var self = this;
	self.lastBackgroundColor = backgroundColor;

	for (var y = 0; y < self.height; y++) {
		for (var x = 0; x < self.width; x++) {
			self.pixel(x,y,backgroundColor);
		}
	}

	return true;
};

image.prototype.pixel = function (x, y, color) {
	var self = this;

	if (x >= self.width)  return;
	if (y >= self.height) return;

	var line = self.canvas[y];
	line.writeUIntBE(color, x * 3, 3);

	self.lastUpdate = Date.now();

	return true;
};

image.prototype.horizontalLine = function (y, color) {
	var self = this;

	for (var x = 0; x < self.width; x++) {
		self.pixel(x,y,color);
	}

	return true;
};

image.prototype.verticalLine = function (x, color) {
	var self = this;

	for (var y = 0; y < self.height; y++) {
		self.pixel(x,y,color);
	}

	return true;
};

image.prototype.boxFilled = function (x1,y1,x2,y2,color) {
	var self = this;

	for (var y = y1; y <= y2; y++) {
		for (var x = x1; x <= x2; x++) {
			self.pixel(x,y,color);
		}
	}

	return true;
};

image.prototype.boxLine = function (x1,y1,x2,y2,color) {
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

image.prototype.rgb = function (r,g,b) {
	var self = this;

	return (
		((r & 0xff) << 16) |
		((g & 0xff) << 8) |
		(b & 0xff)
	);
};

image.prototype.drawFromPNG = function(file,xStart,yStart) {
	var self = this;
	var data = fs.readFileSync(file);
	var png = PNG.sync.read(data);

	for (var y = 0; y < png.height && y < self.height - yStart; y++) {
		for (var x = 0; x < png.width && x < self.width - xStart; x++) {
			var idx = (png.width * y + x) << 2;
			var r = png.data[idx];
			var g = png.data[idx+1];
			var b = png.data[idx+2];

			// added ultracheap support for png transparency (only 100% transparent)
			if (png.data[idx+3] != 0) {
				self.pixel(xStart + x, yStart + y, self.rgb(r,g,b));
			}
		}
	}
};

image.prototype.drawText = function(x,y,text,color,fontindex,spacing, double, dummy) {
	var self = this;

	if (text === undefined || text.length == 0) return 0;

	if (spacing === undefined) {
		spacing = 2;
	}
	if (double === undefined) {
		double = false;
	}

	var chars = text.split("");
	var max_x = 0;
	var x_pos = 0;
	var y_pos = y;
	var just_wrapped = true;

	for (var i in chars) {

		if ((x+x_pos > self.width - (double ? 16 : 8)) && dummy != true ) {
			x_pos = 0;
			y_pos += (double ? 18 : 9);
			just_wrapped = true;
		}
		if (!(chars[i] == " " && just_wrapped == true)) {
			x_pos += (double ? 4 : 2) + self.drawLetter(x+x_pos,y_pos,chars[i],color,fontindex,double, dummy);
		}
		just_wrapped = false;
		if (x_pos > max_x) max_x = x_pos;
	}

	return max_x;
};

image.prototype.drawTextLine = function(x,y,text,color,fontindex,spacing, double, dummy) {
	var self = this;

	if (text === undefined || text.length == 0) return 0;

	if (spacing === undefined) {
		spacing = 2;
	}
	if (double === undefined) {
		double = false;
	}

	var chars = text.split("");
	var max_x = 0;
	var x_pos = 0;
	var y_pos = y;


	for (var i in chars) {
			x_pos += (i ? (double ? spacing*2 : spacing):0) + self.drawLetter(x+x_pos,y_pos,chars[i],color,fontindex,double, dummy);

		if (x_pos > max_x) max_x = x_pos;
	}

	return max_x;
};

// TODO: there is something TOTALLY fuckedup with this library. Rewrite pending!

image.prototype.drawCenterText = function(x,y,text,color,fontindex,spacing, double) {
	var self = this;
	var xCenter = x;
	var maxWidth = x * 2; // maximum line width is only correct if text center position is left of image center
	if (maxWidth > self.width) maxWidth = (self.width - x) * 2; // correction of line width if text center is right of image center
	var displayText = text.match(/^\s*(.*?)\s*$/)[1]; // remove leading and trailing spaces for display
	// do we have more then one line?
	var xSize = self.drawText(0,0,displayText,color,fontindex,spacing, double, true)
	if (xSize > maxWidth) {
		// breakup text in pieces
		//const breakChars = '\s-~,';
		var breakPos = [0];
		var lastBreakPos = 0;
		var lineWidth = 0;
		for (var i=0; i< displayText.length; i++) {
				if (displayText.charCodeAt(i) == 32 || displayText.charCodeAt(i) == 45 || displayText.charCodeAt(i) == 95 || displayText.charCodeAt(i) == 58 || displayText.charCodeAt(i) == 126 ) {
					lastBreakPos = i; // remember the latest position where break is possible
				}
				if (self.drawText(0,0,displayText.substr(breakPos[breakPos.length - 1], i+1),color,fontindex,spacing, double, true) > maxWidth) {
					if (lastBreakPos > 0) { // if line is getting too long and there was a good wrap position, wrap it at that position
						if (displayText.charCodeAt(lastBreakPos) == 32) { // if the break position was a space we want to get rid of it
							displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 1);
						} else {
							if (i - lastBreakPos > 0) lastBreakPos += 1; // if we can afford we want to have the breaking charakter in the top line, otherwise it gets wrapped (ugly, but better for space usage)
						}
						breakPos.push(lastBreakPos);
					} else {
						breakPos.push(i-1); // if there has been no good break position, just wrap it anyway
						lastBreakPos = 0;
					}
				}
		}

		breakPos.push(displayText.length);

		for (var lines = 1; lines < breakPos.length; lines++) {
			xSize = self.drawText(0,0,displayText.substr(breakPos[lines - 1], breakPos[lines]),color,fontindex,spacing, double, true)
			var xStart = (parseInt(xCenter - xSize/2 ));
			var yStart = y - parseInt(((breakPos.length - 1) * (double ? 14 : 7) + (breakPos.length - 2) * (double ? 4 : 2))/2) + (lines-1)*(double ? 18 : 9);
			self.drawText( xStart, yStart, displayText.substr(breakPos[lines - 1], breakPos[lines]),color,fontindex,spacing, double);
		}

	} else {
		// just draw one line
		var xStart = (parseInt(xCenter - xSize/2 ));
		return self.drawText( xStart, y-(double ? 7 : 4), displayText, color, fontindex, spacing, double);
	}
};

/*
	Draws aligned text in an boxed area.
	int x: bounding box top left horizontal value
	int y: bounding box top left vertical value
	int w: bounding box width
	int h: bounding box height
	string text: the text to drawBank
	rgb-array color: color of the text
	string fontindex: index of font, either 'icon' or something else
	int size: font size multiplier
	string halign: horizontal alignment left, center, right
	string valign: vertical alignment top, center, bottom

	returns true if text fits
*/
image.prototype.drawAlignedText = function(x = 0, y = 0, w = 72, h = 72, text, color = rgb(255,255,255), fontindex = '', spacing = 2, size = 1, halign = 'center', valign = 'center') {
	var self = this;
	var textFits = true;
	var double;
	if (size == 2)
		double = true;
		else
		double = false;

	var displayText = text.match(/^\s*(.*?)\s*$/)[1]; // remove leading and trailing spaces for display

	var xSize = self.drawTextLine(0,0,displayText,color,fontindex,spacing, double, true)

	// breakup text in pieces
	var breakPos = [0];
	var lastBreakPos = 0;
	var lineWidth = 0;
	for (var i=0; i< displayText.length; i++) {
			if (displayText.charCodeAt(i) == 32 || displayText.charCodeAt(i) == 45 || displayText.charCodeAt(i) == 95 || displayText.charCodeAt(i) == 58 || displayText.charCodeAt(i) == 126 ) {
				lastBreakPos = i; // remember the latest position where break is possible
			}
			// Support \n as line breaker
			if (displayText.substr(i, 2) == '\\n') {
				lastBreakPos = i;
				displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 2);
				i--;
				breakPos.push(lastBreakPos);
				lastBreakPos = 0;
			}
			if (self.drawTextLine(0,0,displayText.slice(breakPos[breakPos.length - 1], i+1),color,fontindex,spacing, double, true) > w) {
				if (lastBreakPos > 0) { // if line is getting too long and there was a good wrap position, wrap it at that position
					if (displayText.charCodeAt(lastBreakPos) == 32) { // if the break position was a space we want to get rid of it
						displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 1);
						i--;
					} else {
						if ((i - lastBreakPos) > 0) lastBreakPos += 1; // if we can afford we want to have the breaking charakter in the top line, otherwise it gets wrapped (ugly, but better for space usage)
					}
					breakPos.push(lastBreakPos);
					lastBreakPos = 0;
				} else {
					breakPos.push(i); // if there has been no good break position, just wrap it anyway
					lastBreakPos = 0;
				}
			}
	}

	breakPos.push(displayText.length);

	var lines = breakPos.length -1;
	if ((lines * (double ? 14 : 7) + (lines-1) * (double ? 4 : 2))> h) {
		lines = parseInt( (h + (double ? 4 : 2))/ (double ? 18 : 9));
		textFits = false;
	}
	if (lines == 0) return false;

	for (var line = 1; line <= lines; line++) {
		xSize = self.drawTextLine(0,0,displayText.slice(breakPos[line - 1], breakPos[line]),color,fontindex,spacing, double, true)
		var xStart, yStart;
		switch (halign){
			case 'left': xStart = x; break;
			case 'center': xStart = (x + parseInt((w - xSize)/2 )); break;
			case 'right': xStart = x + w - xSize; break;
		}
		switch (valign) {
			case 'top': yStart = y + + (line-1)*(double ? 18 : 9); break;
			case 'center': yStart = y + parseInt((h-(lines * (double ? 14 : 7) + (lines - 1) * (double ? 4 : 2))) /2) + (line-1) * (double ? 18 : 9); break;
			case 'bottom': yStart = y + h - (lines - line + 1) * (double ? 18 : 9); break;
		}
		var linetext = displayText.slice(breakPos[line-1], breakPos[line]);
		self.drawTextLine( xStart, yStart, linetext, color, fontindex, spacing, double);
	}

	return textFits;
};

image.prototype.drawLetter = function(x,y,letter,color,fontindex,double,dummy) {
	var self = this;

	if (double === undefined) double = false;
	if (letter === undefined || ((letter.length > 1 || letter.length == 0) && letter == 'icon')) return 0;

	// dummy is for not drawing any actual pixels. just calculate the font size
	if (dummy === undefined) dummy = false;

	var num;

	if (fontindex !== 'icon') {
		num = letter.charCodeAt(0);
	}
	else {
		num = letter;
	}

	if (num == 32 || num == 160) return 2;	// return blanks for space
	if (font[fontindex] === undefined) return 0;

	if (font[fontindex][num] === undefined) {
		debug("trying to draw a character that doesnt exist in the font:", num, letter);
		return 0;
	}

	var gfx = font[fontindex][num];
	var maxX = 0;

	for (var pixel in gfx) {

		if (double == true) {
			if (gfx[pixel][0]*2 > maxX) maxX = gfx[pixel][0]*2;
			if (dummy == false) {
				self.pixel(x + (gfx[pixel][0]*2), y + (gfx[pixel][1]*2), color);
				self.pixel(x + (gfx[pixel][0]*2) + 1, y + (gfx[pixel][1]*2), color);
				self.pixel(x + (gfx[pixel][0]*2), y + (gfx[pixel][1]*2) + 1, color);
				self.pixel(x + (gfx[pixel][0]*2) + 1, y + (gfx[pixel][1]*2) + 1, color);
			}
		}

		else {
			if (gfx[pixel][0] > maxX) maxX = gfx[pixel][0];
			if (dummy == false) self.pixel(x + gfx[pixel][0], y + gfx[pixel][1], color);
		}

	}

	if (num == 46) return 2;	// return blanks for space (both for double or not)

	return maxX;
};


image.prototype.buffer = function() {
	var self = this;
	return Buffer.concat(self.canvas);
}

image.prototype.bufferAndTime = function () {
	var self = this;

	return { updated: self.lastUpdate, buffer: self.buffer() };
}

image.rgb = image.prototype.rgb;
exports = module.exports = image;
