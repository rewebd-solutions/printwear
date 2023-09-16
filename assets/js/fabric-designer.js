// Product data
const Product = {
  SKU: "",
  name: "",
  category: "",
  gender: "",
  description: "",
  productImage: {
    front: "./images/mens round neck/white-front.jpg",
    back: "./images/mens round neck/white-back.jpg",
  },
  dimensions: {
    //Added extra data
    length: 28, //inches
    chest: 38, //inches
    sleeve: 7.5, //inches
    weight: 0.5, //kilograms
  },
  colors: [
    {
      _id: 1,
      colorName: "WHITE",
      colorSKU: "",
      hex: "#FFFFFF",
      productId: 1,
      colorImage: {
        front: "./images/mens round neck/white-front.jpg",
        back: "./images/mens round neck/white-back.jpg",
      },
      sizes: [
        { sizeSku: "XS", size: "XS", stock: 0 },
        { sizeSku: "S", size: "S", stock: 0 },
        { sizeSku: "M", size: "M", stock: 0 },
        { sizeSku: "L", size: "L", stock: 0 },
      ],
    },
    {
      _id: 2,
      colorName: "BLACK",
      colorSKU: "",
      hex: "#000000",
      productId: 1,
      colorImage: {
        front: "./images/mens round neck/black-front.jpg",
        back: "./images/mens round neck/black-back.jpg",
      },
      sizes: [
        { sizeSku: "S", size: "S", stock: 0 },
        { sizeSku: "M", size: "M", stock: 0 },
        { sizeSku: "L", size: "L", stock: 0 },
        { sizeSku: "XL", size: "XL", stock: 0 },
      ],
    },
    {
      _id: 3,
      colorName: "GREY",
      colorSKU: "",
      hex: "#858585",
      productId: 1,
      colorImage: {
        front: "./images/mens round neck/grey-front.jpg",
        back: "./images/mens round neck/grey-back.jpg",
      },
      sizes: [
        { sizeSku: "S", size: "S", stock: 0 },
        { sizeSku: "M", size: "M", stock: 0 },
        { sizeSku: "L", size: "L", stock: 0 },
      ],
    },
  ],
  price: {
    xs: 300,
    s: 300,
    m: 350,
    l: 350,
    xl: 400,
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
// Current selected color - first color is chosen as default
let currentColor = Product.colors[0]._id;
// Holds the canvas instance
let fabricCanvas = null;
// Starting design direction
let designDirection = "front";
// Storing design image, and its height and width
let designImg, designImageWidth, designImageHeight;

// Changing current color and its image
const changeMockup = (id) => {
  let selectedMockup = Product.colors.find((color) => color._id === id);
  const element = document.getElementById(id);
  const sizeList = document.querySelector(".size-list");
  if (currentColor) {
    const previous = document.getElementById(currentColor);
    previous.style.border = "none";
  }
  while (sizeList.children.length > 0) {
    sizeList.removeChild(sizeList.lastChild);
  }
  currentColor = id;
  element.style.border = "2px solid red";
  displaySizes();
  if (designDirection === "front")
    document.getElementById("mockup-image").src =
      selectedMockup.colorImage.front;
  else
    document.getElementById("mockup-image").src =
      selectedMockup.colorImage.back;
};
// Displaying the colors to user
const renderColors = () => {
  const parent = document.querySelector(".color-list");
  Product.colors.map((item) => {
    const child = document.createElement("div");
    const innerHTML = `
    <div class="color-options" onclick="changeMockup(${item._id})">
    <span class="color-circle" style="background: ${item.hex}; border: ${
      item._id === currentColor ? "2px solid red" : "none"
    }" id="${item._id}"></span>
    <p>${item.colorName}</p>
    </div>
    `;
    child.innerHTML = innerHTML;
    child.style.margin = "0px 10px";
    parent.appendChild(child);
  });
};

// Loading first image of mockupImages
const loadMockupImage = () => {
  const image = document.getElementById("mockup-image");
  image.src = Product.colors[0].colorImage.front;
};

// Display design image stats
const updateStats = () => {
  const heightElement = document.querySelector(".height-design");
  const widthElement = document.querySelector(".width-design");
  if (!designImageHeight && !designImageWidth) {
    heightElement.innerHTML = "";
    widthElement.innerHTML = "";
  }
  heightElement.innerHTML =
    "Height " +
    Math.round(designImageHeight * Product.pixelToInchRatio) +
    " inches";
  widthElement.innerHTML =
    "Width " +
    Math.round(designImageWidth * Product.pixelToInchRatio) +
    " inches";
};

// Displaying available size of currently selected color
const displaySizes = () => {
  if (currentColor) {
    const parent = document.querySelector(".size-list");
    const current = Product.colors.filter(
      (item) => item._id === currentColor
    )[0];
    current.sizes.map((item) => {
      const child = document.createElement("div");
      const innerHTML = `
        <div class="size-options">
        <p>${item.size}</p>
        </div>
      `;
      child.innerHTML = innerHTML;
      parent.appendChild(child);
    });
  }
};
/*
  #### Formula ###
  500px = 28 inch
  1px = 28/500 inch
  1 inch = 500/28 px
*/
const setPixelRatio = () => {
  Product.pixelToInchRatio = Product.dimensions.length / 500;
  Product.inchToPixelRatio = 500 / Product.dimensions.length;
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
  fabricCanvas.on("object:scaling", function (event) {
    var designImg = event.target;

    var canvasWidth = fabricCanvas.width;
    var canvasHeight = fabricCanvas.height;
    var imgLeft = designImg.left;
    var imgTop = designImg.top;
    var imgWidth = designImg.getScaledWidth();
    var imgHeight = designImg.getScaledHeight();

    // Updating sizes during scaling
    designImageHeight = designImg.height * designImg.scaleY;
    designImageWidth = designImg.width * designImg.scaleX;
    updateStats();
    // Right Boundary
    if (imgLeft + imgWidth > canvasWidth) {
      designImg.scaleX = (canvasWidth - imgLeft) / designImg.width;
    }
    // Left Boundary
    if (imgLeft < 0) {
      designImg.scaleX = (designImg.width + imgLeft) / designImg.width;
    }
    // Bottom Boundary
    if (imgTop + imgHeight > canvasHeight) {
      designImg.scaleY = (canvasHeight - imgTop) / designImg.height;
    }
    // Top Boundary
    if (imgTop < 0) {
      designImg.scaleY = (designImg.height + imgTop) / designImg.height;
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
      fabricCanvas.add(designImage);
      fabricCanvas.setActiveObject(designImage);
    });
  }
};

// Change design area side
const changeSide = (side) => {
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
// Save Image
const saveImage = () => {
  domtoimage
    .toBlob(document.getElementById("product-design"))
    .then(function (blob) {
      window.saveAs(
        blob,
        "design-" + new Date().toLocaleTimeString() + "-design.png"
      );
    });
};
//Set Position
const setPosition = (position) => {
  if (!fabricCanvas || !designImg) return;
  // Changing position of selected image
  const designImage = fabricCanvas.getActiveObject();
  if (!designImage) return;

  const canvasWidth = fabricCanvas.width;
  const canvasHeight = fabricCanvas.height;

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
};

renderColors();
loadMockupImage();
displaySizes();
setPixelRatio();

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
