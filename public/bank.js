
var socket = new io();
var image_cache = {};

function int2hex(number) {
	var r = ('0' + ((number >> 16) & 0xff).toString('16')).substr(-2);
	var g = ('0' + ((number >> 8) & 0xff).toString('16')).substr(-2);
	var b = ('0' + (number & 0xff).toString('16')).substr(-2);

	return '#' + r + g + b;
}

function hex2int(hex) {
	return parseInt(hex.substr(1), 16);
}

var page = 1;
var bank = undefined;


$(function() {
	var $pagenav = $("#pagenav");
	var $pagebank = $("#pagebank");
	var pc = $('#bank_preview canvas')[0].getContext('2d');

	$("#editbankli").hide();

	var colors = [
		"#000000",
		"#FFFFFF",
		"#003366",
		"#336699",
		"#3366CC",
		"#003399",
		"#000099",
		"#0000CC",
		"#000066",
		"#006666",
		"#006699",
		"#0099CC",
		"#0066CC",
		"#0033CC",
		"#0000FF",
		"#3333FF",
		"#333399",
		"#669999",
		"#009999",
		"#33CCCC",
		"#00CCFF",
		"#0099FF",
		"#0066FF",
		"#3366FF",
		"#3333CC",
		"#666699",
		"#339966",
		"#00CC99",
		"#00FFCC",
		"#00FFFF",
		"#33CCFF",
		"#3399FF",
		"#6699FF",
		"#6666FF",
		"#6600FF",
		"#6600CC",
		"#339933",
		"#00CC66",
		"#00FF99",
		"#66FFCC",
		"#66FFFF",
		"#66CCFF",
		"#99CCFF",
		"#9999FF",
		"#9966FF",
		"#9933FF",
		"#9900FF",
		"#006600",
		"#00CC00",
		"#00FF00",
		"#66FF99",
		"#99FFCC",
		"#CCFFFF",
		"#CCCCFF",
		"#CC99FF",
		"#CC66FF",
		"#CC33FF",
		"#CC00FF",
		"#9900CC",
		"#003300",
		"#009933",
		"#33CC33",
		"#66FF66",
		"#99FF99",
		"#CCFFCC",
		"#FFCCFF",
		"#FF99FF",
		"#FF66FF",
		"#FF00FF",
		"#CC00CC",
		"#660066",
		"#336600",
		"#009900",
		"#66FF33",
		"#99FF66",
		"#CCFF99",
		"#FFFFCC",
		"#FFCCCC",
		"#FF99CC",
		"#FF66CC",
		"#FF33CC",
		"#CC0099",
		"#993399",
		"#333300",
		"#669900",
		"#99FF33",
		"#CCFF66",
		"#FFFF99",
		"#FFCC99",
		"#FF9999",
		"#FF6699",
		"#FF3399",
		"#CC3399",
		"#990099",
		"#666633",
		"#99CC00",
		"#CCFF33",
		"#FFFF66",
		"#FFCC66",
		"#FF9966",
		"#FF6666",
		"#FF0066",
		"#CC6699",
		"#993366",
		"#999966",
		"#CCCC00",
		"#FFFF00",
		"#FFCC00",
		"#FF9933",
		"#FF6600",
		"#FF5050",
		"#CC0066",
		"#660033",
		"#996633",
		"#CC9900",
		"#FF9900",
		"#CC6600",
		"#FF3300",
		"#FF0000",
		"#CC0000",
		"#990033",
		"#663300",
		"#996600",
		"#CC3300",
		"#993300",
		"#990000",
		"#800000",
		"#993333"
	];

	function bank_preview_page(_page) {
		var cachedata = {};
		for (var _bank = 1; _bank <= 12; ++_bank) {
			if (image_cache[_page + '_' + _bank] !== undefined) {
				cachedata[_bank] = image_cache[_page + '_' + _bank].updated;
			}
		}

		socket.emit('bank_preview_page', _page, cachedata);
	}

	function bank_preview_reset() {
		pc.fillStyle = 'black';
		pc.fillRect(0,0,72,72);
	}

	function updateFromConfig(page, bank, config, updateText) {
		$('.active_field[data-special="color"]').removeClass('active_color');

		$(".active_field").each(function() {
			if ($(this).data('fieldid') !== undefined && config[$(this).data('fieldid')] !== undefined) {

				if ($(this).data('special') == 'color') {
					if ($(this).data('color').toLowerCase() == int2hex( config[$(this).data('fieldid')] )) {
						$(this).addClass('active_color');
					}
				}
				else {
					if (updateText) {
						$(this).val(config[$(this).data('fieldid')]);
					}
				}
			}
		});
	}

	function populate_bank_form(p,b,config,fields) {
		var $eb1 = $("#editbank_content");
		$eb1.html("<p><h3>Configuration</h3></p>");
		var $eb = $("<div class='row'></div>");
		$eb1.append($eb);

		bank_preview_reset();

		socket.emit('bank_preview', p, b);

		// globalize those!
		page = p;
		bank = b;

		for (var n in fields) {

			var field = fields[n];
			var $field = $("<div class='col-sm-"+field.width+"'></div>");

			if (field.type == 'textinput') {

				var $p = $("<p><label>"+field.label+"</label><br><input type='text' data-fieldid='"+field.id+"' class='form-control active_field'></p>");
				$field.append($p);

			}

			else if (field.type == 'colorpicker') {

				var $p = $("<p><label>"+field.label+"</label><br></p>");
				var $div = $("<div class='colorcontainer' data-fieldid='"+field.id+"' style='height:20px;'></div>");

				for (var n in colors) {
					var $c = $("<div class='colorblock' data-special='color' data-color='"+colors[n]+"' data-fieldid='"+field.id+"'></div>");

					$c.css('backgroundColor', colors[n]);
					$c.css('width', 18);
					$c.css('height', 18);
					$c.addClass('colorbox');
					$c.addClass('active_field');
					$c.css('float','left');
					$div.append($c)
				}

				$p.append($div);

				$field.append($p);
				$('#auto_'+field.id).colorpicker();

			}

			else if (field.type == 'filepicker') {

				var $p = $("<p><label>"+field.label+"</label><br></p>");
				var $div = $("<div class='filechoosercontainer'><label class='btn btn-primary btn-file'>Browse <input type='file' data-fieldid='"+field.id+"' accept='" + field.accept + "' style='display: none;'></label></div>");

				$p.append($div);
				$field.append($p);

				$field.find('input[type="file"]').change(function (e) {
					checkImageSize(this, 72, 58, 72, 58, function (dataurl) {
						socket.emit('bank_set_png', p, b, dataurl);
						socket.once('bank_set_png:result', function (result) {
							if (result != 'ok') {
								alert('An error occured while uploading image');
							} else {
								bank_preview_page(p);
							}
						});
					}, function () {
						alert('Image must have the following dimensions: 72x58');
					});
				});
			}
			$eb.append($field);

		}

		updateFromConfig(page, bank, config, true);

		var change = function() {
			if ($(this).data('special') == 'color') {
				socket.emit('bank_changefield', p, b, $(this).data('fieldid'), hex2int( $(this).data('color') ) );
				socket.emit('get_bank', page, bank);
				socket.once('get_bank:results', updateFromConfig);
			}
			else {
				socket.emit('bank_changefield', p, b, $(this).data('fieldid'), $(this).val() );
			}

			// update page editor too
			bank_preview_page(page);
		}

		$(".active_field").keyup(change);
		$(".active_field[data-special=\"color\"]").click(change);

	}

	$(".change_style").click(function() {
		socket.emit('bank_style', page, bank, $(this).data('style'));
		socket.once('bank_style:results', populate_bank_form);
		socket.once('bank_style:results', function () {
			bank_preview_page(page);
		});
	});

	socket.on('preview_page_data', function (images) {
		for (var key = 1; key <= 12; ++key) {
			var imageData;

			if (images[key] === undefined) {
				imageData = dataToButtonImage(image_cache[page + '_' + key].buffer);
			} else {
				image_cache[page + '_' + key] = images[key];
				imageData = dataToButtonImage(images[key].buffer);
			}

			var $canvas = $('#bank_' + page + '_' + key);
			if ($canvas.length > 0) {
				var ctx = $canvas[0].getContext('2d');
				ctx.putImageData(imageData, 0, 0);
			}
		}
	});

	// to get the first page name
	socket.once('get_page_all', function(config) {
		changePage(page);
	});

	function changePage(pagenum) {

		$pagenav.html("");
		$pagebank.html("");

		var pname = "";

		if (page_info !== undefined && page_info[page] !== undefined) {
			pname = page_info[page].name;
		}

		$pagenav.append($('<div class="pagenav col-lg-4"><div id="btn_pagedown" class="btn btn-primary">Page down</div></div>'));
		$pagenav.append($('<div class="pageat col-lg-4"><input id="page_title" placeholder="Page name" type="text" class="form-control" value="'+ pname +'"></div>'));
		$pagenav.append($('<div class="pagenav text-right col-lg-4"><div id="btn_pageup" class="btn btn-primary">Page up</div></div>'));

		for (var bank = 1; bank <= 12; bank++) {
			var $div = $('<div class="bank col-lg-3"><div class="border" data-bank="'+bank+'"><canvas width=72 height=72 id="bank_' + page + '_' + bank + '"</div></div>');
			$pagebank.append($div);
		}

		bank_preview_page(pagenum);

		$('a.nav-link').click(function() {
			if ($(this).attr('href') !== '#editbank' && $(this).attr('href') !== '#log') {
				$("#editbankli").hide();
				socket.emit('bank_preview', false);
			}
		})




		$("#pagebank .border").click(function() {
			bank = $(this).data('bank');

			$("#editbankli").show();
			$('#editbankli a[href="#editbank"]').tab('show');
			$("#editbank_content").html("");
			$("#editbankid").text(page + "." + $(this).data('bank'));
			socket.emit('bank_getActions', page, $(this).data('bank'));
			socket.emit('get_bank',page, $(this).data('bank'));
			socket.once('get_bank:results', populate_bank_form);
		});

		$("#btn_pageup").click(function() {
			page++;
			if (page == 100) { page = 1 }
			changePage(page);
		});

		$("#btn_pagedown").click(function() {
			page--;
			if (page == 0) { page = 99 }
			changePage(page);
		});

	}

	changePage(page);

	socket.on('preview_bank_data', function (page, bank, data) {
		var imageData = dataToButtonImage(data);
		pc.putImageData(imageData, 0, 0);
	});
});
