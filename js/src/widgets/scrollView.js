(function($) {

  $.ScrollView = function(options) {

    jQuery.extend(this, {
      currentImgIndex:      0,
      canvasID:              null,
      focusImages:          [],
      manifest:             null,
      element:              null,
      imagesList:           [],
      appendTo:             null,
      thumbInfo:            {thumbsHeight: 150, listingCssCls: 'listing-thumbs', thumbnailCls: 'thumbnail-view'},
      windowId:             null,
      panel:                false,
      vDirectionStatus: '',
      lazyLoadingFactor:    3  //should be >= 1
    }, options);

    jQuery.extend($.ScrollView.prototype, $.ThumbnailsView.prototype);

    $.ScrollView.prototype.originalLoadContent = $.ThumbnailsView.prototype.loadContent ;
    $.ScrollView.prototype.loadContent = function(useThumbnailProperty) {
        this.scrollView = true ;
        if(useThumbnailProperty == undefined) useThumbnailProperty = false ;
        return this.originalLoadContent(useThumbnailProperty,this) ;
    } ;

    $.ScrollView.prototype.originalReloadImages = $.ThumbnailsView.prototype.reloadImages ;
    $.ScrollView.prototype.reloadImages = function(newThumbHeight, triggerShow, useThumbnailProperty) {
        
      var _this = this;
      this.thumbInfo.thumbsHeight = newThumbHeight;
      if(useThumbnailProperty == undefined) useThumbnailProperty = false ;

      jQuery.each(this.imagesList, function(index, image) {
        var aspectRatio = image.height/image.width,
        width = (_this.thumbInfo.thumbsHeight/aspectRatio),
        height = _this.thumbInfo.thumbsHeight,
        id = image['@id'];      

        //console.log("reload",image,width,height,image.width,image.height,_this.thumbInfo.thumbsHeight);
        width = image.width;
        height = image.height;

        var img = image.images ;      
        if(img && img.length && img[0]) {
          img = img[0] ;
          if(img.resource && img.resource.service ) {
            img = img.resource.service ;
            if(img.width && img.height) {
              if(img.width > img.height) {
                width = Math.min(img.width, 3500);
                height = width *aspectRatio;
              } else {
                height = Math.min(img.height, 2000);
                width = height / aspectRatio;
              }
            }            
            else { 
              img = image.images[0].resource;
              if(width === img.width && height === img.height) { // Taisho manifest

                if(image.width > image.height) {
                  width =  Math.min(image.width,3500); // use best *reasonable* width 
                  height = width *  aspectRatio ;
                  // width = (_this.thumbInfo.thumbsHeight/aspectRatio); // deprecated
                } else {
                  height = Math.min(image.height,2000); // use best *reasonable* width 
                  width = height / aspectRatio ;
                }
              }
            }
          }        
        }

        var newThumbURL = $.getThumbnailForCanvas(image, width, useThumbnailProperty);        
        var imageElement = _this.element.find('img[data-image-id="'+id+'"]');
        imageElement.attr('data', newThumbURL).attr('height', height).attr('width', width).attr('src', '');
      });
      if (triggerShow) {
        this.show();
      }
        
        /*return this.originalReloadImages(newThumbHeight, triggerShow, useThumbnailProperty ) ;*/

    } ;


    $.ScrollView.prototype.originalTemplate = $.ScrollView.prototype.template ;
    $.ScrollView.prototype.template = $.Handlebars.compile([      
      '<div class="{{thumbnailCls}}">',
      '<div class="provider"><div></div></div>',
      '<ul class="{{listingCssCls}}" role="list" aria-label="Thumbnails">',
      '{{#thumbs}}',
      '<li class="{{highlight}}" role="listitem" aria-label="Thumbnail">',
      '<img class="thumbnail-image {{highlight}}" data-image-id="{{id}}" src="" data="{{thumbUrl}}" data-max-height={{height}} data-ratio={{ratio}} width="{{width}}" style="max-width:{{width}}px;min-height:{{height}}px">',
      '<div class="etext-content" width="{{width}}" style="max-width:{{width}}px;height:auto;"></div>',
      '<div class="thumb-label" lang={{locale}}>{{title}}</div>',
      '</li>',
      '{{/thumbs}}',
      '</ul>',
      '</div>'
    ].join(''));


    $.ScrollView.prototype.originalToggle = $.ScrollView.prototype.toggle ;
    $.ScrollView.prototype.toggle = function(stateValue) {
      if (stateValue) {



        var urlParams = new URLSearchParams(window.location.search), origin = urlParams.get("origin");
        var inApp = (window.screen.width < 800) || (origin && origin.startsWith("BDRCLibApp"));
        if(inApp) {
          jQuery(".scroll-view").addClass("auto_rela").parents().addClass("auto_rela");
        }


        var label = this.labelToString(this.manifest.jsonLd.label, [], true);
        if(label.startsWith("volume ")) label = "V"+label.substring(1) ;

        jQuery(".nav-bar-top #breadcrumbs .on").removeClass("on");
        jQuery(".nav-bar-top #breadcrumbs #vol span").text(label).parent().addClass("active on");
        
        /*
        if(!jQuery(".nav-bar-top #breadcrumbs #image").attr("data-page-view-id")) {
          jQuery(".nav-bar-top #breadcrumbs #image span").text(this.imagesList[0]["@id"].replace(/^.*?[/]([^/]+)([/]canvas)?$/,"$1"))
          .parent().addClass("active").attr("data-page-view-id",this.imagesList[0]["@id"]);
        }
        */
        this.show();

        if(!window.tmpScroll) {
          var ima = jQuery(".nav-bar-top #breadcrumbs #image");
          if(ima.attr("data-page-view-id")) setTimeout(function() { window.scrollToImage(ima.attr("data-page-view-id")); }, 1000);
        }

        /*
        if(!inApp) jQuery(window).scroll();
        else {
          jQuery("html,body").scroll();
          //jQuery("body").scroll();
        }
        */

        /* TODO not working with setInterval (try with "Goto" from footer menu)
        var ima = jQuery(".nav-bar-top #breadcrumbs #image");
        if(ima.attr("data-page-view-id")) { 
          // auto // console.log("scroll?",ima.attr("data-page-view-id"));
          var timerScroll = setInterval(function() { 
            // auto // console.log(ima.attr("data-page-view-id"), jQuery("[data-image-id='"+ima.attr("data-page-view-id")+"']"));
            if(jQuery("[data-image-id='"+ima.attr("data-page-view-id")+"']").length) {
              window.scrollToImage(ima.attr("data-page-view-id")); 
              clearInterval(timerScroll);
            }
          }, 10);
          setTimeout(function(){ clearInterval(timerScroll);},1000);
        }
        */
      } else {
        this.hide();
      }
    };

    $.ScrollView.prototype.originalInitThumbs = $.ScrollView.prototype.initThumbs ;
    $.ScrollView.prototype.initThumbs = function( tplData, useThumbnailProperty) {
      var _this = this;
      var dash = i18next.t("_dash");
      var prevW ;

      tplData.thumbs = jQuery.map(this.imagesList, function(canvas, index) {

        if (canvas.width === 0) {
          return {};
        }
        
        var aspectRatio = canvas.height/canvas.width,
          width = canvas.width,
          height = canvas.height,
          isErrorImg = canvas["@id"] && canvas["@id"].indexOf("static::error-copyright") != -1  && window.screen.width < 800 /*&& window.innerWidth < window.innerHeight*/ ;

        /* // better if copyright image is full width
        if(prevW && isErrorImg) {
          width = prevW ;
          height =  width * aspectRatio;
        } 
        */       

        var img = canvas.images ;
        if(img && img.length && img[0] && !isErrorImg) {
          img = img[0] ;
          if(img.resource && img.resource.service ) {
            img = img.resource.service ;
            if(img.width && img.height) {
              if(img.width > img.height) {
                width = Math.min(img.width, 3500);
                height = width *aspectRatio;
              } else {
                height = Math.min(img.height, 2000);
                width = height / aspectRatio;
              }
            }            
            else { 
              img = canvas.images[0].resource;
              if(width === img.width && height === img.height) { // Taisho manifest

                if(canvas.width > canvas.height) {
                  width =  Math.min(canvas.width,3500); // use best *reasonable* width 
                  height = width *  aspectRatio ;
                  // width = (_this.thumbInfo.thumbsHeight/aspectRatio); // deprecated
                } else {
                  height = Math.min(canvas.height,2000); // use best *reasonable* width 
                  width = height / aspectRatio ;
                }
              }
            }
          }        
        }

        var thumbnailUrl = $.getThumbnailForCanvas(canvas, width, useThumbnailProperty);

        //console.log("canvas:",isErrorImg,canvas,index,thumbnailUrl,width,height,prevW);

        prevW = width ;

        // initialisation
        var obj = _this.setThumbLabel([ canvas ], null, dash, index);  //= "(loading #"+(Number(index)+1)+")";  

        // missing pages
        if(canvas["@id"].includes("/missing")) title = _this.setThumbLabel([canvas],null,dash,index);        

        return {
          thumbUrl: thumbnailUrl,
          title:    obj.title,
          lang:     obj.lang,
          id:       canvas['@id'],
          width:    width,
          height:   height,
          ratio:    width/height,
          locale:   i18next.language,
          highlight: _this.currentImgIndex === index ? 'highlight' : ''
        };
      });

      _this.element = jQuery(_this.template(tplData)).appendTo(_this.appendTo);

      //if(!_this.ps) _this.ps = new PerfectScrollbar(".scroll-view",{ minScrollbarLength:16, maxScrollbarLength:16 });

    };
    

    this.init();
    if(this.vDirectionStatus == 'rtl') {
      jQuery(this.appendTo).find('.scroll-view').addClass('v-direction-rtl');
    }


    // auto // console.log("provUrl",window.providerUrl,window.providerAttr,this.manifest);



    if(window.providerUrl) {
      var urlParams = new URLSearchParams(window.location.search), origin = urlParams.get("origin");
      var inApp = (window.screen.width < 800) || (origin && origin.startsWith("BDRCLibApp"));      
      if(!window.providerUrl["@id"] || !window.providerUrl["@id"].match(/\/\/iiif(-dev)?\.bdrc\.io\//) || !inApp) { 
        var logoUrl ; 
        if(window.providerUrl["@id"]) logoUrl = window.providerUrl["@id"] ;
        else logoUrl = window.providerUrl;
        logoUrl = logoUrl.replace(/:\/\/ngcs-beta\.staatsbibliothek-berlin\.de\//, "://content.staatsbibliothek-berlin.de/");
        jQuery(".scroll-view .provider div").append("<img src='"+(logoUrl)+"'/>") ; 
      } else if(inApp) {
        jQuery(".scroll-view .provider").remove();
      }
    }
    else if(window.providerAttr) { jQuery(".scroll-view .provider div").prepend("<span>"+this.labelToString(window.providerAttr)+"</span>"); }

    var _this = this ;
    var iniT = setInterval(function(){ 
      // auto // console.log("scrollView postinit check...",jQuery(".scroll-listing-thumbs li img[data-image-id^='http']:not([src^='http'])").length);
      if(jQuery(".scroll-listing-thumbs li img[data-image-id^='http']:not([src^='http'])").length) {
        //jQuery(window).resize(); 
        _this.eventEmitter.publish('windowResize');
        // auto // console.log("RESIZED images should be visible (Z="+Z+")");        
        if(Z != undefined) {
          if(window.currentZoom != undefined) delete window.currentZoom;
          window.setZoom(0);
          jQuery("#Zmenu ul.select li.zoom0").click();
          jQuery("#Zmenu ul.select li.zoom0").click();
        }
        clearInterval(iniT);
      }
    },350);  

    setTimeout(function() {
      // auto // console.log("scrollView postinit end");
      clearInterval(iniT);
    }, 5000);

    
  };

}(Mirador));
