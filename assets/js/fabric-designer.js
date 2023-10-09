// Product data old for initializing
var Product = {};

var productData = {};

// Holds the canvas instance
let fabricCanvas = null;
// Starting design direction
let designDirection = "front";
// Storing design image, and its height and width
let designImg, designImageWidth, designImageHeight;

var globalProductID = null;

var isSetPixelRatioCalled = false;

var variantPrice = 0;

// notyf snackbar 
var notyf = new Notyf();
AOS.init();

// fetch function and then global functions calling done here
const fetchProductData = async () => {
  try {
    // fetch call
    const styleParam = new URLSearchParams(location.search).get("style");
    if (!styleParam) return notyf.error({message: "style paramater not defined in URL", duration: 6000, dismissible: true});

    const productStyle = styleParam.split("+").join(" ");
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

// add event listener to avoid uploading without selecting size
document.querySelector(".design-input-label").addEventListener("click", (e) => {
  if (!globalProductID) {
    e.preventDefault();
    notyf.error("Select a size before uploading");
    return;
  }
})

// function to toggle disabling and enabling button
const disableButton = (state) => {
  const saveButton = document.querySelector(".save-button");
  state? saveButton.setAttribute("disabled", true) : saveButton.removeAttribute("disabled");
  state? saveButton.classList.add("disabled"): saveButton.classList.remove("disabled");
  state? saveButton.innerHTML = 'Saving...': saveButton.innerHTML = `<i class="fa-regular fa-page"></i> Save Design`;
}

// Changing current color and its image
const changeMockup = (e, color, id) => {
  let mockupImageContainer = document.getElementById("mockup-image");

  let selectedMockup = Product.colors.find((color) => color._id === id);
  const element = document.getElementById(`${color}-${id}`);

  console.log(e.target);

  renderColorBorder(color, id);
  globalProductID = null;
  currentColor = id;
  displaySizes();

  if (designDirection === "front"){
    mockupImageContainer.src = (selectedMockup.colorImage.front != '')? selectedMockup.colorImage.front : '/images/warning.png';
  } else mockupImageContainer.src = (selectedMockup.colorImage.back != '')? selectedMockup.colorImage.back : '/images/warning.png';
  
};

// func to draW border around active color
const renderColorBorder = (color, id) => {
  const colorButtons = document.querySelectorAll(".color-circle");
  const currentColor = document.getElementById(`${color}-${id}`);
  colorButtons.forEach(
    (colorButton) => (colorButton.style.border = "2px solid #6a6969")
  );
  currentColor.style.border = "3px solid red";
};

// Displaying the colors to user
const renderColors = () => {
  const parent = document.querySelector(".color-list");
  parent.innerHTML = '';
  Product.colors.map((color) => {
    const child = document.createElement("div");
    const innerHTML = `
    <div class="color-options${color.colorImage.front || color.colorImage.back ? '': ' color-disabled'}" ${color.colorImage.front || color.colorImage.back ? `onclick="changeMockup(event, '${color.colorName}', ${color._id})"`: 'title="Image not available"'}>
      <span class="color-circle" style="background: ${color.hex}; border: 
      ${ color._id === currentColor ? "3px solid red" : "2px solid #6a6969;" }" id="${color.colorName}-${color._id}"></span>
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
  
  const image = document.getElementById("mockup-image");
  image.src = Product.colors.find(
    (color) => color._id === currentColor
  ).colorImage.front;
};

// funcs to calculate height and width of all active canvas objects
const calculateTotalHeight = () => {
  if (!fabricCanvas) return;
  const objects = fabricCanvas.getObjects();
  let totalHeight = objects.map(obj => obj.getScaledHeight() * Product.pixelToInchRatio).reduce((prev, curr) => prev + curr, 0)
  //console.log(totalHeight);
  return totalHeight
}
const calculateTotalWidth = () => {
  if (!fabricCanvas) return;
  const objects = fabricCanvas.getObjects();
  let totalWidth = Math.max(...objects.map(obj => obj.getScaledWidth() * Product.pixelToInchRatio));
  //console.log(totalWidth);
  return totalWidth
}
const calculateTotalArea = () => {
  if (!fabricCanvas) return;
  const objects = fabricCanvas.getObjects();
  let totalArea = objects.map(obj => obj.getScaledHeight() * obj.getScaledWidth() * Product.pixelToInchRatio * Product.pixelToInchRatio).reduce((prev, curr) => prev + curr, 0)
  return totalArea;
}

// Display design image stats
const updateStats = () => {
  const heightElement = document.querySelector(".height-design");
  const widthElement = document.querySelector(".width-design");
  const totalPriceElement = document.querySelector(".total-price");
  if (!designImageHeight && !designImageWidth) {
    heightElement.innerHTML = "Height: 0 inches";
    widthElement.innerHTML = "Height: 0 inches";
    totalPriceElement.innerHTML = "Total: ₹0"
    return;
  }
  calculateTotalArea()
  let imageHeightInInches = calculateTotalHeight().toFixed(2);
  let imageWidthInInches = calculateTotalWidth().toFixed(2);
  let imageAreaInInches = calculateTotalArea();
  heightElement.innerHTML =
    "Height: " +
    imageHeightInInches +
    " inches";
  widthElement.innerHTML =
    "Width: " +
    imageWidthInInches +
    " inches";
  totalPriceElement.innerHTML = 
    "Total Price: <br> Area " + imageAreaInInches.toFixed(2) + 
    " x " + "₹2/in² = ₹" + (imageAreaInInches*2).toFixed(2) + 
    "<br> Base Price: ₹" + variantPrice + "<br> = ₹" + 
    ((imageAreaInInches*2) + variantPrice).toFixed(2)
};

const changeSize = (e, size, id) => {
  const sizeButtons = document.querySelectorAll(".size-options");
  const basePriceElement = document.querySelector(".base-price");
  sizeButtons.forEach(sizeBtn => {
    sizeBtn.style.border = "2px solid #6a6969";
    sizeBtn.style.transform = "scale(1.0)"
  });
  e.target.style.border = "2px solid red";
  e.target.style.transform = "scale(1.1)"
  console.log(id, size);
  globalProductID = id; // check b4 downloading or saving if this is checked
  
  variantPrice = Product.colors.find(color => color._id === currentColor).sizes.find(size => size.id === globalProductID).price;
  basePriceElement.innerHTML = "Base Price: ₹" + variantPrice;
  updateStats();

  if (!isSetPixelRatioCalled) setPixelRatio(globalProductID);
  // also write code to change ratio dimensions
}

// Displaying available size of currently selected color
const displaySizes = () => {
  const parent = document.querySelector(".size-list");
  parent.innerHTML = '';
  const current = Product.colors.find((item) => item._id === currentColor);
  let sizeDOMString = current.sizes.map((item) => {
    return `
        <div class="size-options" ${item.stock? `onclick="changeSize(event,'${item.size}', '${item.id}')"` : `style="opacity: 0.4; cursor:not-allowed;" title="Out of stock"`}>
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
  // call this func only after a variant has been selected.. and modify the code such that the ratios modify according the size variant
  isSetPixelRatioCalled = true;
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
    // designImageHeight = designImg.height * designImg.scaleY;
    designImageHeight = designImg.getScaledHeight();
    // designImageWidth = designImg.width * designImg.scaleX;
    designImageWidth = designImg.getScaledWidth();
    updateStats();

    // If image draggin exceeds canvas width, setting the designWidth to last value that was inside the canvas
    if ((imgLeft + imgWidth) >= canvasWidth || imgLeft <= 0) {
      designImageWidth = previousWidth;
      updateStats();
      designImg.scaleX = prevScaleX;
    } else {
      prevScaleX = designImg.scaleX;
    }
    if ((imgTop + imgHeight) >= canvasHeight || imgTop <= 0) {
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
      designImage.minScaleLimit = 0.1;
      // Updating sizes initially after adding to canvas
      designImageHeight = designImage.getScaledHeight();
      designImageWidth = designImage.getScaledWidth();
      fabricCanvas.add(designImage);
      updateStats();
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
      selectedMockup.colorImage.front == "" ? 'images/warning.png': selectedMockup.colorImage.front;
  else
    document.getElementById("mockup-image").src =
      selectedMockup.colorImage.back == "" ? 'images/warning.png': selectedMockup.colorImage.back;
};

// Download Image
const downloadDesign = () => {
  // Deselecting active object
  if (fabricCanvas.getActiveObject()) {
    fabricCanvas.discardActiveObject().renderAll();
  }

  const designName = document.getElementById("design-name");
  let isDesignNameValid = designName.reportValidity();
  if (!isDesignNameValid) {
    return notyf.error("Give your design a name");
  };

  const node = document.getElementById("product-design");

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
const saveDesign = async () => {
  // lot of repeating code, can be optimized later
  disableButton(true);
  console.log("working?");
  
  if (fabricCanvas.getActiveObject()) {
    fabricCanvas.discardActiveObject().renderAll();
  }
  
  const designName = document.getElementById("design-name");
  let isDesignNameValid = designName.reportValidity();
  if (!isDesignNameValid) {
    disableButton(false);
    return notyf.error("Give your design a name");
  };
  
  try {
    const node = document.getElementById("product-design");
    
    const config = {
      width: 900,
      height: 1200,
      style: {
        transformOrigin: "0 0",
        transform: "scale(2)",
      },
    };
  
    const imagesTobeUploaded = fabricCanvas.getObjects().map(obj => obj._element? obj._element.src: obj.toDataURL());
    const filesFromBlobs = [];
    let i = 0;
    for(url of imagesTobeUploaded) {
      let blobReq = await fetch(url);
      let blobFile = await blobReq.blob();
      i++;
      filesFromBlobs.push(new File([blobFile], "Image-"+i+".png", { type: 'image/png' }))
    }
  
    let submitProduct = Product.colors.find(x => x._id === currentColor).sizes.find(size => size.id === globalProductID)
  
    let designModelObject = {
      product: {
        id: submitProduct.id,
        name: submitProduct.name,
        style: Product.name,
        color: Product.colors.find(x => x._id === currentColor).colorName,
        hex: Product.colors.find(x => x._id === currentColor).hex,
        size: submitProduct.size,
        SKU: submitProduct.sizeSku,
        price: submitProduct.price,
        baseImage: {
            front: Product.baseImage.front,
            back: Product.baseImage.back,
        },
        dimensions: submitProduct.dimensions
      },
      designName: designName.value,
      price: (calculateTotalArea()*2).toFixed(2),
      designDimensions: {
        width: (designImageWidth * Product.pixelToInchRatio).toFixed(2),
        height: (designImageHeight * Product.pixelToInchRatio).toFixed(2)
      },
    }
    
    domtoimage.toBlob(node, config).then(async blob => {
      filesFromBlobs.push(new File([blob], "DesignImage-" + designDirection + ".png", { type: 'image/png' }))
  
      const formData = new FormData();
      filesFromBlobs.forEach((file) => formData.append('images', file));
      formData.append("designHeight", calculateTotalHeight().toFixed(2))
      formData.append("designWidth", calculateTotalWidth().toFixed(2))
      formData.append("productData", JSON.stringify(designModelObject));
      formData.append("direction", designDirection);
  
      const saveDesignRequest = await fetch("/createdesign", {
        method: "POST",
        body: formData,
      });
      
      if (saveDesignRequest.ok) {
        disableButton(false);
        return notyf.success("Design saved successfully!");
      }
      
    })    
  } catch (error) {
    console.log(error);
    return notyf.error("Design failed to save!");
  }
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

// function to change SKU input with correct validity
const modifySKUInput = (event) => {
  let string = event.target.value;
  event.target.value = string.replace(/ /g, '-').replace(/[^a-zA-Z0-9-_]/g, '').toUpperCase().slice(0, 10);
}

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
        // designImageHeight = null;
        // designImageWidth = null;
        updateStats();
      }
    }
  },
  false
);
