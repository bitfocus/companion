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

var import_page = 1;
var import_data;
var import_bank = undefined;

$(function() {
	var $pagenav = $("#import_pagenav");
	var $pagebank = $("#import_pagebank");

	$('#import_btn_pagedown').click(function () {
		if (import_page > 1) {
			import_page--;
		} else {
			import_page = 99;
		}

		loadPage(import_page, import_data.page[import_page], import_data.config[import_page]);
	});

	$('#import_btn_pageup').click(function () {
		if (import_page < 99) {
			import_page++;
		} else {
			import_page = 1;
		}

		loadPage(import_page, import_data.page[import_page], import_data.config[import_page]);
	});

	$('#import_tab').click(function () {
		$('#import_fileselect').show();
		$('#import_config').hide();
	});

	function loadPage(num, page, config) {
		$('#import_config .pageat small').text(num ? '(Page ' + num + ')' : '');
		$('#import_page_title').val(page.name);

		$pagebank.html('');
		for (var key in config) {
			var $b = $("<div class='bank col-lg-3'><div class='importborder'><canvas width=72 height=72></canvas></div></div>");

			$pagebank.append($b);
			(function ($b) {
				var preview_id = 'lp' + num + page.name + key;
				socket.emit('graphics_generate_preview', config[key], preview_id);
				socket.once('graphics_generate_preview:' + preview_id, function (img) {
					var canv = $b.find('canvas').get(0);
					var ctx = canv.getContext('2d');
					ctx.putImageData(dataToButtonImage(img), 0, 0);
				});
			})($b);
		}
	}

	$('#import .import_replace').click(function () {
		$('#import_step2').hide();
		$('#import_tab').click();

		socket.emit('loadsave_import_full', import_data);
		socket.once('loadsave_import_full:result', function () {
			window.location.reload();
		});
	});

	$('#reset_all').click(function () {
		socket.emit('reset_all');
		socket.once('reset_all:result', function () {
			window.location.reload();
		});
	});

	$('#import_page').click(function () {
		var instanceconfig = {};

		$('#importConfigInstanceList select').each(function () {
			var key = $(this).data('key');
			import_data.instances[key].import_to = $(this).val();
		});

		socket.emit('loadsave_import_page', $(this).data('page'), import_page, import_data);
		socket.once('loadsave_import_page:result', function (err, result) {
			$('#import_tab').click();
		});
	});

	$('#import .import_individual').click(function () {
		$('#import_step2').hide();
		$('#import_resolve').show();

		$('#import_page').text('Import to page ' + page).data('page', page);
	});

	$('#loadconfig').change(function () {
		import_file(this);
		socket.once('loadsave_import_config:result', function (err, result) {
			if (err) {
				alert('Error importing configuration: ' + err);
				return;
			}

			$('#import_config').show();
			$('#import_fileselect').hide();

			import_data = result;
			if (result.type == 'page') {
				$('#import_btn_pagedown').hide();
				$('#import_btn_pageup').hide();

				$('#import_step2').hide();
				$('#import_resolve').show();

				loadPage('', result.page, result.config);

				$('#import_page').text('Import to page ' + page);
			} else {
				$('#import_btn_pagedown').show();
				$('#import_btn_pageup').show();

				$('#import_step2').show();
				$('#import_resolve').hide();

				loadPage(import_page = 1, result.page[1], result.config[1]);
			}

			var $list = $('#importConfigInstanceList').html('');
			for (var key in result.instances) {
				var $tr = $('<tr><td><select data-key="' + key + '"><option value="new">[ Create new instance ]</option></select></td><td>BMD VideoHub</td><td>Routeren da</td></tr>');
				var $sel = $tr.find('select');

				var selected = '';
				for (var ik in instance.db) {
					if (instance.db[ik].instance_type == result.instances[key].instance_type) {
						$sel.append('<option value="' + ik + '">' + instance.db[ik].label + '</option>');
						if (ik == key) {
							selected = ik;
						}
					}
				}
				if (selected != '') {
					$sel.val(selected);
				}

				for (var i = 0; i < instance.module.length; ++i) {
					if (instance.module[i].name == result.instances[key].instance_type) {
						$tr.find('td:nth-child(2)').text(instance.module[i].label);
					}
				}

				$tr.find('td:nth-child(3)').text(result.instances[key].label);

				$list.append($tr);
			}
			console.log(result);
		});
	});

	function import_file(upload) {
		if (window.File && window.FileReader && window.FileList && window.Blob) {
				if (!upload.files[0] === undefined || upload.files[0].type === undefined) {
					alert('Unable to read config file');
					return;
				}

				var fr = new FileReader;
				fr.onload = function() {
					socket.emit('loadsave_import_config', fr.result);
				};
				fr.readAsText(upload.files[0]);
		} else {
				alert('I am sorry, Companion requires a more modern browser');
		}
		upload.value = null;
	}
});
