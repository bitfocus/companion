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

var MAX_BUTTONS = 32;

var socket = new io();
var image_cache = {};
var buttons_hot = false;
var buttons_functional = false;
var current_style;
var function_state = null;
var function_detail = {};
var selected_bank = {};
var copyfrom = {};

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
var variables_autocomplete = undefined;


$(function() {
	var $pagenav = $("#pagenav");
	var $pagebank = $("#pagebank");
	var pc = $('#bank_preview canvas')[0].getContext('2d');

	$("#editbankli").hide();
	selected_bank = {};

	variables_autocomplete = new Tribute({
		values: [],
		trigger: '$(',

		// function called on select that returns the content to insert
		selectTemplate: function (item) {
		  return '$(' + item.original.value + ')';
		},
	  
		// template for displaying item in menu
		menuItemTemplate: function (item) {
		  return '<span class="var-name">' + item.original.value + '</span><span class="var-label">' + item.original.label + '</span>';
		},
	});

	function build_autocomplete_item(instance, item) {
		var variable_name = instance + ':' + item.name;
		return { key: variable_name + ')', value: variable_name, label: item.label };
	}

	// Listen on initial variable definitions broadcast
	socket.on('variable_instance_definitions_get:result', function (err, data) {
		if (data) {
			var auto_complete_list = [];
			for (var instance in data) {
				for (var index in data[instance]) {
					var item = build_autocomplete_item(instance, data[instance][index]);
					auto_complete_list.push(item);
				}
			}

			variables_autocomplete.append(0, auto_complete_list, true);
		}
	});

	// Listen on instance enable/disable events
	socket.on('variable_instance_definitions_set', function (instance, data) {
		if (instance && data) {
			var auto_complete_list = variables_autocomplete.collection[0].values;

			// remove existing variables of instance
			var index = 0;
			while (index < auto_complete_list.length) {
				if (auto_complete_list[index].value.startsWith(instance + ':')) {
					auto_complete_list.splice(index, 1);
				} else {
					index += 1;
				}
			}

			// add new variables
			for (var index in data) {
				var item = build_autocomplete_item(instance, data[index]);
				auto_complete_list.push(item);
			}
		}
	});

	function bank_preview_page(_page) {

		var cachedata = {};

		for (var _bank = 1; _bank <= MAX_BUTTONS; ++_bank) {
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

		if (config.style === 'png') {
			$('#clearPngButton')[0].disabled = config.png64 === undefined
		}

		$(".active_field").each(function() {

			if ($(this).data('fieldid') !== undefined && config[$(this).data('fieldid')] !== undefined) {

				if ($(this).data('special') == 'color') {
					$(this).spectrum("set", int2hex( config[$(this).data('fieldid')] ));
				}

				else if ($(this).data('special') == 'dropdown') {
					$(this).find('option[value="' + config[$(this).data('fieldid')] + '"]').prop('selected', true);
				}

				else if ($(this).data('special') == 'checkbox') {
					$(this).prop('checked', config[$(this).data('fieldid')]);
				}

				else if ($(this).data('special') == 'alignment') {
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

		current_style = config.style;

		$("#action_area").hide();
		$(".button_style").hide();

		switch(config.style) {
			case undefined:
				break;
			case 'pageup':
				$(".button_style_pageup").show();
				break;
			case 'pagenum':
				$(".button_style_pagenum").show();
				break;
			case 'pagedown':
				$(".button_style_pagedown").show();
				break;
			default:
				$("#action_area").show();
				break;
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
				var $div = $(`
					<div class='filechoosercontainer'>
						<label class='btn btn-primary btn-file'>Browse <input type='file' data-fieldid='"+field.id+"' accept='" + field.accept + "' style='display: none;'></label>
						<button class='btn btn-primary' id='clearPngButton'><i class='fa fa-trash'></i></button>
					</div>
				`);

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
								$('#clearPngButton')[0].disabled = false;
							}
						});
					}, function () {
						alert('Image must have the following dimensions: ' + field.imageMaxWidth + 'x' + field.imageMaxHeight);

						// Reset file fields
						self.value = null;
					});
				});

				$field.find('#clearPngButton').click(function () {
					if (confirm("Clear image for this button?")) {
						socket.emit('bank_clear_png', p, b);
						socket.once('bank_clear_png:result', function () {
							bank_preview_page(p);
							$('#clearPngButton')[0].disabled = true;
						});
					}
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

			else if ($(this).data('special') == 'checkbox') {
				socket.emit('bank_changefield', p, b, $(this).data('fieldid'), $(this).prop('checked') );
				socket.emit('get_bank', page, bank);
				socket.once('get_bank:results', updateFromConfig);
			}

			else if ($(this).data('special') == 'dropdown') {
				socket.emit('bank_changefield', p, b, $(this).data('fieldid'), $(this).val() );
				socket.emit('get_bank', page, bank);
				socket.once('get_bank:results', updateFromConfig);
			}

			else if ($(this).data('special') == 'alignment') {
				socket.emit('bank_changefield', p, b, $(this).data('fieldid'), $(this).data('alignment') );
				socket.emit('get_bank', page, bank);
				socket.once('get_bank:results', updateFromConfig);
			}

			else {
				// Custom unicode un-escaping in text field
				if ($(this).data('fieldid') == 'text') {
					var start = this.selectionStart;
					var end = this.selectionEnd;
					$(this).val(replaceUnicode($(this).val()));
					this.setSelectionRange(start, end);
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

		var text_field = $("input[data-fieldid=\"text\"]");
		variables_autocomplete.attach(text_field);
		text_field.on('tribute-replaced', change);
	}

	$(window).keyup(function(e) {

		// Delete bank with backspace
		if (e.keyCode == 8 && selected_bank.page !== undefined) {
			if (!$(':focus').is('input') && !$(':focus').is('textarea')) {
				if (confirm('Clear button ' + selected_bank.page + '.' + selected_bank.bank + '?')) {
					socket.emit('bank_reset', page, bank);
					socket.emit('bank_actions_get', page, bank);
					socket.emit('bank_get_feedbacks', page, bank);
					socket.emit('bank_reset_release_actions', page, bank);
					socket.emit('bank_release_actions_get', page, bank);

					$("#resetBankButton").hide();
					populate_bank_form(page,bank,{},{});
					bank_preview_page(page);
				}
			}
		}

	});

	// Copy bank with cmd+c/ctr+c
	$(window).bind('copy', function (e) {
		if (!$(e.target).is('input') && !$(e.target).is('textarea') && selected_bank.page !== undefined) {
			copyfrom = { page: selected_bank.page, bank: selected_bank.bank, type: 'copy' };
			return false;
		}
	});

	// Cut bank with cmd+x/ctr+x
	$(window).bind('cut', function (e) {
		if (!$(e.target).is('input') && !$(e.target).is('textarea') && selected_bank.page !== undefined) {
			copyfrom = { page: selected_bank.page, bank: selected_bank.bank, type: 'cut' };
			return false;
		}
	});

	// Paste bank with cmd+v/ctr+v
	$(window).bind('paste', function (e) {
		if (!$(e.target).is('input') && !$(e.target).is('textarea') && selected_bank.page !== undefined) {
			var page = selected_bank.page;
			var bank = selected_bank.bank;

			if (copyfrom.type === 'copy') {
				socket.emit('bank_copy', copyfrom.page, copyfrom.bank, page, bank);
			} else if (copyfrom.type == 'cut') {
				socket.emit('bank_move', copyfrom.page, copyfrom.bank, page, bank);
				copyfrom = {};
			}

			socket.emit('bank_actions_get', page, bank);
			socket.emit('bank_get_feedbacks', page, bank);
			socket.emit('bank_release_actions_get', page, bank);
			socket.emit('get_bank',page, bank);
			socket.once('get_bank:results', populate_bank_form);
			return false;
		}
	});


	$(window).keydown(function(e) {
		if (e.keyCode == 16 && function_state === null) {
			buttons_hot = true;
			$(".border").addClass('bank-armed');
			$('#functionkeys').slideUp(80);
		}

	});
	$(window).keyup(function(e) {
		if (e.keyCode == 16 && function_state === null) {
			buttons_hot = false;
			$(".border").removeClass('bank-armed');
			$('#functionkeys').slideDown(80);
		}

	});


	$(".change_style").click(function() {
		var no_warning = true;

		var ns = $(this).data('style');
		console.log("CURRENT STYLE", current_style, "NEW STYLE", ns);
		if (current_style !== 'pageup' && current_style !== 'pagedown' && current_style !== 'pagenum') {
			if (ns === 'pageup' || ns === 'pagedown' || ns === 'pagenum') {
				no_warning = false;
			}
		}

		if (no_warning === true || confirm('Changing to this button style will erase eventual actions and feedbacks configured for this button - continue?')) {
			socket.emit('bank_style', page, bank, $(this).data('style'));
			socket.once('bank_style:results', populate_bank_form);
			socket.once('bank_style:results', function () {
				bank_preview_page(page);
				socket.emit('bank_actions_get', page, bank);
				socket.emit('bank_get_feedbacks', page, bank);
				socket.emit('bank_reset_release_actions', page, bank);
				socket.emit('bank_release_actions_get', page, bank);
			});


		}

	});

	$("#resetBankButton").click(function() {
		if (confirm('Clear design and all actions?')) {
			socket.emit('bank_reset', page, bank);
			socket.emit('bank_actions_get', page, bank);
			socket.emit('bank_get_feedbacks', page, bank);
			socket.emit('bank_reset_release_actions', page, bank);
			socket.emit('bank_release_actions_get', page, bank);

			$("#resetBankButton").hide();
			populate_bank_form(page,bank,{},{});
			bank_preview_page(page);
		}
	});

	socket.on('preview_page_data', function (images) {
		for (var key = 1; key <= MAX_BUTTONS; ++key) {
			var imageData;

			if (images[key] === undefined) {
				imageData = dataToButtonImage(image_cache[page + '_' + key].buffer);
			}

			else {
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
			selected_bank = {};
			$('.bank').removeClass('selected');
			socket.emit('bank_preview', false);
		}
	});

	$('#erase_page_link').click(function () {
		if (confirm('Are you sure you want to clear all buttons on page ' + page + '?\nThere\'s no going back from this.')) {
			socket.emit('loadsave_reset_page_all', page);
		}
	});

	$('#reset_nav_link').click(function () {
		if (confirm('Are you sure you want to reset navigation buttons? This will completely erase bank ' + page + '.1, ' + page + '.9 and ' + page + '.17')) {
			socket.emit('loadsave_reset_page_nav', page);
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
				if (function_detail.second !== undefined) {
					if (function_detail.first.page === function_detail.second.page && function_detail.first.bank === function_detail.second.bank) {
						console.log("oops, avoid bug");
					}
					else {
					socket.emit('bank_move', function_detail.first.page, function_detail.first.bank, function_detail.second.page, function_detail.second.bank);
					socket.once('bank_move:result', function () {
						// TODO
					});
					}
					clearFunction();
				}
			}

			else if (function_state === 'delete') {
				if (function_detail.first !== undefined) {
					if (confirm("Clear style and actions for this button?")) {
						socket.emit('bank_reset', function_detail.first.page, function_detail.first.bank);
						socket.emit('bank_actions_get', function_detail.first.page, function_detail.first.bank );
						socket.emit('bank_reset_release_actions', function_detail.first.page, function_detail.first.bank );
						socket.emit('bank_release_actions_get', function_detail.first.page, function_detail.first.bank );
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

		}

		else {
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

	function remap(x, in_min, in_max, out_min, out_max) {
		return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
	}

	function resize_buttonwidth() {

		var button1 = $(".buttonbankwidth:eq(1)").position().left;
		var button2 = $(".buttonbankwidth:eq(2)").position().left;
		var ww = $("#elgatobuttons").width();

		var space = button2 - button1 - 72;
		var abs_space = Math.abs(space);

		if (ww < 597) {
			var wmin = ww - 374;
			var p = remap(wmin, 0, 222, 44, 72);
			$('.border canvas').css("width", p);
			$('.border canvas').css("height", p);

		}

	}

	function changePage(pagenum) {

		$pagenav.html("");
		$pagebank.html("");

		$('#import_page').text('Import to page ' + pagenum).data('page', pagenum);

		var pname = "";

		if (page_info !== undefined && page_info[page] !== undefined) {
			pname = page_info[page].name;
		}

		$('#export_page_link').attr('href', '/int/page_export/' + page);

		$pagenav.append($('<div class="pagenav col-lg-12"><div id="btn_pagedown" class="btn btn-primary"><i class="fa fa-chevron-left"></i></div><input id="page_curr" class="page_curr" placeholder="" type="text" value="'+page+'"><div id="btn_pageup" class="btn btn-primary"><i class="fa fa-chevron-right"></i></div><input id="page_title" class="page_title" placeholder="Page name" type="text" value="'+ pname +'"></div>'));

		for (var bank = 1; bank <= MAX_BUTTONS; bank++) {

			var $div = $('<div class="bank buttonbankwidth"><div class="border" data-bank="' + bank + '" data-page="' + page + '"><canvas width=72 height=72 id="bank_' + page + '_' + bank + '"></canvas></div></div>');

			if ([1,5,9,13,17,18,19,20,21].includes(bank)) {
				$div.css('backgroundColor', '#00000050');
			}

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

		resize_buttonwidth();

		setInterval(function() {
			resize_buttonwidth();
		}, 1500);

		bank_preview_page(pagenum);

		$(window).resize(resize_buttonwidth);


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

				var bank = $(this).data('bank');

				if (function_detail['first'] === undefined) {
					function_detail['first'] = {
						page: page,
						bank: bank,
					};
				}

				else {
					function_detail['second'] = {
						page: page,
						bank: bank,
					};
				}

				executeFunctionArea();
				renderFunctionArea();

			}

			else {

				selected_bank = { page: page, bank: $(this).data('bank') };

				$('.bank').removeClass('selected');
				var $found = $('#bank_' + selected_bank.page + '_' + selected_bank.bank);
				$found.parents('.bank').addClass('selected');

				$("#editbankli").show();
				$('#editbankli a[href="#editbank"]').tab('show');
				$("#editbank_content").html("");
				$("#editbankid").text(page + "." + $(this).data('bank'));

				socket.emit('bank_actions_get', page, $(this).data('bank'));
				socket.emit('bank_get_feedbacks', page, $(this).data('bank'));
				socket.emit('bank_release_actions_get', page, $(this).data('bank'));
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

		$("#page_curr").click(function(){
			$(this).val('');
		}).blur(function() {
			$(this).val(page);
		}).keyup(function(e){
			if(e.keyCode == 13) {
				var value = parseInt($(this).val(), 10);
				if (value > 0 && value <100) { 
					page = value
				} else {
					alert('Not a valid page number.')
				}
			changePage(page);
			}
		});
	}

	changePage(page);

	socket.on('preview_bank_data', function (page, bank, data) {
		var imageData = dataToButtonImage(data);
		pc.putImageData(imageData, 0, 0);
	});
});
