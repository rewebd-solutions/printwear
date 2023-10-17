var designImg, fabricCanvas;
var colorsToRender = [];
colorsToRender['default'] = '#fff';
var isReadyForRendering = true;

var notyf = new Notyf();
AOS.init();

var mockupImageContainer = document.querySelector(".mockup-image-container");
var userDesignsWrapper = document.querySelector(".user-design-images");

//fetch data from db
const fetchMockupsData = async () => {
    try {
        const mockupsDataRequest = await fetch("/getmockups");
        const mockupsDataResponse = await mockupsDataRequest.json();
        mockupData = mockupsDataResponse[0]; // zero badhila filter only specific mockup from URL param
        console.log(mockupsDataResponse)
        if (!mockupsDataRequest.ok) {
            mockupImageContainer.innerHTML = "Something went wrong! Please refresh page";
            return notyf.error("Something went wrong!");
        }
        renderColors();
        addFabricCanvasToTemplateDiv();
        // after calling above function, call another function to set rotation for .upper-canvas and .lower-canvas
        fixRotationOnCanvas();
        setMockupSize();
        // rotateArtboard(25) // roatate entire canvas not working        
    } catch (error) {
        console.log(error)
        mockupImageContainer.innerHTML = "Something went wrong! Please page";
        return notyf.error("Something went wrong!");
    }
}

// Intialize fabric JS canvas
const addFabricCanvasToTemplateDiv = () => {
    const container = document.querySelector(".mockup-image");
    // Create a canvas element
    const canvasElement = document.createElement("canvas");
    // Settingh width and height according to ratio
    canvasElement.width = mockupData.canvas.width;
    canvasElement.height = mockupData.canvas.height;
    canvasElement.style.border = "1px dashed silver";
    // canvasElement.style.transform = "rotate(10deg)";
    // canvasElement.style.top = '20px';
    // canvasElement.style.left = '20px';
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
        // updateStats();

        // If image draggin exceeds canvas width, setting the designWidth to last value that was inside the canvas
        if ((imgLeft + imgWidth) >= canvasWidth || imgLeft <= 0) {
            designImageWidth = previousWidth;
            // updateStats();
            designImg.scaleX = prevScaleX;
        } else {
            prevScaleX = designImg.scaleX;
        }
        if ((imgTop + imgHeight) >= canvasHeight || imgTop <= 0) {
            designImageHeight = previousHeight;
            // updateStats();
            designImg.scaleY = prevScaleY;
        } else {
            prevScaleY = designImg.scaleY;
        }
    });
};

// Add image to container
const addImageToCanvas = async (el, imageURL) => {
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
      });
    }    
};

const fixRotationOnCanvas = () => {
    const canvasContainer = document.querySelector(".canvas-container");
    // const upperCanvas = document.querySelector(".upper-canvas");
    // const lowerCanvas = document.querySelector(".lower-canvas");

    canvasContainer.style.position = 'absolute';
    canvasContainer.style.top = mockupData.canvas.top + 'px';
    canvasContainer.style.left = mockupData.canvas.left + 'px';
    // item.style.transform = 'rotate(8deg)'; // implement rotation later
}

function rotateArtboard(angle) {
    fabricCanvas.discardActiveObject();

    var activeObject = new fabric.ActiveSelection(fabricCanvas.getObjects(), { canvas: fabricCanvas });
    fabricCanvas.setActiveObject(activeObject);

    if (activeObject != null) {
        activeObject.rotate(angle);

        fabricCanvas.discardActiveObject();

        fabricCanvas.renderAll();
    }
}

const downloadDesign = () => {
    // Deselecting active object
    if (fabricCanvas.getActiveObject()) {
        fabricCanvas.discardActiveObject().renderAll();
    }

    const designName = document.getElementById("mockup-name");
    let isDesignNameValid = designName.reportValidity();
    if (!isDesignNameValid) {
        return notyf.error("Enter mockups name!");
    };

    const canvasContainer = document.querySelectorAll(".canvas-container > *");
    canvasContainer.forEach(item => item.style.border = "none");

    const node = document.querySelector(".mockup-image");

    const config = {
        width: node.clientWidth * 2,
        height: node.clientHeight * 2,
        style: {
            transformOrigin: "0 0",
            transform: "scale(2)",
        },
    };

    // Use a short delay to ensure the browser has updated the DOM with the transform
    setTimeout(() => {
        // console.log(fabricCanvas.getObjects());
        domtoimage.toBlob(node, config).then(function (blob) {
            window.saveAs(
                blob,
                userName + "_" +
                designName.value +
                "_" +
                new Date().toLocaleTimeString() +
                // "-" +
                // designDirection +
                ".png"
            );
            canvasContainer.forEach(item => item.style.border = "1px dashed silver");
        });
    }, 100);

};

const setMockupSize = () => {
    const mockupContainer = document.querySelector(".mockup-image");
    const mockupImageHeight = document.querySelector(".mockup-image-container img").clientHeight;
    mockupContainer.setAttribute("style", `height: ${mockupImageHeight}px`);
    // console.log(mockupImageHeight, "1")
}

const renderColors = () => {
    const colorsList = document.querySelector(".color-list");
    // put this in the actual code,
    // <div ${mockupsDataResponse.product.baseImage.front != ""? `class="color-option" onclick="addColorToRender(this)"`: `class="color-option color-disabled"`}>
    colorsList.innerHTML = Object.keys(mockupData.product.colors).map((color, i) => {
        return `
        <div class="color-option" onclick="addColorToRender(this)">
            <span class="color-circle" style="background: ${mockupData.product.colors[color].colorCode}; border: 1px solid silver" data-color="${color}">
                <i class="fa fa-check color-tick"></i>
            </span>
            <p style="font-size: 12px">${color}</p>
        </div>       
        `
    }).join("");
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

const addColorToRender = (el) => {
    let color = el.children[1].innerText;
    let hex = el.children[0].style.background;

    if (Object.keys(colorsToRender).find(x => x === color)) {
        delete colorsToRender[color];
        let newColors = Object.keys(colorsToRender);
        el.querySelector(".color-tick").style.display = "none";
        mockupImageContainer.style.background = colorsToRender[newColors[newColors.length - 1]];
        return el.children[0].classList.remove('selected-color');
    }
    
    colorsToRender[color] = hex;
    el.querySelector(".color-tick").style.display = "block"
    el.children[0].classList.add('selected-color');
    mockupImageContainer.style.background = hex;
    console.log(colorsToRender);
}

fetchMockupsData();
fetchUserDesigns();