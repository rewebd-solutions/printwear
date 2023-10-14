var designImg, fabricCanvas;

// Intialize fabric JS canvas
const addFabricCanvasToTemplateDiv = () => {
    const container = document.querySelector(".mockup-image");
    // Create a canvas element
    const canvasElement = document.createElement("canvas");
    // Settingh width and height according to ratio
    canvasElement.width = 225;
    canvasElement.height = 230;
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
            // updateStats();
            fabricCanvas.setActiveObject(designImage);
        });
    }
};

const fixRotationOnCanvas = () => {
    const canvasContainer = document.querySelector(".canvas-container");
    // const upperCanvas = document.querySelector(".upper-canvas");
    // const lowerCanvas = document.querySelector(".lower-canvas");

    canvasContainer.style.position = 'absolute';
    canvasContainer.style.top = '170px';
    canvasContainer.style.left = '210px';
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

    // const designName = document.getElementById("design-name");
    // let isDesignNameValid = designName.reportValidity();
    // if (!isDesignNameValid) {
    //     return notyf.error("Give your design a name");
    // };
    const canvasContainer = document.querySelectorAll(".canvas-container > *");
    canvasContainer.forEach(item => item.style.border = "none");

    const node = document.querySelector(".mockup-image");

    const config = {
        width: node.clientWidth*2,
        height: node.clientHeight*2,
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
                // "userName_" +
                // designName.value +
                // "_" +
                new Date().toLocaleTimeString() +
                // "-" +
                // designDirection +
                ".png"
            );
            canvasContainer.forEach(item => item.style.border = "1px solid silver");
        });
    }, 100);

};

const setMockupSize = () => {
    const mockupContainer = document.querySelector(".mockup-image");
    const mockupImageHeight = document.querySelector(".mockup-image-container img").clientHeight;
    mockupContainer.setAttribute("style", `height: ${mockupImageHeight}px`);
    // console.log(mockupImageHeight, "1")
}

addFabricCanvasToTemplateDiv();
// after calling above function, call another function to set rotation for .upper-canvas and .lower-canvas
fixRotationOnCanvas();
setMockupSize();
// rotateArtboard(25) // roatate entire canvas not working