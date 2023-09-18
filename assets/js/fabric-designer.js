// Product data old for initializing
var Product = {};

// actual product data obtained from fetch()
const OLD_productData = {
  name: "BW MENS",
  brand: "BEWAKOOF",
  manufacturer: "PRINTWEAR",
  description: "Item available for designing",
  group: "BW",
  baseImage: {
    front: "./images/mens round neck/white-front.jpg",
    back: "./images/mens round neck/white-back.jpg",
  },
  colors: {
    Black: {
      frontImage: "./images/mens round neck/black-front.jpg",
      backImage: "./images/mens round neck/black-back.jpg",
      colorCode: "#000000",
      sizes: {
        "2XL": {
          id: "650580000000035017",
          name: "BW MENS RN BLACK-2XL",
          stock: 60,
          price: 550,
          sku: "BWRNBK2XL-M",
          dimensions: {
            length: 28,
            chest: 38,
            sleeve: 7.5,
            weight: 0.5,
          },
        },
        "3XL": {
          id: "650580000000035019",
          name: "BW MENS RN BLACK-3XL",
          stock: 50,
          price: 150,
          sku: "BWRNBK3XL-M",
          dimensions: {
            length: 28,
            chest: 38,
            sleeve: 7.5,
            weight: 0.5,
          },
        },
        "4XL": {
          id: "650580000000035021",
          name: "BW MENS RN BLACK-4XL",
          stock: 100,
          price: 150,
          sku: "BWRNBK4XL-M",
          dimensions: {
            length: 28,
            chest: 38,
            sleeve: 7.5,
            weight: 0.5,
          },
        },
        "5XL": {
          id: "650580000000035023",
          name: "BW MENS RN BLACK-5XL",
          stock: 0,
          price: 150,
          sku: "BWRNBK5XL-M",
          dimensions: {
            length: 28,
            chest: 38,
            sleeve: 7.5,
            weight: 0.5,
          },
        },
        L: {
          id: "650580000000035013",
          name: "BW MENS RN BLACK-L",
          stock: 200,
          price: 150,
          sku: "BWRNBKL-M",
          dimensions: {
            length: 28,
            chest: 38,
            sleeve: 7.5,
            weight: 0.5,
          },
        },
        M: {
          id: "650580000000035011",
          name: "BW MENS RN BLACK-M",
          stock: 100,
          price: 150,
          sku: "BWRNBKM-M",
          dimensions: {
            length: 28,
            chest: 38,
            sleeve: 7.5,
            weight: 0.5,
          },
        },
        S: {
          id: "650580000000035009",
          name: "BW MENS RN BLACK-S",
          stock: 0,
          price: 150,
          sku: "BWRNBKS-M",
          dimensions: {
            length: 28,
            chest: 38,
            sleeve: 7.5,
            weight: 0.5,
          },
        },
        XL: {
          id: "650580000000035015",
          name: "BW MENS RN BLACK-XL",
          stock: 0,
          price: 150,
          sku: "BWRNBKXL-M",
          dimensions: {
            length: 28,
            chest: 38,
            sleeve: 7.5,
            weight: 0.5,
          },
        },
        XS: {
          id: "650580000000035007",
          name: "BW MENS RN BLACK-XS",
          stock: 0,
          price: 150,
          sku: "BWRNBKXS-M",
          dimensions: {
            length: 28,
            chest: 38,
            sleeve: 7.5,
            weight: 0.5,
          },
        },
      },
    },
  },
  canvas: {
    front: {
      startX: 0,
      startY: 0,
      width: 13,
      height: 18,
    },
    back: {
      startX: 0,
      startY: 0,
      width: 13,
      height: 18,
    },
  },
};

var productData = {};

// Holds the canvas instance
let fabricCanvas = null;
// Starting design direction
let designDirection = "front";
// Storing design image, and its height and width
let designImg, designImageWidth, designImageHeight;

var globalProductID = null;

// notyf snackbar 
var notyf = new Notyf();

// fetch function and then global functions calling done here
const fetchProductData = async () => {
  try {
    // fetch call
    const productStyle = new URLSearchParams(location.search).get("style").split("+").join(" ");
    console.log(productStyle);
    if (!productStyle) {
      return notyf.error({
        message: "Invalid URL",
        dismissible: true,
        duration: 5000
      });
    }
    const productDataRequest = await fetch("/getzohoproducts");
    const productDataResponse = await productDataRequest.json();
    productData = productDataResponse[productStyle];
    console.log(productData);
    productData.name = productStyle;

    // modify Product to fill in details from fetch()
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
          sizes: Object.keys(productData.colors[color].sizes).map((size, i) => {
            return {
              id: productData.colors[color].sizes[size].id,
              sizeSku: productData.colors[color].sizes[size].sku,
              size: size,
              stock: productData.colors[color].sizes[size].stock,
              name: productData.colors[color].sizes[size].name,
              price: productData.colors[color].sizes[size].price,
              dimensions: productData.colors[color].sizes[size].dimensions,
            };
          }),
        };
      }),
    };
    console.log(Product);

    // Current selected color - first color is chosen as default
    currentColor = Product.colors.find((color) => color.frontImage != '')?._id // declare currentColor here like global var

    // call global funcs
    renderColors();
    loadMockupImage();
    displaySizes();
    // setPixelRatio() called inside displaySizes()
  } catch (error) {
    console.log(error);
    notyf.error({
      message: "There was an error trying to fetch product details!",
      dismissible: true,
      ripple: false,
    });
  }
};

// DOM select the buttons to draw border on active btn and replace other buttons with default styles
const positionChangeButtons = document.querySelectorAll(".position-btn");
const sideChangeButtons = document.querySelectorAll(".side-btn");
const textInputBox = document.querySelector("#canvas-text-input");

// Changing current color and its image
const changeMockup = (color, id) => {
  let mockupImageContainer = document.getElementById("mockup-image");

  let selectedMockup = Product.colors.find((color) => color._id === id);
  const element = document.getElementById(`${color}-${id}`);

  renderColorBorder(color, id);
  globalProductID = null;
  currentColor = id;
  element.style.border = "2px solid red";
  displaySizes();

  if (designDirection === "front"){
    mockupImageContainer.src = (selectedMockup.colorImage.front != '')? selectedMockup.colorImage.front : '/images/warning.png';
  } else mockupImageContainer.src = (selectedMockup.colorImage.back != '')? selectedMockup.colorImage.back : '/images/warning.png';
  document.querySelector(".loader").remove();
};

// func to draW border around active color
const renderColorBorder = (color, id) => {
  const colorButtons = document.querySelectorAll(".color-circle");
  const currentColor = document.getElementById(`${color}-${id}`);
  colorButtons.forEach(
    (colorButton) => (colorButton.style.border = "2px solid #6a6969")
  );
  currentColor.style.border = "2px solid red";
};

// Displaying the colors to user
const renderColors = () => {
  const parent = document.querySelector(".color-list");
  parent.innerHTML = '';
  Product.colors.map((color) => {
    const child = document.createElement("div");
    const innerHTML = `
    <div class="color-options" onclick="changeMockup('${color.colorName}', ${
      color._id
    })">
    <span class="color-circle" style="background: ${color.hex}; border: ${
      color._id === currentColor ? "2px solid red" : "2px solid #6a6969;"
    }" id="${color.colorName}-${color._id}"></span>
    <p>${color.colorName}</p>
    </div>
    `;
    child.innerHTML = innerHTML;
    child.style.margin = "0px 10px";
    parent.appendChild(child);
  });
};

// Loading first image of mockupImages
const loadMockupImage = () => {
  document.querySelector(".loader").remove();
  const image = document.getElementById("mockup-image");
  image.src = Product.colors.find(
    (color) => color._id === currentColor
  ).colorImage.front;
};

// Display design image stats
const updateStats = () => {
  const heightElement = document.querySelector(".height-design");
  const widthElement = document.querySelector(".width-design");
  if (!designImageHeight && !designImageWidth) {
    heightElement.innerHTML = "Height: 0 inches";
    widthElement.innerHTML = "Height: 0 inches";
  }
  heightElement.innerHTML =
    "Height " +
    (designImageHeight * Product.pixelToInchRatio).toFixed(2) +
    " inches";
  widthElement.innerHTML =
    "Width " +
    (designImageWidth * Product.pixelToInchRatio).toFixed(2) +
    " inches";
};

const changeSize = (e, size, id) => {
  const sizeButtons = document.querySelectorAll(".size-options");
  sizeButtons.forEach(sizeBtn => sizeBtn.style.border = "2px solid #6a6969");
  e.target.style.border = "2px solid red";
  console.log(id, size);
  globalProductID = id; // check b4 downloading or saving if this is checked
  setPixelRatio(globalProductID);
  // also write code to change ratio dimensions
}

// Displaying available size of currently selected color
const displaySizes = () => {
  const parent = document.querySelector(".size-list");
  parent.innerHTML = '';
  const current = Product.colors.find((item) => item._id === currentColor);
  let sizeDOMString = current.sizes.map((item) => {
    return `
        <div class="size-options" onclick="changeSize(event,'${item.size}', '${item.id}')">
        ${item.size}
        </div>
      `;
    }).join("");
  parent.innerHTML = sizeDOMString;
};
/*
  #### Formula ###
  500px = 28 inch
  1px = 28/500 inch
  1 inch = 500/28 px
*/
const setPixelRatio = (productID) => {
  currentProductVariant = Product.colors.find((color) => color._id === currentColor).sizes.find(size => size.id === productID)
  console.log(currentProductVariant);
  Product.pixelToInchRatio = currentProductVariant.dimensions.length / 500;
  Product.inchToPixelRatio = 500 / currentProductVariant.dimensions.length;
  addFabricCanvasToTemplateDiv();
};

// Intialize fabric JS canvas
const addFabricCanvasToTemplateDiv = () => {
  const container = document.querySelector("#mockup-image-canvas");
  // Create a canvas element
  const canvasElement = document.createElement("canvas");
  // Settingh width and height according to ratio
  canvasElement.width = Product.inchToPixelRatio * Product.canvas.front.width;
  canvasElement.height = Product.inchToPixelRatio * Product.canvas.front.height;
  // canvasElement.style.border = "3px solid brown";
  container.appendChild(canvasElement);

  fabricCanvas = new fabric.Canvas(canvasElement);

  // Disabling out of canvas image movement
  fabricCanvas.on("object:moving", function (event) {
    var designImg = event.target;
    var canvasWidth = fabricCanvas.width;
    var canvasHeight = fabricCanvas.height;

    var imgLeft = designImg.left;
    var imgTop = designImg.top;
    var imgWidth = designImg.getScaledWidth();
    var imgHeight = designImg.getScaledHeight();

    if (imgLeft < 0) {
      designImg.set({ left: 0 });
    } else if (imgLeft + imgWidth > canvasWidth) {
      designImg.set({ left: canvasWidth - imgWidth });
    }

    if (imgTop < 0) {
      designImg.set({ top: 0 });
    } else if (imgTop + imgHeight > canvasHeight) {
      designImg.set({ top: canvasHeight - imgHeight });
    }
  });

  // Disabling scaling of canvas image element
  let prevScaleX = 1;
  let prevScaleY = 1;

  fabricCanvas.on("object:scaling", function (event) {
    var designImg = event.target;

    var canvasWidth = fabricCanvas.width;
    var canvasHeight = fabricCanvas.height;

    var imgLeft = designImg.left;
    var imgTop = designImg.top;
    var imgWidth = designImg.getScaledWidth();
    var imgHeight = designImg.getScaledHeight();

    const previousHeight = designImageHeight;
    const previousWidth = designImageWidth;

    // Updating sizes during scaling
    designImageHeight = designImg.height * designImg.scaleY;
    designImageWidth = designImg.width * designImg.scaleX;
    updateStats();

    // If image draggin exceeds canvas width, setting the designWidth to last value that was inside the canvas
    if (imgLeft + imgWidth >= canvasWidth || imgLeft <= 0) {
      designImageWidth = previousWidth;
      updateStats();
      designImg.scaleX = prevScaleX;
    } else {
      prevScaleX = designImg.scaleX;
    }
    if (imgTop + imgHeight >= canvasHeight || imgTop <= 0) {
      designImageHeight = previousHeight;
      updateStats();
      designImg.scaleY = prevScaleY;
    } else {
      prevScaleY = designImg.scaleY;
    }
  });
};

// Add image to container
const addImageToCanvas = (event) => {
  const image = event.target.files[0];
  designImg = image;
  if (image && fabricCanvas) {
    const imageURL = URL.createObjectURL(image);
    fabric.Image.fromURL(imageURL, (designImage) => {
      designImage.scaleToHeight(100);
      designImage.scaleToWidth(80);
      // Updating sizes initially after adding to canvas
      designImageHeight = designImage.height * designImage.scaleY;
      designImageWidth = designImage.width * designImage.scaleX;
      updateStats();
      fabricCanvas.add(designImage); // image add pantu, apro go thru all objs and obtain the height and add to above line
      fabricCanvas.setActiveObject(designImage);
    });
  }
};

// Change design area side
const changeSide = (e, side) => {
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
      selectedMockup.colorImage.front;
  else
    document.getElementById("mockup-image").src =
      selectedMockup.colorImage.back;
};

// Download Image
const downloadDesign = () => {
  // Deselecting active object
  if (fabricCanvas.getActiveObject()) {
    fabricCanvas.discardActiveObject().renderAll();
  }

  const designName = document.getElementById("design-name");
  let isDesignNameValid = designName.reportValidity();
  if (!isDesignNameValid) return;

  const node = document.getElementById("product-design");
  // Store original transformation
  const originalTransform = node.style.transform;

  // Apply the transformation to node
  node.style.transformOrigin = "0 0";
  node.style.transform = "scale(2)";

  const config = {
    width: 900,
    height: 1200,
    style: {
      transformOrigin: "0 0",
      transform: "scale(2)",
    },
  };

  // Use a short delay to ensure the browser has updated the DOM with the transform
  setTimeout(() => {
    console.log(fabricCanvas.getObjects());
    domtoimage.toBlob(node, config).then(function (blob) {
      // Restore original transformation
      node.style.transform = originalTransform;

      window.saveAs(
        blob,
        "userName_" +
          designName.value +
          "_" +
          new Date().toLocaleTimeString() +
          "-" + 
          designDirection +
          ".png"
      );
    });
  }, 100);
};

// save to cloud
const saveDesign = () => {
  // generate SKU
  // upload individual images to firebase
  // upload design to firebase
  //
  return;
};

//Set Position
const setPosition = (e, position) => {
  if (!fabricCanvas || !designImg) return;
  // Changing position of selected image
  const designImage = fabricCanvas.getActiveObject();
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
      designImage.set({
        left: (canvasWidth - designImage.getScaledWidth()) / 2,
        top: (canvasHeight - designImage.getScaledHeight()) / 2,
      });
      break;
    case "custom":
      // No operation.
      break;
  }

  designImage.setCoords();
  fabricCanvas.renderAll();
};

// Add text to canvas
const addTextToCanvas = () => {
  const text = document.getElementById("canvas-text-input").value;
  if (text.trim() === "" || !fabricCanvas) return;

  const fontName = document.getElementById("text-font").value;
  const fontWeight = document.getElementById("text-font-weight").value;
  const textColor = document.getElementById("text-color-picker").value;

  const textObj = new fabric.IText(text, {
    left: 10,
    top: 10,
    fontFamily: fontName,
    angle: 0,
    fill: textColor,
    scaleX: 0.5,
    scaleY: 0.5,
    fontWeight: fontWeight,
    hasRotatingPoint: true,
  });

  fabricCanvas.add(textObj);
  fabricCanvas.setActiveObject(textObj);
  fabricCanvas.renderAll();
  updateStats();
};

// function to change input font to preview the font in input box itself
const changeInputFont = (e) => {
  textInputBox.style.fontFamily = e.target.value;
};
// func to change input box font weight for preview → ////// doesnt work! /////
const changeInputFontWeight = (e) => {
  textInputBox.style.fontWeight = e.target.value;
};

// also create a fetch function to fetch the products data and obtain the specific style
//    based on query params passed to the route
fetchProductData();

// Adding delete button listener for fabric canvas
document.addEventListener(
  "keydown",
  (e) => {
    if (e.keyCode === 46) {
      // 46 is the keyCode for the Delete key
      if (fabricCanvas.getActiveObject()) {
        fabricCanvas.remove(fabricCanvas.getActiveObject());
        designImageHeight = null;
        designImageWidth = null;
        updateStats();
      }
    }
  },
  false
);
