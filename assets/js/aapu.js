

$(function(){
   console.log('STATIC Sanity Check');

   // NAV ACTIONS ================================
   $('.flex-nav ul li a').on('click',function() {
      $('.flex-nav ul li a').removeClass('nav-active');
      $(this).addClass('nav-active');
   });

   // DROPDOWN ACTIONS ================================
   let dropdownButtonEls = document.querySelectorAll('.dropdown-button');
   let dropdownEls = document.querySelectorAll('.dropdown');
   let dropdownOptionEls = document.querySelectorAll('.dropdown-option');

   // handles the open and closing of
   // drop down options
   dropdownButtonEls.forEach(function(el) {
      el.addEventListener('click', function(e) {
         let dropdownParent = el.parentNode;
         // since this event listener is nested inside
         // another element with an event listener, stopPropagation
         // will stop the parent event listener from automatically triggering
         e.stopPropagation();
         dropdownParent.classList.toggle('is-up');
      });
   });

   // dropdown option handling
   dropdownOptionEls.forEach(function(el) {
      el.addEventListener('click', function(e) {
         // traverse the DOM from
         // dropdownOption (LI) to current value (SPAN)
         let valTarget = el.parentNode
                           .parentNode
                           .parentNode
                           .nextElementSibling
                           .firstElementChild;
         // in the field next to the dropdown bar,
         // swaps old text content for new text content
         // from selected dropdown value
         valTarget.textContent = el.textContent;
         unselectSiblings(el)
         el.classList.add('is-selected');
         hideDropdown();
      })
   });

   // closes dropdown if clicked outside
   // of the dropdown component
   document.addEventListener('click', function(e) {
      hideDropdown();
   });

   // deselects highlighted color from other options
   function unselectSiblings(el) {
      let siblings = el.parentNode.children;
      for (var i=0; i < siblings.length; i++){
         siblings[i].classList.remove('is-selected');
      }
   }

   // closes the dropdown option list
   function hideDropdown() {
      dropdownEls.forEach(el => {
         el.classList.remove('is-up');
      });
   }
   // end of dropdown actions


   // IMAGE UPLOAD ===================================
   let currentArtFileName;
   let imageFile;
   let reader;
   let designDisplayEl = document.getElementById('design-display');
   let designDisplayEl1 = document.getElementById('design-display1');
   let uploadButtonEl = document.getElementById('upload-button');
   let uploadButtonEl1 = document.getElementById('upload-button1');
   // let imageInputEl = document.querySelector('input[type="file"]');
   let imageInputEl = document.getElementById('image-input');
   let imageInputEl1 = document.getElementById('image-input1');

   // activates the real image upload button
   // when the styledized button is clicked
   uploadButtonEl.addEventListener('click', function(){
      imageInputEl.click();
   }, false);

   //backuuuu
   uploadButtonEl1.addEventListener('click', function(){
      imageInputEl1.click();
   }, false);

   // use file search to upload image
   imageInputEl.addEventListener('change', function(e){
      imageHandling(e);
   }, false);

   ///back huuu
   imageInputEl1.addEventListener('change', function(e){
      imageHandling1(e);
   }, false);

   // uses drag and drop to upload image
   document.body.addEventListener('drop', function(e){
      imageHandling(e);
   }, false);

   /////back hu/////
   document.body.addEventListener('drop', function(e){
      imageHandling1(e);
   }, false);


   function imageHandling(e) {
      imageFile = e.target.files[0];
      if(!imageFile.type.match('image.*')) {
         alert("This file is not a unsupported image file");
         return;
      }
      reader = new FileReader();
      reader.addEventListener('load', (function() {
         return function(e) {
            // uploads images in target area
            designDisplayEl.setAttribute('src', e.target.result);
         };
      })(imageFile), false);
      reader.readAsDataURL(imageFile);
   }
   // end of image uploads

   /////back hu image uploads/////

   function imageHandling1(e) {
      imageFile = e.target.files[0];
      if(!imageFile.type.match('image.*')) {
         alert("This file is not a unsupported image file");
         return;
      }
      reader = new FileReader();
      reader.addEventListener('load', (function() {
         return function(e) {
            // uploads images in target area
            designDisplayEl1.setAttribute('src', e.target.result);
         };
      })(imageFile), false);
      reader.readAsDataURL(imageFile);
   }

   let defaultThumbnailsEl = document.querySelectorAll('.default-image');
   let defaultThumbnailsEl1 = document.querySelectorAll('.default-image1');

   defaultThumbnailsEl.forEach( function(el) {
      console.log(el);
      el.addEventListener('click', function(e) {
         let imgEl = el.firstElementChild;
         console.log(imgEl);
         let imgElAttr = imgEl.getAttribute('src');
         console.log(imgElAttr);
         // console.log(imgElAttr);
         // console.log(defaultThumbnailEl.firstElementChild);
                  // e.stopPropagation();
         designDisplayEl.setAttribute('src', imgElAttr);
      })
   });

   ///////back hu //////////////////////////////////

   defaultThumbnailsEl1.forEach( function(el) {
      console.log(el);
      el.addEventListener('click', function(e) {
         let imgEl = el.firstElementChild;
         console.log(imgEl);
         let imgElAttr = imgEl.getAttribute('src');
         console.log(imgElAttr);
         // console.log(imgElAttr);
         // console.log(defaultThumbnailEl.firstElementChild);
                  // e.stopPropagation();
         designDisplayEl1.setAttribute('src', imgElAttr);
      })
   });


   // DRAGGABLE IMAGE =====================
   $('#design-display').draggable({ containment: '#design-target', scroll: false });
   $('#text-display').draggable({ containment: '#design-target', scroll: true });

   ///////backuuuuu////////////////////////////////
   $('#design-display1').draggable({ containment: '#design-target1', scroll: false });
   $('#text-display1').draggable({ containment: '#design-target1', scroll: true });
   // end of draggable images

   // RESIZE IMAGE BUTTON CONTROLS =====================
   const changeSize = 3;
   const changeImgPos = 3;
   const changeTextPos = 3;
   // let imagePositionX = $('#design-display').position().left;
   // let imagePositionY = $('#design-display').position().top;

   $('#width-plus').on('click', function() {
      let curWidth = $('#design-display').width();
      curWidth += changeSize;
      $('#design-display').width(`${curWidth}px`);

      let imagePositionX = $('#design-display').position();
      imagePositionX -= changeImgPos;
      $('#design-display').css({"left": imagePositionX});
      calcArtDimensions();
   });

   /////back huuuu////////////////////////////////
   $('#width-plus1').on('click', function() {
      let curWidth = $('#design-display1').width();
      curWidth += changeSize;
      $('#design-display1').width(`${curWidth}px`);

      let imagePositionX = $('#design-display1').position();
      imagePositionX -= changeImgPos;
      $('#design-display1').css({"left": imagePositionX});
      calcArtDimensions1();
   });

   $('#width-minus').on('click', function() {
      let curWidth = $('#design-display').width();
      curWidth -= changeSize;
      $('#design-display').width(`${curWidth}px`);

      let imagePositionX = $('#design-display').position();
      imagePositionX += changeImgPos;
      $('#design-display').css({'left': imagePositionX});
      calcArtDimensions();
   });


   ///////back huuuu////////////////////////////////
   $('#width-minus1').on('click', function() {
      let curWidth = $('#design-display1').width();
      curWidth -= changeSize;
      $('#design-display1').width(`${curWidth}px`);

      let imagePositionX = $('#design-display1').position();
      imagePositionX += changeImgPos;
      $('#design-display1').css({'left': imagePositionX});
      calcArtDimensions1();
   });
   // end of resizeable buttons controls for image

   // IMAGE WIDTH AND HEIGHT CALCULATOR
   // Pertinent info on design data
   // console.log('NEW');
   // console.log('ART FILE: ' + currentArtFileName);
   // console.log('WIDTH: ' + $('#design-display').width());
   // console.log('ART POS TOP: ' + $('#design-display').position().top);
   // console.log('ART POS LEFT: ' + $('#design-display').position().left);
   calcArtDimensions();
   calcArtDimensions1();

   // output the dimensions of the art size
   function calcArtDimensions() {
      const rulerConverter = 10;
      let curWidth = $('#design-display').width();
      let curHeight = $('#design-display').height();
      let widthInInches = curWidth / rulerConverter;
      let heightInInches = curHeight / rulerConverter;
      widthInInches = widthInInches.toFixed(2);
      $('.current-width').text(`${widthInInches}cm`);
      heightInInches = heightInInches.toFixed(2);
      $('.current-height').text(`${heightInInches}cm`);
   }


   //////back hu////////////////////////////////
   function calcArtDimensions1() {
      const rulerConverter = 16;
      let curWidth = $('#design-display1').width();
      let curHeight = $('#design-display1').height();
      let widthInInches = curWidth / rulerConverter;
      let heightInInches = curHeight / rulerConverter;
      widthInInches = widthInInches.toFixed(2);
      $('.current-width1').text(`${widthInInches}cm`);
      heightInInches = heightInInches.toFixed(2);
      $('.current-height1').text(`${heightInInches}cm`);
   }

   // adding custom text
   $('#custom-text').keyup(function() {
      let currentText = $('#custom-text').val();
      console.log(currentText);
      $('#text-display').text(currentText);
   });

   //////back side huuuuh////////////////////////////////
   $('#custom-text1').keyup(function() {
      let currentText = $('#custom-text1').val();
      console.log(currentText);
      $('#text-display1').text(currentText);
   });

   // adding custom font
   $('.font-option').click(function() {
      let currentFont = $('#font-value').text();
      $('#text-display').css({'font-family': currentFont});
   });

   /////back hu/////
   $('.font-option1').click(function() {
      let currentFont = $('#font-value1').text();
      $('#text-display1').css({'font-family': currentFont});
   });

   // using color picker to update text color
   $("#color-choice").on('change', function(){
      let curHexColor = $(this).val();
      console.log(curHexColor);
      $('#text-display').css({'color': curHexColor});
      $("#text-color-value").text(curHexColor);
   });
//////////////back hu//////////////
   $("#color-choice1").on('change', function(){
      let curHexColor = $(this).val();
      console.log(curHexColor);
      $('#text-display1').css({'color': curHexColor});
      $("#text-color-value1").text(curHexColor);
   });




   // RESIZE TEXT BUTTON CONTROLS =====================

   function increaseTextSize() {
      let curfontSize = $('#text-display').css('font-size');
      let removePxLength = curfontSize.length - 2;
      curfontSize = curfontSize.slice(0,removePxLength);
      curfontSize = parseInt(curfontSize);
      curfontSize += changeSize;
      $('#text-display').css({'font-size': `${curfontSize}px`});
      let textPositionX = $('#text-display').position().left;
      textPositionX -= changeTextPos;
      $('#text-display').css({"left": textPositionX});
   }

        //////////////back side hu////////////////////////////////
        function increaseTextSize1() {
         let curfontSize = $('#text-display1').css('font-size');
         let removePxLength = curfontSize.length - 2;
         curfontSize = curfontSize.slice(0,removePxLength);
         curfontSize = parseInt(curfontSize);
         curfontSize += changeSize;
         $('#text-display1').css({'font-size': `${curfontSize}px`});
         let textPositionX = $('#text-display1').position();
         textPositionX -= changeTextPos;
         $('#text-display1').css({"left": textPositionX});
      }


   function decreaseTextSize() {
      let curfontSize = $('#text-display').css('font-size');
      let removePxLength = curfontSize.length - 2;
      curfontSize = curfontSize.slice(0,removePxLength);
      curfontSize = parseInt(curfontSize);
      curfontSize -= changeSize;
      $('#text-display').css({'font-size': `${curfontSize}px`});
      let textPositionX = $('#text-display').position();
      textPositionX += changeTextPos;
      $('#text-display').css({"left": textPositionX});
   }

    ///////////////////back side hu////////////////////////////////////////////////
    function decreaseTextSize1() {
      let curfontSize = $('#text-display1').css('font-size');
      let removePxLength = curfontSize.length - 2;
      curfontSize = curfontSize.slice(0,removePxLength);
      curfontSize = parseInt(curfontSize);
      curfontSize -= changeSize;
      $('#text-display1').css({'font-size': `${curfontSize}px`});
      let textPositionX = $('#text-display1').position();
      textPositionX += changeTextPos;
      $('#text-display1').css({"left": textPositionX});
   }


   $('#text-plus').on('click', function() {
      increaseTextSize();
   });

   $('#text-plus1').on('click', function() {
      increaseTextSize1();
   });

   $('#text-minus').on('click', function() {
      decreaseTextSize();
   });

   $('#text-minus1').on('click', function() {
      decreaseTextSize1();
   });
   // end of resizeable buttons controls for images



   // Mobile Controls
   $('#mb-left').on('click', function() {
      if (($('.mobile-icon .fa-file-image').hasClass('active-image')) ||
         ($('.mobile-icon .fa-question').hasClass('active-image'))) {
         let imagePositionX = $('#design-display').position().left;
         imagePositionX -= changeImgPos;
         $('#design-display').css({'left': imagePositionX});
      } else if ($('.mobile-icon .fa-font').hasClass('active-image')) {
         let textPositionX = $('#text-display').position().left;
         textPositionX -= changeTextPos;
         $('#text-display').css({"left": textPositionX});
      }
   });
   $('#mb-right').on('click', function() {
      if (($('.mobile-icon .fa-file-image').hasClass('active-image')) ||
         ($('.mobile-icon .fa-question').hasClass('active-image'))) {
         let imagePositionX = $('#design-display').position().left;
         imagePositionX += changeImgPos;
         $('#design-display').css({'left': imagePositionX });
      } else if ($('.mobile-icon .fa-font').hasClass('active-image')) {
         let textPositionX = $('#text-display').position().left;
         textPositionX += changeTextPos;
         $('#text-display').css({"left": textPositionX});
      }
   });
   $('#mb-up').on('click', function() {
      let imagePositionY = $('#design-display').position().top;
      if (($('.mobile-icon .fa-file-image').hasClass('active-image')) ||
         ($('.mobile-icon .fa-question').hasClass('active-image'))) {
         imagePositionY -= changeImgPos;
         $('#design-display').css({'top': imagePositionY });
      } else if ($('.mobile-icon .fa-font').hasClass('active-image')) {
         let textPositionY = $('#text-display').position().top;
         textPositionY -= changeTextPos;
         $('#text-display').css({"top": textPositionY});
      }
   });
   $('#mb-down').on('click', function() {
      let imagePositionY = $('#design-display').position().top;
      if (($('.mobile-icon .fa-file-image').hasClass('active-image')) ||
         ($('.mobile-icon .fa-question').hasClass('active-image'))) {
         imagePositionY += changeImgPos;
         $('#design-display').css({'top': imagePositionY });
      } else if ($('.mobile-icon .fa-font').hasClass('active-image')) {
         let textPositionY = $('#text-display').position().top;
         textPositionY += changeTextPos;
         $('#text-display').css({"top": textPositionY});
      }
   });

   $('#mb-plus').on('click', function() {
      if (($('.mobile-icon .fa-file-image').hasClass('active-image')) ||
         ($('.mobile-icon .fa-question').hasClass('active-image'))) {
         let curWidth = $('#design-display').width();
         curWidth += changeSize;
         $('#design-display').width(`${curWidth}px`);
         let imagePositionX = $('#design-display').position().left;
         imagePositionX -= changeImgPos;
         $('#design-display').css({"left": imagePositionX});
         calcArtDimensions();
      } else if ($('.mobile-icon .fa-font').hasClass('active-image')) {
         increaseTextSize();
      }
   });
   $('#mb-minus').on('click', function() {
      if (($('.mobile-icon .fa-file-image').hasClass('active-image')) ||
         ($('.mobile-icon .fa-question').hasClass('active-image'))) {
         let curWidth = $('#design-display').width();
         curWidth -= changeSize;
         $('#design-display').width(`${curWidth}px`);
         let imagePositionX = $('#design-display').position().left;
         imagePositionX += changeImgPos;
         $('#design-display').css({'left': imagePositionX});
         calcArtDimensions();
      } else if ($('.mobile-icon .fa-font').hasClass('active-image')) {
         decreaseTextSize();
      }
   });


   $('#mb-garment').on('click', function() {
      $('#garment-control').slideToggle();
      $('#image-control, #text-control, #default-control' ).slideUp();
      $('.fa-tshirt').addClass('active-image');
      $('.fa-file-image, .fa-font, .fa-question').removeClass('active-image');
      $('.mobile-position').removeClass('show-position');
   });
   $('#mb-image').on('click', function() {
      $('#image-control').slideToggle();
      $('#garment-control, #text-control, #default-control').slideUp();
      $('.fa-file-image').addClass('active-image');
      $('.fa-tshirt, .fa-font, .fa-question').removeClass('active-image');
      $('.mobile-position').addClass('show-position');
   });
   $('#mb-text').on('click', function() {
      $('#text-control').slideToggle();
      $('#garment-control, #image-control, #default-control').slideUp();
      $('.fa-font').addClass('active-image');
      $('.fa-tshirt, .fa-file-image, .fa-question').removeClass('active-image');
      $('.mobile-position').addClass('show-position');
   });
   $('#mb-default').on('click', function() {
      $('#default-control').slideToggle();
      $('#garment-control, #image-control, #text-control').slideUp();
      $('.fa-question').addClass('active-image');
      $('.fa-tshirt, .fa-file-image, .fa-font').removeClass('active-image');
      $('.mobile-position').addClass('show-position');     
   });

   $('.mobile-close').on('click', function() {
      $('#garment-control, #image-control, #text-control, #default-control').slideUp();
   });




}); // end of document.ready




