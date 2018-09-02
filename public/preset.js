var all_presets;
$(function() {
	var $presets = $('#presets');
	console.log("get_presets");
	socket.emit('get_presets');
	socket.once('get_presets:result', presets);

	var main_presets = '<h4>Presets from instances</h4><br />';

	function get_instance(id) {
		for (var key in instance.module) {
			if (instance.module[key].id == id) {
				return instance.module[key];
			}
		}
	}

	function choose_instance() {
		$presets.html(main_presets);

		for (var key in all_presets) {
			console.log(key, instance.db[key], instance.db[key].instance_type);
			var inst = get_instance(instance.db[key].instance_type);
			if (inst !== undefined) {
				$presets.append('<input type="button" class="btn btn-primary choose_instance" data-key="' + key + '" value="' + inst.label + ' (' + instance.db[key].label + ')"><br />');
			}
		}
	}

	function show_presets_for_instance(id) {
		var categories = {};
		for (var key in all_presets[id]) {
			var preset = all_presets[id][key];
			categories[preset.category] = 1;
		}
		var inst = get_instance(instance.db[id].instance_type);
		$presets.html('<button type=button class="btn btn-primary pull-right back_main">Back</button><br><h4>Preset categories for ' + inst.label + '</h4><br />');

		for (var key in categories) {
			$presets.append('<input type="button" class="btn btn-primary choose_category" data-instance="' + id + '" data-key="' + key + '" value="' + key + '"><br /><br />');
		}
	}

	function show_presets(instance, category) {
		$presets.html('<button type=button class="btn btn-primary pull-right back_category" data-instance="' + instance + '">Back</button><br><h4>Presets for ' + category + '</h4><br style="clear:both">');

		for (var key in all_presets[instance]) {
			var preset = all_presets[instance][key];
			if (preset.category != category) {
				continue;
			}

			$presets.append('<div class="presetbank col-lg-3" data-drawn="no" data-instance="' + instance + '" title="' + preset.label + '" data-key="' + key + '"><canvas width="72" height="72"></canvas></div>');
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
