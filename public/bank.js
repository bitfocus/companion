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

var socket = new io();
var image_cache = {};
var buttons_hot = false;
var buttons_functional = false;

var function_state = null;
var function_detail = {};

function int2hex(number) {
	var r = ('0' + ((number >> 16) & 0xff).toString('16')).substr(-2);
	var g = ('0' + ((number >> 8) & 0xff).toString('16')).substr(-2);
	var b = ('0' + (number & 0xff).toString('16')).substr(-2);

	return '#' + r + g + b;
}

function replaceUnicode(str) {
	if (typeof str == 'string') {
		var match, reg = /&#(\d+);/g;

		while ((match = reg.exec(str)) !== null) {
			if (match[1] !== undefined) {
				str = str.replace('&#' + match[1] + ';', String.fromCodePoint(parseInt(match[1])));
				reg.lastIndex = 0;
			}
		}
	}
	return str;
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
		$('.active_field[data-special="alignment"]').removeClass('active_color');

		$(".active_field").each(function() {
			if ($(this).data('fieldid') !== undefined && config[$(this).data('fieldid')] !== undefined) {

				if ($(this).data('special') == 'color') {
					$(this).spectrum("set", int2hex( config[$(this).data('fieldid')] ));

				} else if ($(this).data('special') == 'dropdown') {

					$(this).find('option[value="' + config[$(this).data('fieldid')] + '"]').prop('selected', true);

				} else if ($(this).data('special') == 'checkbox') {

					$(this).prop('checked', config[$(this).data('fieldid')]);

				} else if ($(this).data('special') == 'alignment') {

					if ($(this).data('alignment') == config[$(this).data('fieldid')] ) {
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

		if (config.style !== undefined) {
			$("#resetBankButton").show();
		}

		$("#oscTips").html("<p><b>Hint:</b> Control buttons with OSC or HTTP: /press/bank/"+p+"/"+b+" to press this button remotely. OSC port 12321!</p>")

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

				var $p = $("<p><label>"+field.label+"</label><br><input type='text' value='" + field.default + "' data-fieldid='"+field.id+"' class='form-control active_field'></p>");
				$field.append($p);

			}

			else if (field.type == 'dropdown') {
				var $p = $("<p><label>"+field.label+"</label><br><select data-special='dropdown' data-fieldid='"+field.id+"' class='form-control active_field'></p>");
				var $select = $p.find('select');

				for (var i = 0; i < field.choices.length; ++i) {
					var extra = '';
					if (field.choices[i].id == field.default) {
						extra = ' SELECTED';
					}

					$select.append('<option value="' + field.choices[i].id + '"' + extra + '>' + field.choices[i].label);
				}

				$field.append($p);
			}

			else if (field.type == 'checkbox') {
				var $p = $("<p><label>"+field.label+"</label><br><input type='checkbox' data-special='checkbox' data-fieldid='"+field.id+"' class='form-control active_field'></p>");
				if (field.default) {
					$p.find('input').prop('checked', true);
				}
				$field.append($p);
			}

			else if (field.type == 'alignmentcontrol') {
				const alignurl = '"/img/alignment.png"';
				var $p = $("<p><label>"+field.label+"</label><br></p>");
				var $container = $("<div style='width: 60px; background-image: url("+ alignurl +"); background-repeat: no-repeat;'></div>");
				var $div = $("<div class='alignmentcontainer' data-fieldid='"+field.id+"' style='width: 60px; display: inline-block;'></div>");
				var alignments = ["left:top", "center:top", "right:top", "left:center", "center:center", "right:center", "left:bottom", "center:bottom", "right:bottom"];
				for (var n in alignments) {
					var $alg = $("<div class='alignment' data-special='alignment' data-alignment='"+alignments[n]+"' data-fieldid='"+field.id+"'></div>");
					$alg.css('backgroundColor', '#99999900');
					$alg.css('width', 18);
					$alg.css('height', 18);
					$alg.addClass('colorbox');
					$alg.addClass('active_field');
					$alg.css('float','left');

					$div.append($alg);
				}
				$container.append($div);
				$p.append($container);
				$field.append($p);

			}

			else if (field.type == 'colorpicker') {

				var $p = $("<p><label>"+field.label+"</label><br></p>");
				var $input = $("<input type='text' id='auto_"+field.id+"'>");
				$input.addClass('active_field');
				$input.data('special','color');
				$input.data('fieldid',field.id);

				$p.append($input);
				$field.append($p);
				(function(fval,fid) {
					$input.spectrum({
						color: fval,
						preferredFormat: "rgb",
						showInput: true,
						showPalette: true,
						palette: picker_colors,
						showButtons: false,
						change: function(color) {
							socket.emit('bank_changefield', p, b, fid, hex2int( color.toHexString() ) );
						},

						move: function(color) {
							socket.emit('bank_changefield', p, b, fid, hex2int( color.toHexString() ) );
						}
					});
				})(field.value, field.id);

			}

			else if (field.type == 'filepicker') {

				var $p = $("<p><label>"+field.label+"</label><br></p>");
				var $div = $("<div class='filechoosercontainer'><label class='btn btn-primary btn-file'>Browse <input type='file' data-fieldid='"+field.id+"' accept='" + field.accept + "' style='display: none;'></label></div>");

				$p.append($div);
				$field.append($p);

				$field.find('input[type="file"]').change(function (e) {
					var self = this;
					checkImageSize(this, field.imageMinWidth, field.imageMinHeight, field.imageMaxWidth, field.imageMaxHeight, function (dataurl) {
						// Reset file fields
						self.value = null;

						if (!dataurl.match(/image\/png/)) {
							alert('Image must be a valid PNG file');
							return;
						}

						socket.emit('bank_set_png', p, b, dataurl);
						socket.once('bank_set_png:result', function (result) {
							if (result != 'ok') {
								alert('An error occured while uploading image');
							} else {
								bank_preview_page(p);
							}
						});
					}, function () {
						alert('Image must have the following dimensions: ' + field.imageMaxWidth + 'x' + field.imageMaxHeight);

						// Reset file fields
						self.value = null;
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

			} else if ($(this).data('special') == 'checkbox') {
				socket.emit('bank_changefield', p, b, $(this).data('fieldid'), $(this).prop('checked') );
				socket.emit('get_bank', page, bank);
				socket.once('get_bank:results', updateFromConfig);

			} else if ($(this).data('special') == 'dropdown') {
				socket.emit('bank_changefield', p, b, $(this).data('fieldid'), $(this).val() );
				socket.emit('get_bank', page, bank);
				socket.once('get_bank:results', updateFromConfig);

			} else if ($(this).data('special') == 'alignment') {
				socket.emit('bank_changefield', p, b, $(this).data('fieldid'), $(this).data('alignment') );
				socket.emit('get_bank', page, bank);
				socket.once('get_bank:results', updateFromConfig);

			} else {
				// Custom unicode un-escaping in text field
				if ($(this).data('fieldid') == 'text') {
					$(this).val(replaceUnicode($(this).val()));
				}

				socket.emit('bank_changefield', p, b, $(this).data('fieldid'), $(this).val() );
			}

			// update page editor too
			bank_preview_page(page);
		}

		$(".active_field").keyup(change);
		$(".active_field[data-special=\"dropdown\"]").change(change);
		$(".active_field[data-special=\"checkbox\"]").change(change);
		$(".active_field[data-special=\"color\"]").click(change);
		$(".active_field[data-special=\"alignment\"]").click(change);

	}

	$(window).keyup(function(e) {
		if (e.keyCode == 16) {
			buttons_hot = false;
			$(".border").removeClass('bank-armed');
			$('#functionkeys').slideDown(80);
			console.log('disarmed');
		}
	});

	$(window).keydown(function(e) {
		if (e.keyCode == 16 && function_state === null) {
			buttons_hot = true;
			$(".border").addClass('bank-armed');
			$('#functionkeys').slideUp(80);
			console.log("buttons hot!")
		}
	})


	$(".change_style").click(function() {
		socket.emit('bank_style', page, bank, $(this).data('style'));
		socket.once('bank_style:results', populate_bank_form);
		socket.once('bank_style:results', function () {
			bank_preview_page(page);
		});
	});

	$("#resetBankButton").click(function() {
		if (confirm('Clear design and all actions?')) {
			socket.emit('reset_bank', page, bank);
			socket.emit('bank_get_actions', page, bank);
			socket.emit('bank_get_feedbacks', page, bank);
			socket.emit('bank_reset_release_actions', page, bank);
			socket.emit('bank_get_release_actions', page, bank);

			$("#resetBankButton").hide();
			populate_bank_form(page,bank,{},{});
			bank_preview_page(page);
		}
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

	$('a.nav-link').click(function() {
		if ($(this).attr('href') !== '#editbank' && $(this).attr('href') !== '#log') {
			$("#editbankli").hide();
			socket.emit('bank_preview', false);
		}
	});


	$('#erase_page_link').click(function () {
		if (confirm('Are you sure you want to clear all buttons on page ' + page + '?')) {
			socket.emit('loadsave_reset_page', page);
		}
	});

	$('#state_copy').click(function() {
		if (function_state === null) {
			function_state = 'copy';
		}

		renderFunctionArea();
	});

	$('#state_move').click(function() {
		if (function_state === null) {
			function_state = 'move';
		}

		renderFunctionArea();
	});

	$('#state_delete').click(function() {
		if (function_state === null) {
			function_state = 'delete';
		}

		renderFunctionArea();
	});

	$('#state_abort').click(function() {
		clearFunction();
	});


	function clearFunction() {
		function_detail = {};
		function_state = null;
		renderFunctionArea();
	}


	function executeFunctionArea() {

		if (function_state !== null) {

			if (function_state === 'copy') {
				if (function_detail.second !== undefined) {
					socket.emit('bank_copy', function_detail.first.page, function_detail.first.bank, function_detail.second.page, function_detail.second.bank);
					socket.once('bank_copy:result', function () {
						// TODO
					});
					clearFunction();
				}
			}

			else if (function_state === 'move') {
				console.log("move");
				if (function_detail.second !== undefined) {
					socket.emit('bank_move', function_detail.first.page, function_detail.first.bank, function_detail.second.page, function_detail.second.bank);
					socket.once('bank_move:result', function () {
						// TODO
					});
					clearFunction();
				}
			}
			else if (function_state === 'delete') {
				if (function_detail.first !== undefined) {
					if (confirm("Clear style and actions for this button?")) {
						socket.emit('reset_bank', function_detail.first.page, function_detail.first.bank);
						socket.emit('bank_get_actions', function_detail.first.page, function_detail.first.bank );
						socket.emit('bank_reset_release_actions', function_detail.first.page, function_detail.first.bank );
						socket.emit('bank_get_release_actions', function_detail.first.page, function_detail.first.bank );
						bank_preview_page(page);
					}
					clearFunction();
				}
			}

		}

	}

	function renderFunctionArea() {
		var $sc = $('#state_copy');
		var $sm = $('#state_move');
		var $sd = $('#state_delete');
		var $sa = $('#state_abort');
		var $sh = $('#state_hint');
		var $cb = $('#state_' + function_state);

		if (function_state !== null) {
			$('#state_hide').hide();
			$('.function-button').removeClass('btn-primary').addClass('btn-disabled');
			$cb.addClass('btn-success');
			$sa.show();

			if (function_state == 'copy') {
				if (function_detail.first === undefined) {
					$sh.text("Press the button you want to copy");
				}
				else if (function_detail.second === undefined) {
					$sh.text("Where do you want it?");
				}
			}

			else if (function_state == 'move') {
				if (function_detail.first === undefined) {
					$sh.text("Press the button you want to move");
				}
				else if (function_detail.second === undefined) {
					$sh.text("Where do you want it?");
				}
			}

			else if (function_state == 'delete') {
				$sh.text("Press the button you want to delete");
			}

		} else {
			$('#state_hide').fadeIn();
			$('.function-button').removeClass('btn-disabled').removeClass('btn-success').addClass('btn-primary');
			$sa.hide();
			$sh.text("");
		}

	}

	renderFunctionArea();



	$(document).keyup(function(e) {

		// grab escape key keypresses
		if (e.keyCode == 27) {
			console.log("ESC");
		}

	});


	function changePage(pagenum) {

		$pagenav.html("");
		$pagebank.html("");

		$('#import_page').text('Import to page ' + pagenum).data('page', pagenum);

		var pname = "";

		if (page_info !== undefined && page_info[page] !== undefined) {
			pname = page_info[page].name;
		}

		$('#export_page_link').attr('href', '/int/page_export/' + page);

		$pagenav.append($('<div class="pagenav col-lg-4"><div id="btn_pagedown" class="btn btn-primary"><i class="fa fa-chevron-left"></i></div></div>'));
		$pagenav.append($('<div class="pageat col-lg-4"><small>(Page '+page+')</small> <input id="page_title" placeholder="Page name" type="text" value="'+ pname +'"></div>'));
		$pagenav.append($('<div class="pagenav text-right col-lg-4"><div id="btn_pageup" class="btn btn-primary"><i class="fa fa-chevron-right"></i></div></div>'));

		for (var bank = 1; bank <= 12; bank++) {
			var $div = $('<div class="bank col-lg-3"><div class="border" data-bank="' + bank + '" data-page="' + page + '"><canvas width=72 height=72 id="bank_' + page + '_' + bank + '"></canvas></div></div>');
			$div.find('.border').droppable({
				activeClass: 'drophere',
				hoverClass: 'drophover',
				accept: '.presetbank',
				receiveHandler: function (info) {
					var $source = $(info.item);
					var $dest = $(this);

					var topage = $dest.data('page');
					var tobank = $dest.data('bank');

					socket.emit('preset_drop', $source.data('instance'), all_presets[$source.data('instance')][$source.data('key')], topage, tobank);
				}
			});
			$pagebank.append($div);
		}

		bank_preview_page(pagenum);


		$("#pagebank .border").mousedown(function() {
			bank = $(this).data('bank');
			if (buttons_hot) {
				socket.emit('hot_press', page, $(this).data('bank'), true);
			}
		});

		$("#pagebank .border").mouseup(function() {
			bank = $(this).data('bank');
			if (buttons_hot) {
				socket.emit('hot_press', page, $(this).data('bank'), false);
			}
		});

		$("#pagebank .border").click(function() {
			bank = $(this).data('bank');
			if (buttons_hot) {}
			else if (function_state !== null) {
				var bank = $(this).data('bank')
				if (function_detail['first'] === undefined) {
					console.log("selecting",page,bank,"as first");
					function_detail['first'] = {
						page: page,
						bank: bank,
					};
				}
				else {
					console.log("selecting",page,bank,"as second");
					function_detail['second'] = {
						page: page,
						bank: bank,
					};
				}
				executeFunctionArea();
				renderFunctionArea();
			}

			else {
				$("#editbankli").show();
				$('#editbankli a[href="#editbank"]').tab('show');
				$("#editbank_content").html("");
				$("#editbankid").text(page + "." + $(this).data('bank'));
				socket.emit('bank_get_actions', page, $(this).data('bank'));
				socket.emit('bank_get_feedbacks', page, $(this).data('bank'));
				socket.emit('bank_get_release_actions', page, $(this).data('bank'));
				socket.emit('get_bank',page, $(this).data('bank'));
				socket.once('get_bank:results', populate_bank_form);
			}

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
