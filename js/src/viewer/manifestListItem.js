(function($) {

  $.ManifestListItem = function(options) {

    jQuery.extend(true, this, {
      element:                    null,
      appendTo:                   null,
      manifest:                   null,
      loadStatus:                 null,
      thumbHeight:                123,
      urlHeight:                  150,
      resultsWidth:               0,  // based on screen width
      maxPreviewImagesWidth:      0,
      repoWidth:                  80,
      metadataWidth:              450,
      margin:                     15,
      remainingWidth:             20,
      imagesTotalWidth:           0,
      tplData:                    null,
      allImages:                  [],
      remaining:                  0,
      forcedIndex:                null,
      state:                      null,
      eventEmitter:               null,
      labelToString:              function(label) { return "youpi",label; },
      url:null
    }, options);

    this.init();

  };

  $.ManifestListItem.prototype = {

    init: function() {
      var _this = this;
      //need a better way of calculating this because JS can't get width and margin of hidden elements, so must manually set that info
      //ultimately use 95% of space available, since sometimes it still displays too many images
      this.maxPreviewImagesWidth = this.resultsWidth - (this.repoWidth + this.margin + this.metadataWidth + this.margin + this.remainingWidth);
      this.maxPreviewImagesWidth = this.maxPreviewImagesWidth * 0.95;

      $.Handlebars.registerHelper('pluralize', function(count, singular, plural) {
        if (count === 1) {
          return singular;
        } else {
          return plural;
        }
      });

      this.fetchTplData(this.manifestId);
      if (this.forcedIndex !== null) {
        this.tplData.index = this.forcedIndex;
      }

      if (_this.state.getStateProperty('preserveManifestOrder')) {
        if (this.appendTo.children().length === 0) {
          this.element = jQuery(this.template(this.tplData)).prependTo(this.appendTo).hide().fadeIn('slow');
        } else {
          var liList = _this.appendTo.find('li');
          jQuery.each(liList, function(index, item) {
              var prev = parseFloat(jQuery(item).attr('data-index-number'));
              var next = parseFloat(jQuery(liList[index+1]).attr('data-index-number'));
              var current = _this.tplData.index;
              if (current <= prev && (next > current || isNaN(next)) ) {
                _this.element = jQuery(_this.template(_this.tplData)).insertBefore(jQuery(item)).hide().fadeIn('slow');
                return false;
              } else if (current > prev && (current < next || isNaN(next))) {
                _this.element = jQuery(_this.template(_this.tplData)).insertAfter(jQuery(item)).hide().fadeIn('slow');
                return false;
              }
          });
        }
      } else {
        this.element = jQuery(this.template(this.tplData)).prependTo(this.appendTo).hide().fadeIn('slow');
      }

      this.bindEvents();
      this.listenForActions();

      //console.log("MLI ready",this.manifest);

    },

    fetchTplData: function() {
      var _this = this,location,manifest,pdf ;
      if(!_this.manifest) {        
        _this.manifest = { 
          jsonLd: {
            label:{"@language":"en","@value":"loading manifest..."},
            sequences:[{canvases:[]}]
          }
        };
      } 
      location = _this.manifest.location ;
      manifest = _this.manifest.jsonLd ;
      if(manifest) pdf = manifest.rendering ;
      var _url = _this.url ;
      //if(!_url && manifest) _url = manifest["@id"];

      if(pdf) {
        //console.log("pdf",pdf);
        for(var idx = 0 ; idx < manifest.rendering.length ; idx ++) {
          //console.log("idx",idx,pdf[idx]);
          if(pdf[idx].format == "application/pdf")
          {
            pdf = pdf[idx]["@id"];
            //console.log("found",pdf);
            break ;
          }
        }
      }

      this.tplData = {
        label: _this.labelToString(manifest.label) ,// $.JsonLd.getTextValue(manifest.label),
        repository: location,
        canvasCount: (manifest.sequences[0].canvases?manifest.sequences[0].canvases.length:0),
        images: [],
        index: _this.state.getManifestIndex(manifest['@id']),
        pdf: pdf,
        url: _url,
        manifId:manifest["@id"],
        error:manifest.error
      };

      this.tplData.repoImage = (function() {
        var repo = _this.tplData.repository;
        if (manifest.logo) {
          if (typeof manifest.logo === "string")
            return manifest.logo.replace(/:\/\/ngcs-beta\.staatsbibliothek-berlin\.de\//, "://content.staatsbibliothek-berlin.de/");
          if (typeof manifest.logo['@id'] !== 'undefined')
            return manifest.logo['@id'];
        }
        return '';
      })();


      var aspectRatio, width, i ;

      if(manifest.sequences[0].canvases) for(i=-1; i < manifest.sequences[0].canvases.length; i++) {
        var url ;
        var canvas ;
        if(i == -1) {
          if(manifest.thumbnail) { 
            canvas = manifest.thumbnail ;
            url = manifest.thumbnail["@id"] ;
            //console.log("usin manif.thumb",url);
          }
          else continue ;
        }
        else {          
          var startC = manifest.sequences[0].startCanvas ;
          if(startC) {
            if(!Array.isArray(startC)) startC = [ startC ] ;
            canvas = manifest.sequences[0].canvases[i];
            for(var c in startC) {
              if(startC[c] === canvas["@id"]) { 

                aspectRatio = canvas.height/canvas.width;
                width = (_this.thumbHeight/aspectRatio);
                if(width > canvas.width) width = canvas.width ;
                
                url = _this.manifest.getThumbnailForCanvas(canvas, width);
                console.log("startC:",url,canvas);
                break ;
              }
            }
            // DONE: don't continue here or we won't queue image for loading at end of for
            
            // continue
          }
          else {
            canvas = manifest.sequences[0].canvases[i];

            aspectRatio = canvas.height/canvas.width;
            width = (_this.thumbHeight/aspectRatio);
            if(width > canvas.width) width = canvas.width ;
            
            url = _this.manifest.getThumbnailForCanvas(canvas, width);

            console.log("startC:",canvas,url);
          }
        }

        if (!canvas || canvas.width === 0 || canvas["@id"].includes("/missing")) {
          console.warn("no canvas?",canvas,url);
          continue;
        }

        //if(url && canvas.height >= 246) 
        if(url && url.includes("/max/")) url = url.replace(/\/max\//,"/!2000,"+(_this.thumbHeight+1)+"/");

        aspectRatio = canvas.height/canvas.width;
        width = (_this.thumbHeight/aspectRatio);
        if(width > canvas.width) width = canvas.width ;

        var view ;
        if(canvas['@id'] && canvas['@id'].match(/bdr:[A-Z]/)) view = canvas['@id'].replace(/.*(bdr:[^:/]+).*/,"$1") ;

        var img = {
          url: url,
          width: width,
          height: _this.thumbHeight,
          id: canvas['@id'],
          view: view,
          index: i
        } ;
        
        //console.log("push:",url,img);

        _this.allImages.push(img);
      }

      jQuery.each(jQuery(_this.allImages).first(), function(index, value) {
        var width = value.width;
        _this.imagesTotalWidth += (width + _this.margin);
        /*
        if (_this.imagesTotalWidth >= _this.maxPreviewImagesWidth) {
          // outsized image will inherited
          if (value.width > _this.maxPreviewImagesWidth) {
            //_this.tplData.images.push(value);
          }
          _this.imagesTotalWidth -= (width + _this.margin);
          return false;
        }
        */
        _this.tplData.images.push(value);
      });

      _this.remaining = this.tplData.remaining = (function() {
        var remaining = _this.allImages.length - _this.tplData.images.length;
        if (remaining > 0) {
          return remaining;
        }
      })();

      
    },

    render: function() {

    },

    listenForActions: function() {
      var _this = this;
      var manifest = _this.manifest.jsonLd ;
    
      if(manifest && manifest.rendering) {
        var render = manifest.rendering ;
        if(!Array.isArray(render)) render = [ render ] ;
        if(render.length) {

          var el = _this.element.find(".pdfDL");
          
          for(i = 0 ; i < render.length ; i ++) {
            var txt = i18next.t("get" + (render[i].format.includes("pdf")?"PDF":"ZIP"));

            // DONE using "<li>" breaks both lazy loading & ordering...
            el.find("ul.select").append("<span data-init='0' data-value='"+render[i]["@id"]+"'>"+txt+"</span>") ;            
          }
          
          el.addClass("on").removeAttr("title");
  
          var clickable = el.find("ul > span");
          $.handlePDFdownload(render, clickable, "span");

          el.find(".before").click(function(event) {                                    
            var on = el.parent().find("ul.select").hasClass("on");
            if(!on) el.closest(".items-listing").find("ul.on").removeClass("on");
            el.parent().find("ul.select").toggleClass("on");
            event.stopPropagation();
            event.preventDefault();
            return false;          
          });
                
          jQuery(document).click(function(event) {
            el.find("ul.on").removeClass("on");
          });
          
        }
      }

      _this.eventEmitter.subscribe('manifestPanelWidthChanged', function(event, newWidth){
        _this.updateDisplay(newWidth);
      });

      _this.eventEmitter.subscribe('OPEN_MANIFEST.'+_this.manifest.jsonLd["@id"], function(e){
        _this.element.find(".preview-image").click();
      });

      _this.eventEmitter.subscribe('UPDATE_MAIN_MENU_MANIFEST.'+_this.manifest.jsonLd["@id"], function(e){
        console.log("UMMM",_this,e);

        jQuery(".nav-bar-top #breadcrumbs #vol span").text(_this.labelToString(_this.manifest.jsonLd.label))
        .parent().addClass("active").attr("data-reading-view-id",_this.allImages[0].id);
        
        jQuery(".nav-bar-top #breadcrumbs #image").removeClass("active on");

        /*
        if(_this.allImages.length && _this.allImages[0].id) {
          if(jQuery(".nav-bar-top #breadcrumbs #image").attr("data-reading-view-id") !== _this.allImages[0].id) {
            jQuery(".nav-bar-top #breadcrumbs #image span").text(_this.allImages[0].id.replace(/^.*?[/]([^/]+)([/]canvas)?$/,"$1"))
            .parent().addClass("active").attr("data-page-view-id",_this.allImages[0].id).attr("data-reading-view-id",_this.allImages[0].id);
          }
        }
        */
        
      });

      _this.eventEmitter.subscribe('UPDATE_MAIN_MENU_IMAGE.'+_this.manifest.jsonLd["@id"], function(e){
        console.log("UMMI",_this,e);

        if(_this.allImages.length && _this.allImages[0].id) {
          if(jQuery(".nav-bar-top #breadcrumbs #image").attr("data-reading-view-id") !== _this.allImages[0].id) {
            jQuery(".nav-bar-top #breadcrumbs #image span").text(_this.allImages[0].id.replace(/^.*?[/]([^/]+)([/]canvas)?$/,"$1"))
            .parent().addClass("active").attr("data-page-view-id",_this.allImages[0].id).attr("data-reading-view-id",_this.allImages[0].id);
          }
        }
        
      });
    },

    bindEvents: function() {
      var _this = this;

      this.element.find('img').on('load', function() {
        //if img width is not equal to the width in the html, change height
        jQuery(this).hide().fadeIn(600);        
        _this.eventEmitter.publish('UPDATE_COLLECTION_SCROLL_BAR');
      });


      /*
      this.element.on('click', function() {
        var windowConfig = {
          manifest: _this.manifest,
          canvasID: null,
          viewType: 'ThumbnailsView'
        };
        _this.eventEmitter.publish('ADD_WINDOW', windowConfig);
      });

      this.element.find('.preview-image').on('click', function(e) {
        e.stopPropagation();
        var windowConfig = {
          manifest: _this.manifest,
          canvasID: jQuery(this).attr('data-image-id'),
          viewType: _this.state.getStateProperty('windowSettings').viewType //get the view type from settings rather than always defaulting to ImageView
        };
        _this.eventEmitter.publish('ADD_WINDOW', windowConfig);
      });
      */

      this.element.find('.preview-image').on('click', function(e) {
        var windowConfig = {
          manifest: _this.manifest,
          canvasID: null,
          viewType: 'ScrollView'
        };
        _this.eventEmitter.publish('ADD_WINDOW', windowConfig);
        _this.eventEmitter.publish('UPDATE_MAIN_MENU_MANIFEST.'+_this.manifest.jsonLd["@id"]);
        if(jQuery(_this.element).closest("ul").find("li").length >= 1) jQuery(".mobile-button.top.off").removeClass("off");
        e.preventDefault();
      });
    },

    updateDisplay: function(newWidth) {
        var _this = this,
        newMaxPreviewWidth = newWidth - (_this.repoWidth + _this.margin + _this.metadataWidth + _this.margin + _this.remainingWidth);
        newMaxPreviewWidth = newMaxPreviewWidth * 0.95;
        var image = null;

        //width of browser window has been made smaller
        if (false && newMaxPreviewWidth < _this.maxPreviewImagesWidth ) {
          while (_this.imagesTotalWidth >= newMaxPreviewWidth) {
            image = _this.tplData.images.pop();

            if (image) {
              _this.imagesTotalWidth -= (image.width + _this.margin);

              //remove image from dom
              _this.element.find('img[data-image-id="'+image.id+'"]').remove();
            } else {
              break;
            }
          }
          //check if need to add ellipsis
          if (_this.remaining === 0 && _this.allImages.length - _this.tplData.images.length > 0) {
              _this.element.find('.preview-images').after('<i class="fa fa fa-ellipsis-h remaining"></i>');
          }
          _this.remaining = _this.allImages.length - _this.tplData.images.length;

        } else if ( false && newMaxPreviewWidth > _this.maxPreviewImagesWidth) {
          //width of browser window has been made larger
          var currentLastImage = _this.tplData.images[_this.tplData.images.length-1],
            index = currentLastImage ? currentLastImage.index+1 : 0;

          image = _this.allImages[index];

          if (image) {
            while (_this.imagesTotalWidth + image.width + _this.margin < newMaxPreviewWidth) {
              _this.tplData.images.push(image);
              _this.imagesTotalWidth += (image.width + _this.margin);

              //add image to dom
              _this.element.find('.preview-images').append('<img data-src="'+image.url+'" width="'+image.width+'" height="'+image.height+'" class="preview-image flash" data-image-id="'+image.id+'">');

              //get next image
              index++;
              image = _this.allImages[index];
              if (!image) {
                break;
              }
            }
            //check if need to remove ellipsis
          if (_this.remaining > 0 && _this.allImages.length - _this.tplData.images.length === 0) {
            _this.element.find('.remaining').remove();
          }
          _this.remaining = _this.allImages.length - _this.tplData.images.length;
          }
        }
        _this.maxPreviewImagesWidth = newMaxPreviewWidth;
        _this.eventEmitter.publish('manifestListItemRendered');
    },

    hide: function() {
      var _this = this;
    },

    show: function() {
      var _this = this;
    },

    template: $.Handlebars.compile([
    '<li data-index-number={{index}} data-url={{url}}>',
      '<div class="preview-thumb">',
        '<div class="repo-image">',
          '{{#if repoImage}}',
          '<img data-src="{{repoImage}}" src={{repoImage}} alt="repoImg">',
          '{{else if error}}',
          '<img data-src="https://iiif.bdrc.io/static::logo.png/full/max/0/default.png" src="https://iiif.bdrc.io/static::logo.png/full/max/0/default.png" alt="repoImg" style="">',
          '{{else}}',
          '<span class="default-logo"></span>',
          '{{/if}}',
        '</div>',
        '<div class="preview-images {{#if error}}error{{/if}}" data-manifest={{manifId}}>',
        '{{#each images}}',
          '{{#if view}}',
            '<a href="/view/{{view}}"><img data-src="{{url}}" width="{{width}}" height="{{height}}" class="preview-image flash" data-image-id="{{id}}"></a>',
          '{{else}}',  
            '<a href="#"><img data-src="{{url}}" width="{{width}}" height="{{height}}" class="preview-image flash" data-image-id="{{id}}"></a>',
          '{{/if}}',          
        '{{/each}}',
        '</div>',
        '{{#if remaining}}',
          '<i class="fa fa fa-ellipsis-h remaining"></i>',
        '{{/if}}',
        '{{#if pdf}}',
        '<a class="pdfDL" title="Download as PDF" target="_blank" data-href="{{pdf}}">',
        '<div class="before"></div>',
        '<ul class="select">',
        '</ul>',
        '</a>',
        '{{/if}}',        
      '</div>',
      '<div class="select-metadata">',
        '<div class="manifest-title">',
          '<h3 title="{{{label}}}">{{{label}}}</h3>',
        '</div>',
        '<div class="item-info">',
          '<div class="item-info-row">',
            '{{#if repository}}',
              '<div class="repo-label">{{repository}}</div>',
            '{{/if}}',
            '<div class="canvas-count">{{canvasCount}} {{pluralize canvasCount (t "image") (t "images")}}</div>',
          '</div>',
        '</div>',
      '</div>',
    '</li>'
    ].join(''))
  };

}(Mirador));
