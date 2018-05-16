
			var socket = new io();


			// borrowed color functions. TODO: make them better?

			function int2hex(number) {
				var intnumber = number - 0;
				var red, green, blue;
				var template = "#000000";
				red = (intnumber&0x0000ff) << 16;
				green = intnumber&0x00ff00;
				blue = (intnumber&0xff0000) >>> 16;
				intnumber = red|green|blue;
				var HTMLcolor = intnumber.toString(16);
				HTMLcolor = template.substring(0,7 - HTMLcolor.length) + HTMLcolor;
				return HTMLcolor;
			}
			function hex2int(hex) {
				var int = parseInt(hex.substr(1,6),16);
				console.log("hex2int",hex,int);
				return int;
			}


			$(function() {
				var $pagenav = $("#pagenav");
				var $pagebank = $("#pagebank");
				var page = 1;
				var bank = undefined;

				$("#editbankli").hide();
				var colors = [
					"#000000",
					"#FFFFFF",
					"#FF0000",
					"#00FF00",
					"#0000FF",
					"#FF00FF",
					"#FFFF00",
					"#00FFFF",
					"#C0392B",
					"#8E44AD",
					"#58D68D",
					"#F4D03F",
					"#7B241C",
					"#943126",
					"#633974",
					"#5B2C6F",
					"#1A5276",
					"#21618C",
					"#117864",
					"#0E6655",
					"#196F3D",
					"#1D8348",
					"#9A7D0A",
					"#9C640C",
					"#935116",
					"#5F6A6A"
				];
				function populate_bank_form(page,bank,config,fields) {
					var $eb = $("#editbank_content");
					$eb.html("<p><h3>Configuration</h3></p>");
					console.log("xgot",page,bank,config,fields);

					for (var n in fields) {
						var field = fields[n];
						console.log(field);

						if (field.type == 'textinput') {
							var $p = $("<p><label>"+field.label+"</label><br><input type='text' data-fieldid='"+field.id+"' class='form-control active_field'></p>");
							$eb.append($p);
						}
						else if (field.type == 'colorpicker') {
							var $p = $("<p><label>"+field.label+"</label><br></p>");
							var $div = $("<div class='colorcontainer' data-fieldid='"+field.id+"' style='height:20px;'></div>");
							for (var n in colors) {
								var $c = $("<div class='colorblock' data-color='"+colors[n]+"' data-fieldid='"+field.id+"'></div>");
								$c.click(function() {
									socket.emit('bank_changefield', page, bank, $(this).data('fieldid'), hex2int(  $(this).data('color') ) );
								});

								$c.css('backgroundColor', colors[n]);
								$c.css('width', 20);
								$c.css('height', 20);
								$c.addClass('activecolor');
								$c.css('float','left');
								$div.append($c)
							}
							$p.append($div);
							$eb.append($p);
							$('#auto_'+field.id).colorpicker();
							console.log($('#auto_'+field.id));

						}
					}

					$(".active_field").each(function() {
						if ($(this).data('fieldid') !== undefined && config[$(this).data('fieldid')] !== undefined) {
							if ($(this).data('special') == 'color') {
								$(this).val( int2hex( config[$(this).data('fieldid')] ) );
							}
							else {
								$(this).val(config[$(this).data('fieldid')]);
							}
						}
					});

					var change = function() {
						console.log("this",this);
						if ($(this).data('special') == 'color') {
							socket.emit('bank_changefield', page, bank, $(this).data('fieldid'), hex2int( $(this).val() ) );
						}
						else {
							socket.emit('bank_changefield', page, bank, $(this).data('fieldid'), $(this).val() );
						}
					}

					$(".active_field").keyup(change);


				}

				function changePage(pagenum) {

					$pagenav.html("");
					$pagebank.html("");

					$pagenav.append($('<div id="btn_pagedown" class="pagenav col-lg-4"><div class="border">Page down</div></div>'));
					$pagenav.append($('<div id="btn_this" class="pageat col-lg-4">Page '+pagenum+'</div>'));
					$pagenav.append($('<div id="btn_pageup" class="pagenav col-lg-4"><div class="border">Page up</div></div>'));

					for (var bank = 1; bank <= 12; bank++) {
						var $div = $('<div class="bank col-lg-3"><div class="border" data-bank="'+bank+'">'+pagenum+'.'+bank+'</div></div>')
						$pagebank.append($div);
					}

					$(".change_style").click(function() {
						console.log('change_style', $(this).data('style'), page, bank);
						socket.emit('bank_style', page, bank, $(this).data('style'));
						socket.once('bank_style:results', populate_bank_form);
					});

					$("#pagebank .border").click(function() {
						console.log("HEHE", page, $(this).data('bank'));
						bank = $(this).data('bank');
						$("#editbankli").show();
						$('#editbankli a[href="#editbank"]').tab('show');
						$("#editbank_content").html("");
						$("#editbankid").text(page + "." + $(this).data('bank'));

						socket.emit('get_bank',page, $(this).data('bank'));
						socket.once('get_bank:results', populate_bank_form);
					});

					$("#btn_pageup").click(function() {
						if (page < 99) {
							page++;
							changePage(page);
						}
					});

					$("#btn_pagedown").click(function() {
						if (page > 1) {
							page--;
							changePage(page);
						}
					});

				}

				changePage(page);


			});
