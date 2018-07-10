// Super primitive drawing library!

var fs = require('fs');
var PNG = require('pngjs').PNG;
var debug   = require('debug')('lib/image');
var font = require('./font')();

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
			var width = self.drawLetter(x+x_pos,y_pos,chars[i],color,fontindex,double, dummy);
			x_pos += width ? width :0;
			if (i < chars.length-1) {
				x_pos += width ? (double ? spacing*2 : spacing):0;
			}

		if (x_pos > max_x) max_x = x_pos;
	}

	return max_x;
};

// TODO: there is still something fuckedup with this library. Rewrite pending!

image.prototype.drawCenterText = function(x,y,text,color,fontindex,spacing, double) {
	var self = this;
	var xCenter = x;
	var maxWidth = x * 2; // maximum line width is only correct if text center position is left of image center
	if (maxWidth > self.width) maxWidth = (self.width - x) * 2; // correction of line width if text center is right of image center
	var displayText = text.trim();  // remove leading and trailing spaces for display
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
image.prototype.drawAlignedText = function(x = 0, y = 0, w = 72, h = 72, text, color = rgb(255,255,255), fontindex = '', spacing, size = 1, halign = 'center', valign = 'center') {
	var self = this;
	var textFits = true;
	var double;
	var lineheight = font[fontindex].lineheight;
	var linespacing = font[fontindex].linespacing;
	var charspacing

	if (spacing != undefined) {
		charspacing = spacing;
	} else {
		charspacing = font[fontindex].charspacing;
	}

	if (size == 2)
		double = true;
		else
		double = false;

	var displayText = text.trim(); // remove leading and trailing spaces for display

	var xSize = self.drawTextLine(0,0,displayText,color,fontindex,charspacing, double, true)

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
			if (self.drawTextLine(0,0,displayText.slice(breakPos[breakPos.length - 1], i+1),color,fontindex,charspacing, double, true) > w) {
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
	if ((lines * lineheight * (double ? 2 : 1) + (lines-1) * linespacing * (double ? 2 : 1))> h) {
		lines = parseInt( (h + linespacing * (double ? 2 : 1))/ ((lineheight + linespacing) * (double ? 2 : 1)) );
		textFits = false;
	}
	if (lines == 0) return false;

	for (var line = 1; line <= lines; line++) {
		xSize = self.drawTextLine(0,0,displayText.slice(breakPos[line - 1], breakPos[line]),color,fontindex,charspacing, double, true)
		var xStart, yStart;
		switch (halign){
			case 'left': xStart = x; break;
			case 'center': xStart = (x + parseInt((w - xSize)/2 )); break;
			case 'right': xStart = x + w - xSize; break;
		}
		switch (valign) {
			case 'top': yStart = y + (line-1) * (lineheight + linespacing) * (double ? 2 : 1); break;
			case 'center': yStart = y + parseInt((h-(lines * lineheight * (double ? 2 : 1) + (lines - 1) * linespacing * (double ? 2 : 1))) /2) + (line-1) * (lineheight + linespacing) * (double ? 2 : 1); break;
			case 'bottom': yStart = y + h - (lines - line + 1) * (lineheight + linespacing) * (double ? 2 : 1); break;
		}
		var linetext = displayText.slice(breakPos[line-1], breakPos[line]);
		self.drawTextLine( xStart, yStart, linetext, color, fontindex, charspacing, double);
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
			if ((gfx[pixel][0]+1)*2 > maxX) maxX = (gfx[pixel][0]+1)*2;
			if (dummy == false) {
				self.pixel(x + (gfx[pixel][0]*2), y + (gfx[pixel][1]*2), color);
				self.pixel(x + (gfx[pixel][0]*2) + 1, y + (gfx[pixel][1]*2), color);
				self.pixel(x + (gfx[pixel][0]*2), y + (gfx[pixel][1]*2) + 1, color);
				self.pixel(x + (gfx[pixel][0]*2) + 1, y + (gfx[pixel][1]*2) + 1, color);
			}
		}

		else {
			if (gfx[pixel][0]+1 > maxX) maxX = gfx[pixel][0]+1;
			if (dummy == false) self.pixel(x + gfx[pixel][0], y + gfx[pixel][1], color);
		}

	}

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
