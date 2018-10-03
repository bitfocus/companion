var all_presets;
$(function() {
	var $presets = $('#presets');
	console.log("get_presets");
	socket.emit('get_presets');
	socket.once('get_presets:result', presets);

	socket.on('presets_update', presets_update);
	socket.on('presets_delete', presets_delete);

	var main_presets = '<h4>Available instance presets</h4>';

	function get_instance(id) {
		for (var key in instance.module) {
			if (instance.module[key].name == id) {
				return instance.module[key];
			}
		}
	}

	function choose_instance() {
		$presets.prop('view', 'instance');
		$presets.html(main_presets);

		var count = 0;
		for (var key in all_presets) {
			var inst = get_instance(instance.db[key].instance_type);
			if (inst !== undefined) {
				count++;
				$presets.append('<input type="button" class="btn btn-primary choose_instance" data-key="' + key + '" value="' + inst.label + ' (' + instance.db[key].label + ')"><br /><br />');
			}
		}

		if (!count) {
			$presets.append('You have no instances that support presets at the moment. More and more modules will support presets in the future.');
		}
	}

	function show_presets_for_instance(id) {
		$presets.prop('view', 'instance_presets');

		var categories = {};
		for (var key in all_presets[id]) {
			var preset = all_presets[id][key];
			categories[preset.category] = 1;
		}
		var inst = get_instance(instance.db[id].instance_type);
		$presets.html('<button type=button class="btn btn-primary pull-right back_main">Back</button><h4>Preset categories for ' + inst.label + ' (' + instance.db[id].label + ')</h4>');

		for (var key in categories) {
			$presets.append('<input type="button" class="btn btn-primary choose_category" data-instance="' + id + '" data-key="' + key + '" value="' + key + '"> ');
		}
	}

	function show_presets(instance, category) {
		$presets.prop('view', 'presets');
		$presets.html('<button type=button class="btn btn-primary pull-right back_category" data-instance="' + instance + '">Back</button><h4>Presets for ' + category + '</h4><p>Drag and drop the preset buttons below into your buttons-configuration.</p>');

		for (var key in all_presets[instance]) {
			var preset = all_presets[instance][key];
			if (preset.category != category) {
				continue;
			}

			$presets.append('<div class="presetbank col-lg-3" data-drawn="no" data-instance="' + instance + '" title="' + preset.label + '" data-key="' + key + '"><canvas width="72" style="cursor:pointer" height="72"></canvas></div>');
		}

		$presets.append('<br style="clear: both;" />');
		$presets.find('.presetbank').draggable({});
		preload_presets();
	}

	function preload_presets() {
		$presets.find('.presetbank[data-drawn="no"]').each(function () {
			var bank = this;

			if ($(bank).isInViewport()) {
				var id = $(this).data('instance');
				var key = $(this).data('key');

				var preview_id = id+'_'+key;
				$(bank).attr('data-drawn', 'yes');
				console.log("requesting preview for ", preview_id);
				socket.emit('graphics_generate_preview', all_presets[id][key].bank, preview_id);
				socket.once('graphics_generate_preview:' + preview_id, function (img) {
					var canv = $(bank).find('canvas').get(0);
					var ctx = canv.getContext('2d');
					ctx.putImageData(dataToButtonImage(img), 0, 0);
				});
			}
		});
	}

	function presets(presets) {
		all_presets = presets;

		choose_instance();
	}

	function presets_update(id, presets) {
		all_presets[id] = presets;

		if ($presets.prop('view') == 'instance') {
			choose_instance();
		}
	}

	function presets_delete(id) {
		delete all_presets[id];

		if ($presets.prop('view') == 'instance') {
			choose_instance();
		}
	}

	$('#presets_tab').click(function () {
		choose_instance();
	});

	$presets.on('click', '.back_main', function () {
		choose_instance();
	});

	$presets.on('click', '.back_category', function () {
		show_presets_for_instance($(this).data('instance'));
	});

	$presets.on('click', '.choose_instance', function () {
		show_presets_for_instance($(this).data('key'));
	});

	$presets.on('click', '.choose_category', function () {
		show_presets($(this).data('instance'), $(this).data('key'));
	});

	$(window).on('resize scroll', function () {
		preload_presets();
	})
});
