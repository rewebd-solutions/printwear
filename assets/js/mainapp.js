var $type = "tee", $color = "white", $colorId = new URLSearchParams(location.search).get("color") || "white", $y_pos = "front", $nos_icons = 0, $nos_text = 0, $custom_img = 0, globalDesignId = null;
function populateDOM() {

	productData = fetchProductData.productData;
	colorsData = fetchProductData.colorsData;

	//ONLOAD
	// $("#preview_front").css('background-image', `url('/images/mockup/product/tee/white/white_front.png')`);
	$("#preview_front").css('background-image', `url(${productData.productImage.front})`);
	$("#preview_back").css('background-image', `url('${productData.productImage.back}')`);
	//$("#preview_front, #preview_back , #preview_left, #preview_right").css('background-color', 'blue') ;
	$("#preview_front,.T_type").removeClass('dis_none');
	$("#preview_back,.color_pick,.default_samples,.custom_icon,.custom_font").addClass('dis_none');
	//$('.modal').css('dispaly','none');

	//ONLOAD OVER

	/*==========================SWITCH MENU===========================*/
	$(".sel_type").click(function () {
		$(".T_type").removeClass('dis_none');
		$(".sel_type").addClass('sel');
		$(".sel_color").removeClass('sel');
		$(".sel_art").removeClass('sel');
		$(".sel_custom_icon").removeClass('sel');
		$(".sel_text").removeClass('sel');
		$(".color_pick,.default_samples,.custom_icon,.custom_font").addClass('dis_none');
	});
	$(".sel_color").click(function () {
		$(".color_pick").removeClass('dis_none');
		$(".sel_color").addClass('sel');
		$(".sel_type").removeClass('sel');
		$(".sel_art").removeClass('sel');
		$(".sel_custom_icon").removeClass('sel');
		$(".sel_text").removeClass('sel');
		$(".T_type,.default_samples,.custom_icon,.custom_font").addClass('dis_none');
	});
	$(".sel_art").click(function () {
		$(".default_samples").removeClass('dis_none');
		$(".sel_art").addClass('sel');
		$(".sel_color").removeClass('sel');
		$(".sel_type").removeClass('sel');
		$(".sel_custom_icon").removeClass('sel');
		$(".sel_text").removeClass('sel');
		$(".T_type,.color_pick,.custom_icon,.custom_font").addClass('dis_none');
	});
	$(".sel_custom_icon").click(function () {
		$(".custom_icon").removeClass('dis_none');
		$(".sel_custom_icon").addClass('sel');
		$(".sel_color").removeClass('sel');
		$(".sel_art").removeClass('sel');
		$(".sel_type").removeClass('sel');
		$(".sel_text").removeClass('sel');
		$(".T_type,.color_pick,.default_samples,.custom_font").addClass('dis_none');
	});
	$(".sel_text").click(function () {
		$(".custom_font").removeClass('dis_none');
		$(".sel_text").addClass('sel');
		$(".sel_color").removeClass('sel');
		$(".sel_art").removeClass('sel');
		$(".sel_custom_icon").removeClass('sel');
		$(".sel_type").removeClass('sel');
		$(".T_type,.color_pick,.default_samples,.custom_icon").addClass('dis_none');
	});


	/* settings img srcs for the things obtained from fetch*/
	$("#radio1 img").attr("src", `${productData.productImage.front}`)

	$("#o_front").attr("src", `${productData.productImage.front}`)
	$("#o_back").attr("src", `${productData.productImage.back}`)

	/*==========================select back or front=====================*/
	$(".mf").click(function () {
		$y_pos = "front";
		const colorImageData = colorsData.find(color => color._id === $colorId);
		if (!colorImageData) {
			$("#preview_front").css('background-image', `url(${productData.productImage.front})`);
		} else {
			$("#o_front").attr('src', `${colorImageData.colorImage.front}`);
			$("#o_back").attr('src', `${colorImageData.colorImage.back})`);
			$("#preview_front").css('background-image', `url(${colorImageData.colorImage.front})`);
		}

		$("#preview_front").removeClass('dis_none');
		$("#preview_back").addClass('dis_none');
		$(".mf").addClass('sel');
		$(".mb").removeClass('sel');

	});
	$(".mb").click(function () {
		$y_pos = "back";
		const colorImageData = colorsData.find(color => color._id === $colorId);

		if (!colorImageData) {
			$("#preview_front").css('background-image', `url(${productData.productImage.back})`);
		} else {
			$("#o_front").attr('src', `${colorImageData.colorImage.front}`);
			$("#o_back").attr('src', `${colorImageData.colorImage.back})`);
			$("#preview_back").css('background-image', `url(${colorImageData.colorImage.back})`);
		}
		$("#preview_back").removeClass('dis_none');
		$("#preview_front").addClass('dis_none');
		$(".mb").addClass('sel');
		$(".mf").removeClass('sel');
	});


	/*==========================select COLOR=====================*/
	function change_it(item) {
		// console.log(item);
		$colorId = item.dataset.id;
		const colorImageData = colorsData.find(color => color._id === item.dataset.id);
		// console.log(colorImageData);
		$("#preview_front").css('background-image', `url(${colorImageData.colorImage.front})`);
		$("#preview_back").css('background-image', `url(${colorImageData.colorImage.back})`);
		// $("#preview_front").css('background-image', 'url(/images/mockup/product/' + $type + '/' + $color + '/' + $color + '_front.png) ');
		$("#o_front").attr('src', `${colorImageData.colorImage.front}`);
		$("#o_back").attr('src', `${colorImageData.colorImage.back})`);

		updateStockQuantity(item.dataset.id);

	}

	const colorsSelectorDOMString = colorsData.map(color => {
		return `<div class="color_radio_div" data-id="${color._id}" style="background: ${color.colorCode}"></div>`
	}).join('\n');

	$(".color_pick").html(colorsSelectorDOMString);

	const colorBtns = colorsData.map(color => `[data-id="${color._id}"]`);
	document.querySelector(".color_pick").addEventListener("click", e => {
		for (let colorBtn of colorBtns) {
			const elem = e.target.closest(colorBtn);
			if (elem) {
				change_it(elem);
				break;
			}
		}
	})

	const updateStockQuantity = (id) => {
		const colorData = id ? colorsData.find(color => color._id === id) : colorsData.find(color => color.colorName === "white");
		const quantityDOMString = `
			<tr>
				<th>Size</th>
				<th>Quantity</th>
			</tr>`
			+
			colorData.sizes.map(colorStock => {
				return `
				<tr>
					<td><b>${colorStock.size}</b></td>
					<td>
						<input id="${colorData.colorSKU}-${colorStock.size}" name="small" type="number" value="0"
						class="form-control small input-md" min='0' max="${colorStock.stock}" />
					</td>
				</tr>
				`;
			}).join('\n')

		$("#preview-table").html(quantityDOMString);
	}

	updateStockQuantity(null);

	/*=====================SAMPLE ICONS========================*/
	$(".sample_icons").click(function () {
		var $srcimg = $(this).children("img").attr('src');
		image_icon($srcimg);

	});

	$(".folder_toggle").click(function () {
		$i = $(this).attr('value');
		$folder = $(this).attr('data-folder');
		$.ajax({
			url: 'tdesignAPI/control/newcontent.php?folder=' + $folder,
			success: function () {
				$("#toggle_show" + $i).empty().load("tdesignAPI/control/newcontent.php?folder=" + $folder);
			}
		});
	});

	const addToCart = async (designId, productId, qty) => {
		return await fetch("/addtocart", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				designId: designId,
				productId: productId,
				quantity: qty
			})
		});
	}

	const saveDesign = async (designName, productId, frontImage, backImage, color) => {
		return await fetch("/adddesign", {
			headers: {
				"Content-Type": "application/json"
			},
			method: "POST",
			body: JSON.stringify({
				designName,
				productId,
				frontImage,
				backImage,
				color // soon send as req param
			})
		});
	}
	/*=====================SAMPLE ICONS over========================*/

	/*
	 * Font resiZable
	 * 
	 * 
	 * 
	 *
	var initDiagonal;
	var initFontSize;
	
	$(function() {
		$("#resizable").resizable({
			alsoResize: '#content',
			create: function(event, ui) {
				initDiagonal = getContentDiagonal();
				initFontSize = parseInt($("#content").css("font-size"));
			},
			resize: function(e, ui) {
				var newDiagonal = getContentDiagonal();
				var ratio = newDiagonal / initDiagonal;
			    
				$("#content").css("font-size", initFontSize + ratio * 3);
			}
		});
	});
	
	function getContentDiagonal() {
		var contentWidth = $("#content").width();
		var contentHeight = $("#content").height();
		return contentWidth * contentWidth + contentHeight * contentHeight;
	}
	/*
	 * 
	 * 
	 * 
	 */

	$('#apply_text').click(function () {
		// console.log("working?");

		var text_val = $("textarea#custom_text").val();
		if (!text_val)
			return false;

		$("." + $y_pos + "_print").append("<div id=text" + ($nos_text) + " class='new_text'  onmouseover='show_delete_btn(this);' onmouseout='hide_delete_btn(this);'><span class='drag_text property_icon'  ></span><textarea id='text_style' >" + text_val + "</textarea><span class='delete_text property_icon' onClick='delete_text(this);' ></span></div>");
		$("#text" + ($nos_text) + "").draggable({ containment: "parent" });
		$("#text" + ($nos_text) + "").resizable({
			maxHeight: 480,
			maxWidth: 450,
			minHeight: 60,
			minWidth: 60
		});

		var $font_ = $('#custom_text').css("font-family");
		var $font_size = $('#custom_text').css("font-size");
		var $font_weight = $('#custom_text').css("font-weight");
		var $font_style = $('#custom_text').css("font-style");
		var $font_color = $('#custom_text').css("color");
		//alert($font_u);


		$("#text" + ($nos_text) + " textarea").css("font-family", $font_);
		$("#text" + ($nos_text) + " textarea").css("font-size", $font_size);
		$("#text" + ($nos_text) + " textarea").css("font-weight", $font_weight);
		$("#text" + ($nos_text) + " textarea").css("font-style", $font_style);
		$("#text" + ($nos_text) + " textarea").css("color", $font_color);
		$("#text" + ($nos_text)).css({ 'top': '100px', 'left': '150px' });
		//document.getElementById("text"+($nos_text)+" textarea").style.textDecoration=(""+$font_u+"");
		++$nos_text;
	});
	$('.preview_images').click(function () {
		capture();
		//$('.modal').addClass('in');
		$('.layer').css('visibility', 'visible');
		//$('.layer').css('visibility','visible');
		//$('body').css('position','fixed');
		//$('.modal').css({'display':'block','height':'auto'});
		//$('.design_api').css('position', 'fixed');
		//$('.modal').css('overflow', 'scroll');
	});


	$('.close_img').click(function () {


		$('.layer').css('visibility', 'hidden');
		$("#add-design").prop("disabled", false);
		$("#add-design").text("Save Design");
		//$('.layer').css('visibility','hidden');
		//$('body').css('position','relative');

	});

	// download btn
	document.getElementById("dwn").addEventListener("click", function () {
		// const canvases = document.querySelector("#image_reply").childNodes;
		const frontImage = document.querySelector("#frontImage").toDataURL("image/png");
		const backImage = document.querySelector("#backImage").toDataURL("image/png");
		// Create a temporary anchor element to trigger the download
		let frontDownloadLink = document.createElement("a");
		frontDownloadLink.href = frontImage;
		frontDownloadLink.download = "front_design.png";
		frontDownloadLink.click();

		let backDownloadLink = document.createElement("a");
		backDownloadLink.href = backImage;
		backDownloadLink.download = "back_design.png";
		backDownloadLink.click();
	});

	// add to designs
	$("#add-design").click(async function() {
		$(this).text('Loading...');
		$("#buy").prop("disabled", true);
		$(this).prop('disabled', true);
		// const canvases = document.querySelector("#image_reply").childNodes;
		const frontImage = document.querySelector("#frontImage").toDataURL("image/png");
		const backImage = document.querySelector("#backImage").toDataURL("image/png");
		const designName = $("#design_name").val();
		const productId = productData._id;
		try {
			const saveDesignRequest = await saveDesign(designName, productId, frontImage, backImage, $colorId);
			const saveDesignResponse = await saveDesignRequest.json();
			console.log(saveDesignResponse);
			// put design._id as global var in here
			globalDesignId = saveDesignResponse._id;
			$("#buy").prop("disabled", false);
			$(this).text('Saved successfully');
		} catch(err) {
			console.log(err);
			$(this).text('Error when saving');
		}
	})

	// buy btn fake checkout - change to add to cart
	$("#buy").click(async function (e) {
		// console.log("clik")
		$(this).text('Please wait...');
		$(this).prop('disabled', true);
		// check if specific design id is saved or not, if saved, then put that design id, product id and quantity into /addtocart
		let sizeQty = {};
		document.querySelectorAll("#preview-table input").forEach(inputItem => {
			sizeQty[inputItem.getAttribute("id").split("-")[1]] = inputItem.value
		});
		if (globalDesignId) {
			// console.log(JSON.stringify({
			// 	designId: globalDesignId,
			// 	productId: productData._id,
			// 	quantity: sizeQty
			// }))
			try {
				const addToCartRequest = await addToCart(globalDesignId, productData._id, sizeQty);
				const addToCartResponse = await addToCartRequest.json();
				if (addToCartRequest.ok) {
					$(this).text('Added to cart...');
					$(this).prop('disabled', true);
				}
			} catch (err) { 
				console.log(err);
				$(this).text("Something went wrong!");
			}
		} else {
			// save the design first and then add to cart
			try {
				const frontImage = document.querySelector("#frontImage").toDataURL("image/png");
				const backImage = document.querySelector("#backImage").toDataURL("image/png");
				const designName = $("#design_name").val();
				const productId = productData._id;
				const saveDesignRequest = await saveDesign(designName, productId, frontImage, backImage, $colorId);
				const saveDesignResponse = await saveDesignRequest.json();
				globalDesignId = saveDesignResponse._id;
				const addToCartRequest = await addToCart(globalDesignId, productData._id, sizeQty);
				const addToCartResponse = await addToCartRequest.json();
				if (addToCartRequest.ok) {
					$(this).text('Added to cart...');
					$(this).prop('disabled', true);
				}
			} catch (err) { 
				console.log(err);
				$(this).text("Something went wrong!");
			}

		}
	})

	function readURL(input) {
		if (input.files && input.files[0]) {
			var reader = new FileReader();
			reader.onload = function (e) {
				image_icon(e.target.result);
			}

			reader.readAsDataURL(input.files[0]);
		}
	}

	$("#imgInp").change(function () {
		readURL(this);
	});

}

const loadProductData = async () => {
	try {
		const productId = new URLSearchParams(location.search).get("id");
		console.log(productId);
		if (productId == null) {
			throw new Error("URL product ID is invalid. Please select a proper product ID");
		}
		console.log()
		const fetchProductRequest = await fetch("/getproduct/" + productId);

		if (!fetchProductRequest.ok) {
			throw new Error("Failed to fetch product data. HTTP status: " + fetchProductRequest.status +"!");
		}

		fetchProductData = await fetchProductRequest.json();
		// console.log(fetchProductData);
		$(".loader-wrapper").remove();

		populateDOM();
	} catch (error) {
		// console.log(error);
		document.querySelector(".loader-wrapper").innerHTML = `<p>${error}</p><br />\n<p>&nbsp;  Go to PRODUCT GALLERY and choose a shirt to start</p>`;
	}
}

function capture() {

	const frontPreview = document.getElementById("preview_front");
	frontPreview.classList.remove("dis_none");
	const backPreview = document.getElementById("preview_back");
	backPreview.classList.remove("dis_none");

	$("#image_reply").empty();
	$y_pos = "front";
	html2canvas(frontPreview, {
		allowTaint : true,
		useCORS: true,
		width: 500,
		height: 500,
		logging: true
	}).then(function (canvas) {
		canvas.setAttribute("id","frontImage");
		document.getElementById("image_reply").appendChild(canvas);
		//Set hidden field's value to image data (base-64 string)
		$('#img_front').val(canvas.toDataURL("image/png"));
	}).catch(err => {
		console.log(err);
	});
	//$('#preview_front').hide();
	//$('#preview_back').show();
	html2canvas(backPreview, {
		allowTaint : false,
		useCORS: true,
		width: 500,
		height: 500,
		logging: true
	}).then(function (canvas) {
		//$('#img_back').val(canvas.toDataURL("image/png"));
		canvas.setAttribute("id","backImage");
		document.getElementById("image_reply").appendChild(canvas);
		$('#img_back').val(canvas.toDataURL("image/png"));
		$("#preview_back").addClass('dis_none');
	}).catch(err => {
		console.log(err);
	});
	// html2canvas(frontPreview).then(canvas => {
		// 	console.log(canvas);
		// 	document.getElementById("image_reply").appendChild(canvas);
		// 	$('#img_front').val(canvas.toDataURL("image/png"));
		// });
		// const canvasFront = document.getElementById("front_canvas");
		// const canvasCtxFront = canvasFront.getContext("2d");
		// console.log(document.getElementById("preview_front"))
		
		// const canvasBack = document.getElementById("back_canvas");
		// const canvasCtxBack = canvasBack.getContext("2d");
		// try {
	// 	domtoimage.toJpeg(frontPreview).then(function (dataURL) {
	// 		const frontImage = new Image();
	// 		frontImage.src = dataURL;
	// 		frontImage.onload = () => {
	// 			console.log(frontPreview);
	// 		};
	// 		document.getElementById("image_reply").appendChild(frontImage);
	// 	})
	// 	// $('#preview_front').hide();
	// 	// $('#preview_back').show();
	// 	domtoimage.toJpeg(backPreview).then(function (dataURL) {
	// 		const backImage = new Image();
	// 		backImage.src = dataURL;
	// 		backImage.onload = () => {
	// 			console.log(backPreview);
	// 			backPreview.classList.add("dis_none");
	// 		};
	// 		document.getElementById("image_reply").appendChild(backImage);
	// 	});

	// } catch (error) {
	// 	console.log(error)
	// }

	// html2canvas(backPreview).then(canvas => {
	// 	document.getElementById("image_reply").appendChild(canvas);
	// 	$('#img_back').val(canvas.toDataURL("image/png"));
	// 	backPreview.classList.add("dis_none");
	// });
}

function image_icon($srcimg) {
	$("." + $y_pos + "_print").append("<div id=icon" + ($nos_icons) + " class='new_icon' onmouseover='show_delete_btn(this);' onmouseout='hide_delete_btn(this);'><span class='delete_icon property_icon' onClick='delete_icons(this);'></span><img src='" + $srcimg + "' width='100%' height='100%' /></div>");
	$("#icon" + ($nos_icons) + "").draggable({ containment: "parent" });
	$("#icon" + ($nos_icons) + "").resizable({
		maxHeight: 480,
		maxWidth: 450,
		minHeight: 60,
		minWidth: 60
	});
	$("#icon" + ($nos_icons) + "").css({ 'top': '100px', 'left': '150px' });
	++$nos_icons;
}
function delete_icons(e) {

	$(e).parent('.new_icon').remove();

	--$nos_icons;
}
function show_delete_btn(e) {

	$(e).children('.property_icon').show();
}
function hide_delete_btn(e) {

	$(e).children('.property_icon').hide();
}
function delete_text(f) {
	$(f).parent('.new_text').remove();
	--$nos_icons;
}
function readURL(input) {
	if (input.files && input.files[0]) {
		var reader = new FileReader();
		reader.onload = function (e) {

			$("." + $y_pos + "_print").append("<div id='c_icon" + ($custom_img) + "' class='new_icon'><span class='delete_icon' onClick='delete_icons(this);' ></span><img src='#' id='c_img" + $custom_img + "' width='100%' height='100%' /></div>");
			$("#c_icon" + ($custom_img) + "").draggable({ containment: "parent" });
			$("#c_icon" + ($custom_img) + "").resizable({
				maxHeight: 480,
				maxWidth: 450,
				minHeight: 60,
				minWidth: 60
			});


			$("#c_img" + ($custom_img) + "").attr('src', e.target.result);
			++$custom_img;
		};
		reader.readAsDataURL(input.files[0]);
	}
}

loadProductData();