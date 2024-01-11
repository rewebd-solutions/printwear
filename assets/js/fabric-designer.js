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

// var for letting top.ejs know there is this var
var isReadyForRendering = true;

var neckLabelId = null;
var isNeckLabelSelected = false;

// notyf snackbar 
var notyf = new Notyf();
AOS.init();

// fetch function and then global functions calling done here
const fetchProductData = async () => {
  try {
    // fetch call
    const styleParam = new URLSearchParams(location.search).get("style");
    if (!styleParam) {
      document.body.style.overflowY = 'hidden';
      document.querySelector(".App").insertAdjacentHTML("beforeend", `
      <div class="design-upload-backdrop" style="z-index:105; position: fixed;">
        <div class="design-upload-modal" data-aos="fade-up" style="justify-content: center; align-items: center">
          <img src="/images/missing-shirt.png" width="200" />
          Oops! Select a design from Product Gallery before proceeding!
          <a href="/productgallery"><button class="">Choose my design</button></a>
          Redirecting now! Please wait!
        </div>
      </div>
      `)
      notyf.error({ message: "style paramater not defined in URL", duration: 6000, dismissible: true });
      return location.href = '/productgallery';
    } 

    const productStyle = styleParam.split("+").join(" ");
    // console.log(productStyle);
    if (!productStyle) {
      return notyf.error({
        message: "Invalid URL",
        dismissible: true,
        duration: 5000
      });
    }
    document.querySelector(".heading").innerHTML = productStyle
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

const userDesignsWrapper = document.querySelector(".user-design-images");
const userLabelsWrapper = document.querySelector(".user-label-images");

// function to toggle disabling and enabling button
const disableButton = (state) => {
  const saveButton = document.querySelector(".save-button");
  state ? saveButton.setAttribute("disabled", true) : saveButton.removeAttribute("disabled");
  state ? saveButton.classList.add("disabled") : saveButton.classList.remove("disabled");
  state ? saveButton.innerHTML = 'Saving...' : saveButton.innerHTML = `<i class="fa-regular fa-page"></i> Save Design`;
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

  if (designDirection === "front") {
    mockupImageContainer.src = (selectedMockup.colorImage.front != '') ? selectedMockup.colorImage.front : '/images/warning.png';
  } else mockupImageContainer.src = (selectedMockup.colorImage.back != '') ? selectedMockup.colorImage.back : '/images/warning.png';

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
    const innerHTML = `
    <div class="color-options${color.colorImage.front || color.colorImage.back ? '' : ' color-disabled'}" ${color.colorImage.front || color.colorImage.back ? `onclick="changeMockup(event, '${color.colorName}', ${color._id})"` : 'title="Image not available"'}>
      <span class="color-circle" style="background: ${color.hex}; border: 
      ${color._id === currentColor ? "3px solid red" : "2px solid #6a6969;"}" id="${color.colorName}-${color._id}"></span>
      <p>${color.colorName}</p>
    </div>
    `;
    parent.innerHTML += innerHTML
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
  const object = fabricCanvas.getObjects()[0];
  let totalWidth = object.getScaledWidth() * Product.pixelToInchRatio;
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
const table = document.querySelector("#price-stats");
const updateStats = () => {
  const priceTable = table.children[1];
  table.style.display = "table"
  
  if (!designImageHeight || !designImageWidth || !designImg) {
    priceTable.children[0].children[1].innerHTML = "0 in";
    priceTable.children[1].children[1].innerHTML = "0 in";
    priceTable.children[2].children[1].innerHTML = "0 in²";
    priceTable.children[3].children[1].innerHTML = "₹" + variantPrice;
    priceTable.children[4].children[1].innerHTML = "₹0";
    priceTable.children[5].children[1].innerHTML = "₹" + variantPrice;
    return;
  }

  let imageHeightInInches = calculateTotalHeight().toFixed(2);
  let imageWidthInInches = calculateTotalWidth().toFixed(2);
  let imageAreaInInches = calculateTotalArea().toFixed(2);

  let printingPrice = (imageHeightInInches <= 8.0 && imageWidthInInches <= 8.0) ? 70.00 : ((imageAreaInInches * 2) < 70.00 ? 70.00 : imageAreaInInches * 2);

  priceTable.children[0].children[1].innerHTML = imageHeightInInches + " in";
  priceTable.children[1].children[1].innerHTML = imageWidthInInches + " in";
  priceTable.children[2].children[1].innerHTML = imageAreaInInches + " in²";
  priceTable.children[3].children[1].innerHTML = "₹" + variantPrice;
  priceTable.children[4].children[1].innerHTML = "₹" + (printingPrice).toFixed(2);
  priceTable.children[5].children[1].innerHTML = "₹" + (printingPrice + variantPrice).toFixed(2);
  priceTable.children[6].children[0].innerHTML = isNeckLabelSelected ? "Neck Label(selected)" : "Neck Label(not selected)";
  priceTable.children[6].children[1].innerHTML = isNeckLabelSelected ? "₹10" : "₹0";
  priceTable.children[7].children[1].innerHTML = isNeckLabelSelected ? "₹" + (printingPrice + variantPrice + 10).toFixed(2) : "₹" + (printingPrice + variantPrice).toFixed(2);
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
        <div class="size-options" ${item.stock ? `onclick="changeSize(event,'${item.size}', '${item.id}')"` : `style="opacity: 0.4; cursor:not-allowed;" title="Out of stock"`}>
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
  canvasElement.style.border = "2px dashed silver";
  container.appendChild(canvasElement);
  
  fabricCanvas = new fabric.Canvas(canvasElement);
  
  // changing left and top of canvases to fit in the shirt
  // fabricCanvas.upperCanvasEl.style.top = Product.inchToPixelRatio * Product.canvas.front.startY;
  // fabricCanvas.upperCanvasEl.style.left = Product.inchToPixelRatio * Product.canvas.front.startX;
  // fabricCanvas.lowerCanvasEl.style.top = Product.inchToPixelRatio * Product.canvas.front.startY;
  // fabricCanvas.lowerCanvasEl.style.left = Product.inchToPixelRatio * Product.canvas.front.startX;

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
const addImageToCanvas = async (el, imageURL) => {

  if (!globalProductID) return notyf.error("Select a shirt size before applying");
  if (!imageURL) return notyf.error("Invalid image, please try another");
  
  fabricCanvas.getObjects().map(obj => fabricCanvas.remove(obj)); // remove all stuff before adding image
  
  document.querySelectorAll(".user-design-image").forEach(element => element.classList.remove("active-selection"))
  el.classList.add("active-selection");

  const blobReq = await fetch(imageURL);
  const blobRes = await blobReq.blob();
  designImg = blobRes;
  if (imageURL && fabricCanvas) {
    const imageURL = URL.createObjectURL(designImg);
    fabric.Image.fromURL(imageURL, (designImage) => {
      designImage.scaleToHeight(100);
      designImage.scaleToWidth(80);
      designImage.minScaleLimit = 0.05;
      // Updating sizes initially after adding to canvas
      designImageHeight = designImage.getScaledHeight();
      designImageWidth = designImage.getScaledWidth();
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
      selectedMockup.colorImage.front == "" ? 'images/warning.png' : selectedMockup.colorImage.front;
  else
    document.getElementById("mockup-image").src =
      selectedMockup.colorImage.back == "" ? 'images/warning.png' : selectedMockup.colorImage.back;
};

// Download Image
const downloadDesign = () => {
  // Deselecting active object
  if (!designImg) return notyf.error("No design selected!")
  if (fabricCanvas.getActiveObject()) {
    fabricCanvas.discardActiveObject().renderAll();
  }

  const designName = document.getElementById("design-name");
  let isDesignNameValid = designName.reportValidity();
  if (!isDesignNameValid) {
    return notyf.error("Give your design a name");
  };

  // disable border when rendering final image
  const canvasContainer = document.querySelectorAll(".canvas-container > *");
  canvasContainer.forEach(item => item.style.border = "none");

  const node = document.getElementById("product-design");

  const config = {
    width: node.offsetWidth * 2,
    height: node.offsetHeight * 2.5,
    style: {
      transformOrigin: "0 0",
      transform: "scale(2)",
    },
    copyDefaultStyles: true
  };

  // Use a short delay to ensure the browser has updated the DOM with the transform
  setTimeout(() => {
    console.log(fabricCanvas.getObjects());
    domtoimage.toBlob(node, config).then(function (blob) {
      // Restore original transformation

      window.saveAs(
        blob,
        userName + "_" +
        designName.value +
        "_" +
        new Date().toLocaleTimeString() +
        "-" +
        designDirection +
        ".png"
      );
      canvasContainer.forEach(item => item.style.border = "2px dashed silver");
    });
  }, 100);
};

// save to cloud
const saveDesign = async () => {
  // lot of repeating code, can be optimized later
  if (!globalProductID) return;

  const designName = document.getElementById("design-name");
  let isDesignNameValid = designName.reportValidity();
  if (!isDesignNameValid) {
    return notyf.error("Give your design a name");
  };
  
  const SKU = document.getElementById("sku-name");

  // asked by client to disable SKU mandation
  // if (!SKU.reportValidity()) {
  //   return notyf.error("Give your design a SKU Code");
  // }

  disableButton(true);

  if (fabricCanvas.getActiveObject()) {
    fabricCanvas.discardActiveObject().renderAll();
  }
  
  // disable border when rendering final image
  const canvasContainer = document.querySelectorAll(".canvas-container > *");
  canvasContainer.forEach(item => item.style.border = "none");

  try {
    const node = document.getElementById("product-design");

    const config = {
      width: node.offsetWidth * 2,
      height: node.offsetHeight * 2.5,
      style: {
        transformOrigin: "0 0",
        transform: "scale(2)",
      },
      copyDefaultStyles: true
    };
    
    /* this is the old method where all the client images get sent to the server and everything is uploaded
    but since, they changed it to have only one image, comment the below block, query select active desing,
    send the URL to the formData, then send the design image blob separately. */

    let designImageURL = document.querySelector(".active-selection").children[0].src;
    let designImageName = document.querySelector(".active-selection").children[1].innerText;

    let submitProduct = Product.colors.find(x => x._id === currentColor).sizes.find(size => size.id === globalProductID)

    let designModelObject = {
      productId: Product._id,
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
      designSKU: SKU.value,
      price: parseFloat(calculateTotalArea().toFixed(2)), //sending only area because can't trust client with sending calculated price
      designDimensions: {
        width: parseFloat(calculateTotalWidth().toFixed(3)),
        height: parseFloat(calculateTotalHeight().toFixed(3)),
        top: parseFloat((fabricCanvas.getObjects()[0].top * Product.pixelToInchRatio).toFixed(3)),
        left: parseFloat((fabricCanvas.getObjects()[0].left * Product.pixelToInchRatio).toFixed(3)),
      },
    }

    console.log(submitProduct)
    console.log(designModelObject)
    // console.log(filesFromBlobs)

    domtoimage.toBlob(node, config).then(async blob => {

      const formData = new FormData();
      formData.append("designImage", new File([blob], "ProductDesign-" + designName.value + "-" + designDirection + ".png", { type: 'image/png' }));
      formData.append("designHeight", parseFloat(calculateTotalHeight().toFixed(2)))
      formData.append("designWidth", parseFloat(calculateTotalWidth().toFixed(2)))
      formData.append("productData", JSON.stringify(designModelObject));
      formData.append("direction", designDirection);
      formData.append("designImageURL", designImageURL);
      formData.append("designImageName", designImageName);
      formData.append("neckLabel", neckLabelId);

      const saveDesignRequest = await fetch("/createdesign", {
        method: "POST",
        body: formData,
      });

      const saveDesignResponse = await saveDesignRequest.json();

      if (saveDesignRequest.ok) {
        console.log(saveDesignResponse)
        document.querySelector(".save-button").innerHTML = "Saved!";
        return notyf.success("Design saved successfully!");
      }
      canvasContainer.forEach(item => item.style.border = "2px dashed silver");
    })
    
  } catch (error) {
    console.log(error);
    disableButton(false);
    canvasContainer.forEach(item => item.style.border = "2px dashed silver");
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

// removed text functionality

const modifySKUInput = (event) => {
  let string = event.target.value;
  event.target.value = string.replace(/ /g, '-').replace(/[^a-zA-Z0-9-_]/g, '').toUpperCase().slice(0, 10);
}

const populateUserDesigns = (data = userDesignResponse) => {
  userDesignsWrapper.innerHTML = '';
  if (!data || data.images.length === 0) return userDesignsWrapper.innerHTML = "No uploads yet!";
  data.images.map(imageItem => {
    let currentImage = new Image();
    currentImage.src = imageItem.url;

    userDesignsWrapper.innerHTML += `
    <div class="user-design-image" onclick="addImageToCanvas(this, this.children[0].src)">
      <img src="${imageItem.url}" alt="">
      <p>${imageItem.name}</p>
    </div>`;
    // currentImage.addEventListener("load", () => {
    // })
  })
}

const fetchUserDesigns = async () => {
  try {
    const userDesignRequest = await fetch("/obtainimages");
    userDesignResponse = await userDesignRequest.json();
    if (userDesignRequest.ok) {
      populateUserDesigns();
    }
  } catch (error) {
    console.log(error);
    notyf.error("Something went wrong!");
  }
}

const populateUserLabels = (data = userLabelsResponse) => {
  userLabelsWrapper.innerHTML = '';
  console.log(data)
  if (!data || data.labels.length == 0) return userLabelsWrapper.innerHTML = 'No labels yet!';
  data.labels.map(imageItem => {
    let currentImage = new Image();
    currentImage.src = imageItem.url;

    userLabelsWrapper.innerHTML += `
    <div class="user-label-image" onclick="selectLabel(this, '${imageItem._id}')">
      <img src="${imageItem.url}" alt="${imageItem.name}">
      <p>${imageItem.name}</p>
    </div>`;
  })
}

const fetchUserLabels = async () => {
  try {
    const userLabelsRequest = await fetch("/obtainlabels");
    userLabelsResponse = await userLabelsRequest.json();
    if (userLabelsRequest.ok) {
      populateUserLabels();
    }
  } catch (error) {
    console.log(error);
    notyf.error("Something went wrong in fetching labels!");
  }
}

const includeLabel = (decision) => {
  if (!decision) {
    userLabelsWrapper.style.opacity = 0.5;
    userLabelsWrapper.style.pointerEvents = "none";
    neckLabelId = null;
    isNeckLabelSelected = false;
    document.querySelectorAll(".user-label-image").forEach(element => element.classList.remove("active-selection"))
    updateStats()
  } else {
    userLabelsWrapper.style.opacity = 1;
    userLabelsWrapper.style.pointerEvents = "unset";
    isNeckLabelSelected = true
  }
}

const selectLabel = (el, labelId) => {
  document.querySelectorAll(".user-label-image").forEach(element => element.classList.remove("active-selection"))
  el.classList.add("active-selection");
  neckLabelId = labelId;
  isNeckLabelSelected && updateStats()
  // upon selecting label, add 10 rupee to the total cost
}

// also create a fetch function to fetch the products data and obtain the specific style
//    based on query params passed to the route
fetchProductData();
fetchUserDesigns();
fetchUserLabels();

// Adding delete button listener for fabric canvas
document.addEventListener(
  "keydown",
  (e) => {
    if (e.keyCode === 46) {
      // 46 is the keyCode for the Delete key
      if (fabricCanvas.getActiveObject()) {
        designImg = null;
        updateStats();
        fabricCanvas.remove(fabricCanvas.getActiveObject());
        document.querySelectorAll(".user-design-image").forEach(element => element.classList.remove("active-selection"))
      }
    }
  },
  false
);
