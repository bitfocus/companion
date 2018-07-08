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
