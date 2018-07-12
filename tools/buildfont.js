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
 
var fs = require('fs');
var PNG = require('pngjs').PNG;
var font = {};

fs.readdir(".", function(err, items) {
		console.log(items);

		for (var i=0; i<items.length; i++) {
			if (items[i].match(/\.png$/)) {
				var file = items[i];
				var num = items[i].split(/\./);
				var asc = num[0];
				console.log("file", file);
				var data = fs.readFileSync(file);
				var png = PNG.sync.read(data);
				var dots = [];

				for (var y = 0; y < png.height; y++) {
					for (var x = 0; x < png.width; x++) {
						var idx = (png.width * y + x) << 2;
						if (png.data[idx+3] > 128) {
							dots.push([x,y]);
						}
					}
				}
				font['' + asc] = dots;
			}
		}

		fs.writeFile('font.txt', JSON.stringify(font).replace(/"(\d+)"/g, '\n\t"$1"'), (err) => {
			if (err) throw err;
			console.log('The font has been saved to font.txt');
		});
//		console.log(JSON.stringify(font).replace(/"(\d+)"/g, '\n\t"$1"'));

});
