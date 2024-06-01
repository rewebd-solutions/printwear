/* Initial Product Data */
var Product = {};

var productData = {};

/* Canvas Object - fabric.Canvas */
let fabricCanvas = null;

/* Design Side */
let designDirection = "front";

/* Storing Canvas State */
let canvasState = {
  front: null,
  back: null,
};

/** storing design image ids and names so that i can switch em back when changing sides */
var designImages = {
  front: null,
  back: null
}

/* Design Image Dimensions */
let designImg, designImageWidth, designImageHeight;

var globalProductID = null;

var isSetPixelRatioCalled = false;

var variantPrice = 0;

// storing back design printing price to show in criteria table
var backPrintingPrice = 0;
var frontPrintingPrice = 0;

/* var for letting top.ejs know there is this var */
var isReadyForRendering = true;

var neckLabelId = null;
var isNeckLabelSelected = false;

var savedState = {
  front: false,
  back: false
}

// Design ID from backend before save has been triggered once
var dbDesignId = null;

/* Notfy - Notification Snackbar */
var notyf = new Notyf();
/* Initialize Animate On Scroll */
AOS.init();

/* Fetch product data based on query parameter 'style' */
const fetchProductData = async () => {
  try {
    const styleParam = new URLSearchParams(location.search).get("style");
    if (!styleParam) {
      document.body.style.overflowY = "hidden";
      document.querySelector(".App").insertAdjacentHTML(
        "beforeend",
        `
      <div class="design-upload-backdrop" style="z-index:105; position: fixed;">
        <div class="design-upload-modal" data-aos="fade-up" style="justify-content: center; align-items: center">
          <img src="/images/missing-shirt.png" width="200" />
          Oops! Select a design from Product Gallery before proceeding!
          <a href="/productgallery"><button class="">Choose my design</button></a>
          Redirecting now! Please wait!
        </div>
      </div>
      `
      );
      notyf.error({
        message: "style paramater not defined in URL",
        duration: 6000,
        dismissible: true,
      });
      return (location.href = "/productgallery");
    }

    const productStyle = styleParam.split("+").join(" ");

    if (!productStyle) {
      return notyf.error({
        message: "Invalid URL",
        dismissible: true,
        duration: 5000,
      });
    }

    document.querySelector(".heading").innerHTML = productStyle;
    const productDataRequest = await fetch("/getzohoproducts");
    const productDataResponse = await productDataRequest.json();
    productData = productDataResponse[productStyle];
    // console.log(productData);
    productData.name = productStyle;

    const sizeOrder = {
      XS: 0,
      S: 1,
      M: 2,
      L: 3,
      XL: 4,
      "2XL": 5,
      "3XL": 6,
      "4XL": 7,
      "5XL": 8,
      "6XL": 9,
    };

    /* Modify Product Object */
    Product = {
      ...productData,
      brand: productData.brand,
      name: productData.name,
      description: productData.description,
      category: productData.group,
      colors: Object.keys(productData.colors).map((color, i) => {
        return {
          _id: i,
          colorName: color,
          hex: productData.colors[color].colorCode,
          colorImage: {
            front: productData.colors[color].frontImage,
            back: productData.colors[color].backImage,
          },
          sizes: Object.keys(productData.colors[color].sizes)
            .map((size, i) => {
              return {
                id: productData.colors[color].sizes[size].id,
                sizeSku: productData.colors[color].sizes[size].sku,
                size: size,
                stock: productData.colors[color].sizes[size].stock,
                name: productData.colors[color].sizes[size].name,
                price: productData.colors[color].sizes[size].price,
                dimensions: productData.colors[color].sizes[size].dimensions,
              };
            })
            .sort((a, b) => sizeOrder[a.size] - sizeOrder[b.size]),
        };
      }),
    };
    
    /* First Available Color = Current Color by default */
    currentColor = Product.colors.find((color) => color.frontImage != "")?._id; // declare currentColor here like global var

    /* Global Function Calls */
    renderColors();
    loadMockupImage();
    displaySizes();
  } catch (error) {
    // console.log(error);
    notyf.error({
      message: "There was an error trying to fetch product details!",
      dismissible: true,
      ripple: false,
    });
  }
};

/* Active and Inactive button styles */
const positionChangeButtons = document.querySelectorAll(".position-btn");
const sideChangeButtons = document.querySelectorAll(".side-btn");
const textInputBox = document.querySelector("#canvas-text-input");

const userDesignsWrapper = document.querySelector(".user-design-images");
const userLabelsWrapper = document.querySelector(".user-label-images");

/* Toggle Disable and Enable button */
const disableButton = (state, text = "Saving...") => {
  const saveButton = document.querySelector(".save-button");
  state
    ? saveButton.setAttribute("disabled", true)
    : saveButton.removeAttribute("disabled");
  state
    ? saveButton.classList.add("disabled")
    : saveButton.classList.remove("disabled");
  state
    ? (saveButton.innerHTML = text)
    : (saveButton.innerHTML = `<i class="fa-regular fa-page"></i> Save Design`);
};

/** Disable function for switching sides when saving */
const disableSideSwitch = (state) => {
  const sideBtns = document.querySelectorAll(".sides-list button");
  sideBtns.forEach(sideBtn => state ? sideBtn.classList.add("disabled") : sideBtn.classList.remove("disabled"))
}

/* Change Current Color and Current Image */
const changeMockup = (e, color, id) => {
  let mockupImageContainer = document.getElementById("mockup-image");

  let selectedMockup = Product.colors.find((color) => color._id === id);
  const element = document.getElementById(`${color}-${id}`);

  // console.log(e.target);

  renderColorBorder(color, id);
  globalProductID = null;
  currentColor = id;
  displaySizes();

  if (designDirection === "front") {
    mockupImageContainer.src =
      selectedMockup.colorImage.front != ""
        ? selectedMockup.colorImage.front
        : "/images/warning.png";
  } else
    mockupImageContainer.src =
      selectedMockup.colorImage.back != ""
        ? selectedMockup.colorImage.back
        : "/images/warning.png";
};

/* Active Color Styles */
const renderColorBorder = (color, id) => {
  const colorButtons = document.querySelectorAll(".color-circle");
  const currentColor = document.getElementById(`${color}-${id}`);
  colorButtons.forEach(
    (colorButton) => (colorButton.style.border = "2px solid #6a6969")
  );
  currentColor.style.border = "3px solid red";
};

/* Display available Colors */
const renderColors = () => {
  const parent = document.querySelector(".color-list");
  parent.innerHTML = "";
  Product.colors.map((color) => {
    const innerHTML = `${
      (color.colorImage.front || color.colorImage.back)
        ? `
    <div class="color-options" onclick="changeMockup(event, '${
      color.colorName
    }', ${color._id})">
      <span class="color-circle" style="background: ${color.hex}; border: 
      ${
        color._id === currentColor ? "3px solid red" : "2px solid #6a6969;"
      }" id="${color.colorName}-${color._id}"></span>
      <p>${color.colorName}</p>
    </div>
    `
        : ``
    }
    
    `;
    parent.innerHTML += innerHTML;
  });
};

/* Load First Mockup Image */
const loadMockupImage = () => {
  const image = document.getElementById("mockup-image");
  image.src = Product.colors.find(
    (color) => color._id === currentColor
  ).colorImage.front;
};

/* Caculate dimensions of Active Canvas Objects */
const calculateTotalHeight = () => {
  if (!fabricCanvas) return;
  const objects = fabricCanvas.getObjects();
  let totalHeight = objects
    .map((obj) => obj.getScaledHeight() * Product.pixelToInchRatio)
    .reduce((prev, curr) => prev + curr, 0);
  return totalHeight;
};

const calculateTotalWidth = () => {
  if (!fabricCanvas) return;
  const object = fabricCanvas.getObjects()[0];
  let totalWidth = object
    ? object.getScaledWidth() * Product.pixelToInchRatio
    : 0;
  console.log(totalWidth);
  return totalWidth;
};

const calculateTotalArea = () => {
  if (!fabricCanvas) return;
  const objects = fabricCanvas.getObjects();
  let totalArea = objects
    .map(
      (obj) =>
        obj.getScaledHeight() *
        obj.getScaledWidth() *
        Product.pixelToInchRatio *
        Product.pixelToInchRatio
    )
    .reduce((prev, curr) => prev + curr, 0);
  return totalArea;
};

/* Design Image Stats */
const table = document.querySelector("#price-stats");
const priceTable = table.children[1];

// input field for the height and width
const designHeightInput = document.querySelector("#design-height");
const designWidthInput = document.querySelector("#design-width");

const capitalizeFirst = (string) => {
  return string[0].toUpperCase() + string.slice(1);
};

designHeightInput.oninput = (e) => {
  const heightInInches = e.target.value / Product.pixelToInchRatio;
  if (heightInInches <= 0 || !fabricCanvas.getObjects()[0]) return;
  fabricCanvas.getObjects()[0].scaleToHeight(heightInInches);
  designWidthInput.value = fabricCanvas.getObjects()[0].getScaledWidth() * Product.pixelToInchRatio
  updateStats(false)
  fabricCanvas.renderAll();
}

designWidthInput.oninput = (e) => {
  const widthInInches = e.target.value / Product.pixelToInchRatio;
  if (widthInInches <= 0 || !fabricCanvas.getObjects()[0]) return;
  fabricCanvas.getObjects()[0].scaleToHeight(widthInInches);
  designHeightInput.value =
    fabricCanvas.getObjects()[0].getScaledHeight() * Product.pixelToInchRatio;
    updateStats(false)
  fabricCanvas.renderAll();
}

/* Change Direction Name in Stats */
const changeStatName = () => {
  table.style.display = "table";

  /* Updating Design Direction Name */
  const curDirection = capitalizeFirst(designDirection);
  priceTable.children[0].children[0].innerHTML =
    curDirection + " Design Height";
  priceTable.children[1].children[0].innerHTML = curDirection + " Design Width";
  priceTable.children[2].children[0].innerHTML = curDirection + " Design Area";
  priceTable.children[7].children[0].innerHTML =
    (curDirection === "Front" ? "Back" : "Front") + " Design price";
};

const updateStats = (shouldUpdateInput = true) => {
  // console.log("update stats called");
  changeStatName();

  if (!designImg && !canvasState.front && !canvasState.back) {
    // priceTable.children[0].children[1].innerHTML = "0 in";
    // priceTable.children[1].children[1].innerHTML = "0 in";
    designHeightInput.value = 0;
    designWidthInput.value = 0;
    // priceTable.children[0].children[1].children[1] = " in";
    // priceTable.children[1].children[1].children[1] = " in";
    priceTable.children[2].children[1].innerHTML = "0 in²";
    priceTable.children[3].children[1].innerHTML = "₹" + variantPrice;
    priceTable.children[4].children[1].innerHTML = "₹0";
    priceTable.children[5].children[1].innerHTML = "₹" + variantPrice;
    const imageHeightInInches =
      canvasState[designDirection == "front" ? "back" : "front"] &&
      canvasState[designDirection == "front" ? "back" : "front"].objects.reduce(
        (ttl, curr) =>
          ttl +
          (curr.height * curr.scaleY) / Product.inchToPixelRatio,
        0
      );
    const imageWidthInInches =
      canvasState[designDirection == "front" ? "back" : "front"] &&
      canvasState[designDirection == "front" ? "back" : "front"].objects.reduce(
        (ttl, curr) =>
          ttl +
          (curr.width * curr.scaleX) / Product.inchToPixelRatio,
        0
      );
    const imageAreaInInches = imageWidthInInches * imageHeightInInches * Product.pixelToInchRatio * Product.pixelToInchRatio
    let printingPrice =
    imageHeightInInches <= 8.0 &&
    imageWidthInInches <= 8.0 &&
    imageHeightInInches > 0 &&
    imageWidthInInches > 0
      ? 70.0
      : imageAreaInInches * 1 < 70.0 && imageAreaInInches * 1 > 0.5
      ? 70.0
      : imageAreaInInches * 1;
    priceTable.children[8].children[1].innerHTML = "₹" + ((isNeckLabelSelected? 10: 0) + printingPrice + variantPrice);
    return;
  }

  let imageHeightInInches = calculateTotalHeight().toFixed(2);
  let imageWidthInInches = calculateTotalWidth().toFixed(2);
  let imageAreaInInches = calculateTotalArea().toFixed(2);

  let printingPrice =
    imageHeightInInches <= 8.0 &&
    imageWidthInInches <= 8.0 &&
    imageHeightInInches > 0 &&
    imageWidthInInches > 0
      ? 70.0
      : imageAreaInInches * 1 < 70.0 && imageAreaInInches * 1 > 0.5
      ? 70.0
      : imageAreaInInches * 1;
  if(shouldUpdateInput) {
    designHeightInput.value = imageHeightInInches;
    designWidthInput.value = imageWidthInInches;
  }
  priceTable.children[2].children[1].innerHTML = imageAreaInInches + " in²";
  priceTable.children[3].children[1].innerHTML = "₹" + variantPrice;
  priceTable.children[4].children[1].innerHTML = "₹" + printingPrice.toFixed(2);
  priceTable.children[5].children[1].innerHTML =
    "₹" + (printingPrice + variantPrice).toFixed(2);
  priceTable.children[6].children[0].innerHTML = isNeckLabelSelected
    ? "Neck Label(selected)"
    : "Neck Label(not selected)";
  priceTable.children[6].children[1].innerHTML = isNeckLabelSelected
    ? "₹10"
    : "₹0";

  if (designDirection === "front") {
    frontPrintingPrice = printingPrice;
    priceTable.children[7].children[1].innerHTML = "₹" + backPrintingPrice;
    priceTable.children[8].children[1].innerHTML = isNeckLabelSelected
      ? "₹" + (printingPrice + backPrintingPrice + variantPrice + 10).toFixed(2)
      : "₹" + (printingPrice + backPrintingPrice + variantPrice).toFixed(2);
  } else {
    backPrintingPrice = printingPrice;
    priceTable.children[7].children[1].innerHTML = "₹" + frontPrintingPrice;
    priceTable.children[8].children[1].innerHTML = isNeckLabelSelected
      ? "₹" +
        (printingPrice + frontPrintingPrice + variantPrice + 10).toFixed(2)
      : "₹" + (printingPrice + frontPrintingPrice + variantPrice).toFixed(2);
  }
};

const changeSize = (e, size, id) => {
  const sizeButtons = document.querySelectorAll(".size-options");
  const basePriceElement = document.querySelector(".base-price");
  sizeButtons.forEach((sizeBtn) => {
    sizeBtn.style.border = "2px solid #6a6969";
    sizeBtn.style.background = "unset";
    sizeBtn.style.color = "black";
    sizeBtn.style.transform = "scale(1.0)";
  });
  e.target.style.border = "2px solid red";
  e.target.style.background = "red";
  e.target.style.color = "white";
  e.target.style.transform = "scale(1.1)";
  // console.log(id, size);
  globalProductID = id; // check b4 downloading or saving if this is checked

  variantPrice = Product.colors
    .find((color) => color._id === currentColor)
    .sizes.find((size) => size.id === globalProductID).price;
  basePriceElement.innerHTML = "Base Price: ₹" + variantPrice;
  updateStats();

  if (!isSetPixelRatioCalled) setPixelRatio(globalProductID);
  // also write code to change ratio dimensions
};

/* Available Sizes of Current Color */
const displaySizes = () => {
  const parent = document.querySelector(".size-list");
  parent.innerHTML = "";
  const current = Product.colors.find((item) => item._id === currentColor);
  let sizeDOMString = current.sizes
    .map((item) => {
      return `
        <div class="size-options" onclick="changeSize(event,'${item.size}', '${item.id}')">
        ${item.size}
        </div>
      `;
    })
    .join("");
  parent.innerHTML = sizeDOMString;
};
/*
  #### Formula ###
  500px = 28 inch
  1px = 28/500 inch
  1 inch = 500/28 px
*/
const setPixelRatio = (productID) => {
  // call this func only after a variant has been selected.. and modify the code such that the ratios modify according the size variant
  isSetPixelRatioCalled = true;
  currentProductVariant = Product.colors
    .find((color) => color._id === currentColor)
    .sizes.find((size) => size.id === productID);
  // console.log(currentProductVariant);
  Product.pixelToInchRatio = currentProductVariant.dimensions.length / 500;
  Product.inchToPixelRatio = 500 / currentProductVariant.dimensions.length;
  addFabricCanvasToTemplateDiv();
};

/* Intialize fabric JS Canvas */
const addFabricCanvasToTemplateDiv = () => {
  const container = document.querySelector("#mockup-image-canvas");
  /* Create a canvas element */
  const canvasElement = document.createElement("canvas");
  /* Setting width and height according to ratio */
  canvasElement.width = Product.inchToPixelRatio * Product.canvas.front.width;
  canvasElement.height = Product.inchToPixelRatio * Product.canvas.front.height;
  canvasElement.style.border = "2px dashed black";
  container.appendChild(canvasElement);

  /* Initialize fabric Canvas Instance */
  fabricCanvas = new fabric.Canvas(canvasElement);

  fabricCanvas.skipOffscreen = true;
  fabricCanvas.stateful = true;
  fabricCanvas.uniformScaling = true;

  /* Disabling out of canvas image movement */
  //// Not necessary as this feature does not exist in old printwear
  // fabricCanvas.on("object:moving", function (event) {
  //   var designImg = event.target;
  //   var canvasWidth = fabricCanvas.width;
  //   var canvasHeight = fabricCanvas.height;

  //   var imgLeft = designImg.left;
  //   var imgTop = designImg.top;
  //   var imgWidth = designImg.getScaledWidth();
  //   var imgHeight = designImg.getScaledHeight();

  //   if (imgLeft < 0) {
  //     designImg.set({ left: 0 });
  //   } else if (imgLeft + imgWidth > canvasWidth) {
  //     designImg.set({ left: canvasWidth - imgWidth });
  //   }

  //   if (imgTop < 0) {
  //     designImg.set({ top: 0 });
  //   } else if (imgTop + imgHeight > canvasHeight) {
  //     designImg.set({ top: canvasHeight - imgHeight });
  //   }
  // });

  fabricCanvas.on("object:scaling", function (event) {
    designImg = event.target;

    /* Updating sizes during scaling */
    designImageHeight = designImg.getScaledHeight();
    designImageWidth = designImg.getScaledWidth();
    updateStats();
  });
};

/* Load previous state */
const loadState = () => {
  if (!fabricCanvas) return;
  if (canvasState[designDirection] === null) fabricCanvas.clear();
  else fabricCanvas.loadFromJSON(canvasState[designDirection], updateStats);
  // else fabricCanvas.loadFromJSON(canvasState[designDirection], fabricCanvas.renderAll.bind(fabricCanvas), function (o, obj) {
    // console.log(o, obj);
  //   updateStats();
  // });
  updateStats();
  // console.log("updateStatsCalled");
};

/** remove design image function */
const deleteDesignImage = () => {
  designImg = null;
  designImages[designDirection] = null;
  updateStats();
  fabricCanvas.remove(fabricCanvas.getObjects()[0]);
  document
    .querySelectorAll(".user-design-image")
    .forEach((element) => element.classList.remove("active-selection"));
    const removeBtn = document.querySelector(".remove-design");
  if (removeBtn) {
    removeBtn.removeEventListener("click", handleImageRemove);
    removeBtn.remove();
  }
  updateStats()
}

const handleImageRemove = (e) => {
  e.stopPropagation();
  deleteDesignImage();
  const idToDelete = e.target.parentElement.getAttribute("data-id");
}

/* Add Image to Canvas */
const addImageToCanvas = async (e, el, imageURL, imageId) => {
  if (!globalProductID)
    return notyf.error("Select a shirt size before applying");
  if (!imageURL) return notyf.error("Invalid image, please try another");

  fabricCanvas.getObjects().map((obj) => fabricCanvas.remove(obj)); // remove all stuff before adding image

  designImages[designDirection] = imageId;

  document
    .querySelectorAll(".user-design-image")
    .forEach((element) => {
      element.classList.remove("active-selection")
      const removeBtn = document.querySelector(".remove-design")
      if (removeBtn) {
        removeBtn.removeEventListener("click", handleImageRemove);
        removeBtn.remove()
      };
    });
  el.classList.add("active-selection");
  el.innerHTML += `<button class="remove-design"><i class="fa fa-close"></i></button>`;

  document.querySelector(".remove-design").addEventListener("click", handleImageRemove)

  const blobReq = await fetch(imageURL);
  const blobRes = await blobReq.blob();
  designImg = blobRes;
  if (imageURL && fabricCanvas) {
    const imageURL = URL.createObjectURL(designImg);
    fabric.Image.fromURL(imageURL, (designImage) => {
      designImage.scaleToHeight(100);
      designImage.minScaleLimit = 0.05;

      /* Updating Sizes */
      designImageHeight = designImage.getScaledHeight();
      designImageWidth = designImage.getScaledWidth();

      designImg = designImage;

      /* Locking Scaling and Rotating */
      designImage.lockScalingFlip = true;
      designImage.lockSkewingX = true;
      designImage.lockSkewingY = true;

      /* Hiding Controls Visibility */
      designImage.setControlsVisibility({
        mb: false,
        mt: false,
        mr: false,
        ml: false,
      });

      fabricCanvas.add(designImage);
      updateStats();
      fabricCanvas.setActiveObject(designImage);

      const canvasWidth = fabricCanvas.width;
      const canvasHeight = fabricCanvas.height;

      fabricCanvas.getActiveObject().set({
        left: (canvasWidth - designImage.getScaledWidth()) / 2,
        top: (canvasHeight - designImage.getScaledHeight()) / 2,
      });
    });
  }
};

/* Change Design Area Side */
const changeSide = (e, side) => {
  /* Storing canvas state */
  disableButton(savedState.side, "Saved")
  if (fabricCanvas) canvasState[designDirection] = fabricCanvas.toJSON();

  sideChangeButtons.forEach((sideBtn) =>
    sideBtn.classList.remove("active-btn")
  );
  e.target.classList.add("active-btn");

  let selectedMockup = Product.colors.find(
    (mockup) => mockup._id === currentColor
  );
  designDirection = side;
  if (designDirection === "front")
    document.getElementById("mockup-image").src =
      selectedMockup.colorImage.front == ""
        ? "images/warning.png"
        : selectedMockup.colorImage.front;
  else
    document.getElementById("mockup-image").src =
      selectedMockup.colorImage.back == ""
        ? "images/warning.png"
        : selectedMockup.colorImage.back;

  document
    .querySelectorAll(".user-design-image")
    .forEach((element) => {
      element.classList.remove("active-selection")
      const removeBtn = document.querySelector(".remove-design");
      if (removeBtn) {
        removeBtn.removeEventListener("click", handleImageRemove);
        removeBtn.remove();
      }
    });
  
    if (designImages[designDirection]) {
      const currDes = document.querySelector(`[data-id='${designImages[designDirection]}']`)
      currDes.classList.add("active-selection");
      currDes.innerHTML += `<button class="remove-design"><i class="fa fa-close"></i></button>`;
      document
        .querySelector(".remove-design")
        .addEventListener("click", handleImageRemove);
  }

  // console.log("direction: " + designDirection);
  loadState();
  // changeStatName();
};

/* Download Image */
const downloadDesign = () => {
  // Deselecting active object
  if (!designImg) return notyf.error("No design selected!");
  if (fabricCanvas.getActiveObject()) {
    fabricCanvas.discardActiveObject().renderAll();
  }

  const designName = document.getElementById("design-name");
  let isDesignNameValid = designName.reportValidity();
  if (!isDesignNameValid) {
    return notyf.error("Give your design a name");
  }

  // disable border when rendering final image
  const canvasContainer = document.querySelectorAll(".canvas-container > *");
  canvasContainer.forEach((item) => (item.style.border = "none"));

  const node = document.getElementById("product-design");

  const config = {
    width: node.offsetWidth * 2,
    height: node.offsetHeight * 2.5,
    style: {
      transformOrigin: "0 0",
      transform: "scale(2)",
    },
    copyDefaultStyles: true,
  };

  // Use a short delay to ensure the browser has updated the DOM with the transform
  setTimeout(() => {
    // console.log(fabricCanvas.getObjects());

    /* tried html2canvas, which yeets a canvas again.. no use */
    html2canvas(node, { userCORS: true, allowTaint: true, scale: 1.0 }).then(x => console.log(x)).catch(x => console.log(x))

    domtoimage.toBlob(node, config).then(function (blob) {
      // Restore original transformation
      // console.log(`yeppa aavdhaa ${blob}`);
      window.saveAs(
        blob,
        userName +
          "_" +
          designName.value +
          "_" +
          new Date().toLocaleTimeString() +
          "-" +
          designDirection +
          ".png"
      );
      // console.log("front image saved?");
      // change design direction and convert image

      /* rest of code to change direction of canvas and then download again */
      // designDirection == "front"? designDirection = "back": designDirection = "front";

      // loadState();
    //  console.log('sate changed');

      // setTimeout(() => {
      //   domtoimage.toBlob(node, config).then(function (blob) {
      //     window.saveAs(
      //       blob,
      //       userName +
      //       "_" +
      //       designName.value +
      //       "_" +
      //       new Date().toLocaleTimeString() +
      //       "-" +
      //       designDirection +
      //       ".png"
      //   )});
      // }, 200);

      // designDirection == "front"? designDirection = "back": designDirection = "front";

      canvasContainer.forEach(
        (item) => (item.style.border = "2px dashed black")
      );
    });
  }, 100);
};

/* Save to Cloud */
const saveDesign = async () => {
  // lot of repeating code, can be optimized later
  if (!globalProductID) return notyf.error("Select a size before continuing!");
  let isSaveSuccessful = false;

  const designName = document.getElementById("design-name");
  let isDesignNameValid = designName.reportValidity();
  if (!isDesignNameValid) {
    return notyf.error("Give your design a name");
  }

  const SKU = document.getElementById("sku-name");

  if (fabricCanvas.getActiveObject()) {
    fabricCanvas.discardActiveObject().renderAll();
  }

  /* Remove Border for Final Image Rendering */
  
  try {
    disableButton(true);
    disableSideSwitch(true);
    const canvasContainer = document.querySelectorAll(".canvas-container > *");
    canvasContainer.forEach((item) => (item.style.border = "none"));

    const node = document.getElementById("product-design");

    const config = {
      width: node.offsetWidth * 2,
      height: node.offsetHeight * 2.5,
      style: {
        transformOrigin: "0 0",
        transform: "scale(2)",
      },
      copyDefaultStyles: true,
    };

    /* this is the old method where all the client images get sent to the server and everything is uploaded
    but since, they changed it to have only one image, comment the below block, query select active desing,
    send the URL to the formData, then send the design image blob separately. */

    let designImageURL =
      document.querySelector(".active-selection").children[0].src;
    let designImageName =
      document.querySelector(".active-selection").children[1].innerText;

    let submitProduct = Product.colors
      .find((x) => x._id === currentColor)
      .sizes.find((size) => size.id === globalProductID);

    let designModelObject = {
      productId: Product._id,
      product: {
        id: submitProduct.id,
        name: submitProduct.name,
        style: Product.name,
        color: Product.colors.find((x) => x._id === currentColor).colorName,
        hex: Product.colors.find((x) => x._id === currentColor).hex,
        size: submitProduct.size,
        SKU: submitProduct.sizeSku,
        price: submitProduct.price,
        baseImage: {
          front: Product.colors.find((x) => x._id === currentColor).colorImage
            .front,
          back: Product.colors.find((x) => x._id === currentColor).colorImage
            .back,
        },
        dimensions: submitProduct.dimensions,
      },
      designName: designName.value,
      designSKU: SKU.value,
      price: parseFloat(calculateTotalArea().toFixed(2)), //sending only area because can't trust client with sending calculated price
    };

    if (designDirection == "front") {
      designModelObject.designDimensions = {
        width: parseFloat(calculateTotalWidth().toFixed(3)),
        height: parseFloat(calculateTotalHeight().toFixed(3)),
        top: parseFloat(
          (fabricCanvas.getObjects()[0].top * Product.pixelToInchRatio).toFixed(
            3
          )
        ),
        left: parseFloat(
          (
            fabricCanvas.getObjects()[0].left * Product.pixelToInchRatio
          ).toFixed(3)
        ),
      }
    } else {
      designModelObject.backDesignDimensions = {
        width: parseFloat(calculateTotalWidth().toFixed(3)),
        height: parseFloat(calculateTotalHeight().toFixed(3)),
        top: parseFloat(
          (fabricCanvas.getObjects()[0].top * Product.pixelToInchRatio).toFixed(
            3
          )
        ),
        left: parseFloat(
          (
            fabricCanvas.getObjects()[0].left * Product.pixelToInchRatio
          ).toFixed(3)
        ),
      }
    }
    // console.log(submitProduct);
    // console.log(designModelObject);
    //console.log(filesFromBlobs)

    domtoimage.toBlob(node, config).then(async (blob) => {
      const formData = new FormData();
      formData.append(
        "designImage",
        new File(
          [blob],
          "ProductDesign-" + designName.value + "-" + designDirection + ".png",
          { type: "image/png" }
        )
      );
      // add back image to same designImage
      // formData.append(
      //   "designHeight",
      //   parseFloat(calculateTotalHeight().toFixed(2))
      // );
      // formData.append(
      //   "designWidth",
      //   parseFloat(calculateTotalWidth().toFixed(2))
      // );
      formData.append("productData", JSON.stringify(designModelObject));
      formData.append("neckLabel", neckLabelId);
      formData.append("direction", designDirection);
      formData.append("designImageURL", designImageURL);
      formData.append("designImageName", designImageName);
      formData.append("designId", dbDesignId);

      formData.forEach((v, k) => console.log(k, v))
      // return;

      const saveDesignRequest = await fetch("/createdesign", {
        method: "POST",
        body: formData,
      });

      const saveDesignResponse = await saveDesignRequest.json();
      // console.log(saveDesignResponse);

      if (!saveDesignRequest.ok) {
        throw new Error({ reason: "Save failed!", error: saveDesignResponse.error ?? saveDesignResponse.message });
      }
      isSaveSuccessful = true;

      document.querySelector(".save-button").innerHTML = "Saved!";
      notyf.success("Design saved successfully!");

      savedState[designDirection] = true;
      disableSideSwitch(false);

      if (!dbDesignId) {
        dbDesignId = saveDesignResponse.designs.at(-1)._id;
        scrollTo({ top: 0, left: 0, behavior: "smooth" });
        document.querySelector(".App").insertAdjacentHTML(
          "afterend",
          `
          <!-- modal for not asking users to pay and make orders -->
          <div class="warning-moda-wrapper">
            <div class="warning-modal">
              <button onclick="document.querySelector('.warning-moda-wrapper').remove()"
                style="margin-left: auto;padding: 0.4rem 0.8rem; cursor: pointer; border: none; outline: 1px solid silver; border-radius: 100%;"><i class="fa fa-xmark"></i></button>
                Design for ${designDirection} was saved successfully!<br />
                <img src="images/tuto.png" alt="Instruction to save back image">
                <br />
                To save ${
                  designDirection == "front" ? "back" : "front"
                } design, click ${
                  designDirection == "front" ? "Back" : "Front"
                } button as shown in the image and save it again
            </div>
          </div>
        `
        );
      }

      /** check if page has been navigated to, from orders la create new design */
      const searchParams = new URLSearchParams(location.search);
      let hasBeenRedirected = searchParams.get("from") === "orders";
      const orderId = hasBeenRedirected ? searchParams.get("id") : null;

      if (hasBeenRedirected) {
        const saveDesignButton = document.querySelector(".save-button");

        saveDesignButton.innerHTML = "Adding to order...";

        const latestDesign = saveDesignResponse.designs.at(-1);

        const addToOrderReq = await fetch("/createorder", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            designId: latestDesign._id,
            productId: latestDesign.productId,
            price: latestDesign.price,
          }),
        });
        const addToOrderRes = await addToOrderReq.json();
        // console.log(addToOrderRes);

        if (!addToOrderReq.ok) {
          throw new Error("Couldn't add design to order");
        }

        notyf.success("Added to orders, redirecting to order page");
        setTimeout(() => {
          location.href = "/placeorder";
        }, 3000);
      }
      // disableButton(false);
      canvasContainer.forEach(
        (item) => (item.style.border = "2px dashed black")
      );
    }).catch(error => {
      // console.log(error);
      notyf.error(error.error ?? error.message);
      disableButton(false);
      disableSideSwitch(false);
      canvasContainer.forEach(
        (item) => (item.style.border = "2px dashed black")
      );
    });
  } catch (error) {
    // console.log(error);
    notyf.error(error.error ?? error);
    disableButton(false);
    disableSideSwitch(false);
    canvasContainer.forEach(
      (item) => (item.style.border = "2px dashed black")
    );
  } 
  return isSaveSuccessful;
};

/* Set Design Position */
const setPosition = (e, position) => {
  if (!fabricCanvas) return;
  // Changing position of selected image
  const designImage = fabricCanvas.getObjects()[0];
  if (!designImage) return;

  const canvasWidth = fabricCanvas.width;
  const canvasHeight = fabricCanvas.height;

  positionChangeButtons.forEach((positionBtn) =>
    positionBtn.classList.remove("active-btn")
  );
  e.target.classList.add("active-btn");

  switch (position) {
    case "top-left":
      designImage.set({ left: 0, top: 0 });
      break;
    case "top-right":
      designImage.set({
        left: canvasWidth - designImage.getScaledWidth(),
        top: 0,
      });
      break;
    case "bottom-left":
      designImage.set({
        left: 0,
        top: canvasHeight - designImage.getScaledHeight(),
      });
      break;
    case "bottom-right":
      designImage.set({
        left: canvasWidth - designImage.getScaledWidth(),
        top: canvasHeight - designImage.getScaledHeight(),
      });
      break;
    case "center":
      fabricCanvas.centerObject(designImage);
      break;
    case "custom":
      // No operation.
      break;
  }

  designImage.setCoords();
  fabricCanvas.renderAll();
};

const modifySKUInput = (event) => {
  let string = event.target.value;
  event.target.value = string
    .replace(/ /g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toUpperCase()
    .slice(0, 10);
};

const populateUserDesigns = (data = userDesignResponse) => {
  userDesignsWrapper.innerHTML = "";
  if (!data || data.images.length === 0)
    return (userDesignsWrapper.innerHTML = "No uploads yet!");
  userDesignsWrapper.innerHTML = data.images.map((imageItem) => {
    let currentImage = new Image();
    currentImage.src = imageItem.url;

     return `
    <div class="user-design-image" onclick="addImageToCanvas(event, this, this.children[0].src, '${imageItem._id}')" data-id='${imageItem._id}'>
      <img src="${imageItem.url}" alt="" loading="lazy">
      <p>${imageItem.name}</p>
    </div>`;
    // currentImage.addEventListener("load", () => {
    // })
  }).reverse().join('\n');

  if (designImages[designDirection])
      document.querySelector(`[data-id='${designImages[designDirection]}']`).classList.add("active-selection")
};

const fetchUserDesigns = async () => {
  try {
    const userDesignRequest = await fetch("/obtainimages");
    userDesignResponse = await userDesignRequest.json();
    if (userDesignRequest.ok) {
      populateUserDesigns();
    }
  } catch (error) {
    // console.log(error);
    notyf.error("Something went wrong!");
  }
};

const populateUserLabels = (data = userLabelsResponse) => {
  userLabelsWrapper.innerHTML = "";
  // console.log(data);
  if (!data || data.labels.length == 0)
    return (userLabelsWrapper.innerHTML = "No labels yet!");
  userLabelsWrapper.innerHTML = data.labels.map((imageItem) => {
    let currentImage = new Image();
    currentImage.src = imageItem.url;

    return `
    <div class="user-label-image" onclick="selectLabel(this, '${imageItem._id}')">
      <img src="${imageItem.url}" loading="lazy" alt="${imageItem.name}">
      <p>${imageItem.name}</p>
    </div>`;
  }).reverse().join('\n');
};

const fetchUserLabels = async () => {
  try {
    const userLabelsRequest = await fetch("/obtainlabels");
    userLabelsResponse = await userLabelsRequest.json();
    if (userLabelsRequest.ok) {
      populateUserLabels();
    }
  } catch (error) {
    // console.log(error);
    notyf.error("Something went wrong in fetching labels!");
  }
};

const includeLabel = (decision) => {
  if (!decision) {
    userLabelsWrapper.style.opacity = 0.5;
    userLabelsWrapper.style.pointerEvents = "none";
    neckLabelId = null;
    isNeckLabelSelected = false;
    document
      .querySelectorAll(".user-label-image")
      .forEach((element) => element.classList.remove("active-selection"));
    updateStats();
  } else {
    userLabelsWrapper.style.opacity = 1;
    userLabelsWrapper.style.pointerEvents = "unset";
    isNeckLabelSelected = true;
  }
};

const selectLabel = (el, labelId) => {
  document
    .querySelectorAll(".user-label-image")
    .forEach((element) => element.classList.remove("active-selection"));
  el.classList.add("active-selection");
  neckLabelId = labelId;
  isNeckLabelSelected && updateStats();
  // upon selecting label, add 10 rupee to the total cost
};

// also create a fetch function to fetch the products data and obtain the specific style
//    based on query params passed to the route
fetchProductData();
fetchUserDesigns();
fetchUserLabels();

/* Delete Active Canvas Object with Delete */
document.addEventListener(
  "keydown",
  (e) => {
    if (e.keyCode === 46) {
      handleImageRemove(e);
    }
  },
  false
);

document.querySelector("#design-search").addEventListener("input", (e) => {
  const searchKey = e.target.value.trim();
  if (searchKey == "") return populateUserDesigns();
  const searchDesigns = userDesignResponse.images.filter((design) =>
    design.name.toLowerCase().includes(searchKey.toLowerCase())
  );
  // console.log(searchDesigns);
  if (searchDesigns.length == 0)
    return (userDesignsWrapper.innerHTML = "Invalid Search");
  populateUserDesigns({ images: searchDesigns });
});
