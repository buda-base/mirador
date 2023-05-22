// handle pinch event (see https://developer.mozilla.org/fr/docs/Web/API/Pointer_events/gestes_pincer_zoom)
var evCache = []; 
var prevDiff = -1;

(function($) {

  function getCanvasRotation(canvas) {
    var degrees = 0;
    if(Array.isArray(canvas) && canvas.length) {
      canvas = canvas[0] ;
      if( canvas && canvas.images && canvas.images.length && 
          canvas.images[0] && canvas.images[0] && canvas.images[0].resource &&
          canvas.images[0].resource.selector && canvas.images[0].resource.selector.rotation)          
            degrees = Number(canvas.images[0].resource.selector.rotation) ;
    }
    return degrees ;
  }

  $.ThumbnailsView = function(options) {

    jQuery.extend(this, {
      currentImgIndex:      0,
      canvasID:              null,
      focusImages:          [],
      manifest:             null,
      element:              null,
      imagesList:           [],
      imagesListLtr:           [],
      vDirectionStatus:           '',
      appendTo:             null,
      thumbInfo:            {thumbsHeight: 150, listingCssCls: 'listing-thumbs', thumbnailCls: 'thumbnail-view'},
      defaultThumbWidth:    180,
      defaultThumbHeight:   150,
      windowId:             null,
      panel:                false,
      lazyLoadingFactor:    2,  //should be >= 1
      eventEmitter:         null,
    }, options);

    this.init();

  };


  $.ThumbnailsView.prototype = {

    updateGetEtextPage : function (page){
      //console.log("what?",page,window.getEtextPage,this.getEtextPage);
      if(this.getEtextPage) return this.getEtextPage(page) ;
      else if(window.getEtextPage) return window.getEtextPage(page) ;
    },

    init: function() {
      this.imagePromise = {} ;
      this.scrollView = false ;

      if (this.canvasID !== null) {
        this.currentImgIndex = $.getImageIndexById(this.imagesList, this.canvasID);
      }
      if(this.vDirectionStatus == 'rtl'){
        this.imagesList =  this.imagesListLtr.concat();
      }
      this.loadContent();
      if(this.vDirectionStatus == 'rtl'){
        var firstCanvasId = this.imagesList[0]['@id'];
        var firstCanvasThumbSelector = 'img.thumbnail-image[data-image-id="'+firstCanvasId+'"]';
        jQuery(this.appendTo).find('.panel-thumbnail-view').addClass('v-direction-rtl');
        jQuery(this.appendTo).find('.thumbnail-view').find('li').each(function(){
          jQuery(this).addClass('thumbnail-rtl');
        });
      }
      this.bindEvents();
      this.listenForActions();
    },

    setThumbLabel: function(canvas,doHtml,dash,index) {
      var _this = this;
      if(canvas.length) {

        var id = canvas[0]["@id"];
        var clabel = canvas[0].label;

        if(!clabel) return {title:"",lang:""};
        else if(!Array.isArray(clabel)) clabel = [ clabel ];

        //v3
        var title = _this.labelToString(clabel,null,true,true), lang = "en";        
        
        //console.log("title:",JSON.stringify(title));

        if(title.lang) lang = title.lang ;
        if(title.values) { 
          if(title.values.join) title = title.values.join(dash);
          else { 
            console.warn("cant join",title.values);
            title = title.values ;
          }
        }
        if(title === "p. ") title = "p. "+(Number(index)+1);     

        // v2
        /*
        var localeP = [], fallbackP = [], e;
        for(var i in clabel) {
          e = clabel[i];
          if(e && !e["@language"]) { 
            localeP.push(e);
            fallbackP.push(e);
          } else if(e) {
            if(e["@language"] === "en") {
              fallbackP.push(e);
            }
            if(e["@language"].startsWith(i18next.language) || i18next.language.startsWith(e["@language"])) {
              localeP.push(e);
            }
          }
        }
        if(!localeP.length) localeP = fallbackP;
        var title = localeP
                    .map(function(e) { return _this.labelToString([e],null,true); })
                    .join(dash);
        if(title === "p. ") title = "p. "+(Number(index)+1);       
        */

/*   // v1  
        var clabel = canvas[0].label;
        if(!Array.isArray(clabel)) clabel = [ clabel ];
        var title = 
          clabel
          .filter(function(e){ return e && (!e["@language"] || e["@language"].startsWith(i18next.language) || i18next.language.startsWith(e["@language"])); });
        if(!title.length) // fallback to english for page numbers when uilang not found
          title = clabel 
                  .filter(function(e){ return e && (!e["@language"] || e["@language"] === "en"); });
        title = title
                .map(function(e) { return _this.labelToString([e],null,true); })
                .join(i18next.t("_dash"));
        if(title === "p. ") title = "p. "+(Number(index)+1);         
*/

        if(doHtml) jQuery(doHtml).parent().find(".thumb-label").html(title).parent().find("img").attr("title",title);

        return { title: title, lang: lang };
      }
      return "";
    },


    initThumbs: function( tplData, useThumbnailProperty) {
      var _this = this;
      var dash = i18next.t("_dash");
      
      tplData.thumbs = jQuery.map(this.imagesList, function(canvas, index) {

        if (canvas.width === 0) {
          return {};
        }

        // TODO wrong w x h in https://iiif.archivelab.org/iiif/rashodgson13/manifest.json ...        
        var aspectRatio = canvas.height/canvas.width,
            width = _this.defaultThumbWidth,
            height = width * aspectRatio ;

        var thumbnailUrl = $.getThumbnailForCanvas(canvas, width, useThumbnailProperty);
        
        //console.log("canvas",canvas,index,thumbnailUrl,width,height);

        // initialisation
        var obj = _this.setThumbLabel([ canvas ], null, dash, index);  //"(loading #"+(Number(index)+1)+")";        

        // missing pages: 
        if(canvas["@id"].includes("/missing")) title = _this.setThumbLabel([canvas],null,dash,index);


        return {
          thumbUrl: thumbnailUrl,
          title:    obj.title.replace(/[.] +([0-9])/,".$1"),
          lang:     obj.lang,
          id:       canvas['@id'],
          width:    width,
          height:   height,
          ratio:    width/height,
          highlight: _this.currentImgIndex === index ? 'highlight' : ''
        };
      });

      _this.element = jQuery(_this.template(tplData)).appendTo(_this.appendTo);

      if(!_this.ps) { 

        _this.ps = new PerfectScrollbar(".panel-thumbnail-view",{ minScrollbarLength:16, maxScrollbarLength:16 });
        
        for(var i = 0 ; i < tplData.thumbs.length ; i ++) {
          var val = tplData.thumbs[i].title ; //.replace(/(^[^0-9]+)|([^0-9a-z]$)/g,"") ;
          if(!val) val = "#"+i;
          jQuery(".goto-page select").append("<option value='#"+i+"' lang='"+tplData.thumbs[i].lang+"'>"+val+"</option>") ;
        }        

        var menu = jQuery(".goto-page select").selectmenu( { 
          appendTo:".goto-page",
          position: { my : "right-1 bottom-1", at: "right bottom-2" },
          select: function( event, ui ) { _this.eventEmitter.publish('GOTO_IMAGE_NUM.'+_this.windowId, ui.item.value) ; },
          create: function( event, ui ) { 
            console.log("create:",ui,jQuery("#goto-page select"));
          }
        }).data("ui-selectmenu") ;
        menu.originalRenderItem = menu._renderItem ;
        menu._renderItem = function(ul, item) {
          var li = menu.originalRenderItem(ul, item) ;
          var lang = jQuery(".goto-page select option")[item.index].lang;
          //console.log("render:li",li.index(),lang,item);
          if(lang) li.attr("lang",lang);
          return li ;
        } ;

        if(!_this.gotoPs) { 
          var container = document.querySelector(".goto-page .ui-selectmenu-menu");
          _this.gotoPs = new PerfectScrollbar(container,{ suppressScrollX: true, minScrollbarLength:12 });
          // fix for infinite scroll bug ... remove CSS border much simpler
          /*
          container.addEventListener('ps-scroll-up', function (event)   { _this.endY = false; jQuery(".ps__rail-y").removeClass("reach-end"); });
          container.addEventListener('ps-scroll-down', function (event) { 
            if(_this.endY) { 
              //console.log(jQuery(".goto-page .ui-selectmenu-menu ul").height(),jQuery(container).height()); 
              container.scrollTop = jQuery(".goto-page .ui-selectmenu-menu ul").height() - jQuery(container).height() ; 
              jQuery(".ps__rail-y").addClass("reach-end");
              //_this._endY = false ;
            } 
          });
          container.addEventListener('ps-y-reach-end', function (event) { _this.endY = true;  });
          */
        }
      }      
    },

    loadContent: function(useThumbnailProperty) {
      var _this = this,
      tplData = {
        defaultHeight:  this.thumbInfo.thumbsHeight,
        listingCssCls:  this.thumbInfo.listingCssCls,
        thumbnailCls:   this.thumbInfo.thumbnailCls
      };
      if(useThumbnailProperty == undefined) useThumbnailProperty = true ;

      _this.initThumbs(tplData, useThumbnailProperty);
    },

    updateImage: function(canvasId) {
      this.currentImgIndex = $.getImageIndexById(this.imagesList, canvasId);
      this.element.find('.highlight').removeClass('highlight');
      this.element.find("img[data-image-id='"+canvasId+"']").addClass('highlight');
      this.element.find("img[data-image-id='"+canvasId+"']").parent().addClass('highlight');
    },

    updateFocusImages: function(focusList) {
      var _this = this;
      this.element.find('.highlight').removeClass('highlight');
      jQuery.each(focusList, function(index, canvasId) {
        _this.element.find("img[data-image-id='"+canvasId+"']").addClass('highlight');
        _this.element.find("img[data-image-id='"+canvasId+"']").parent().addClass('highlight');
      });
    },

    currentImageChanged: function() {
      var _this = this,
      target = _this.element.find('.highlight'),
      scrollPosition,
      windowObject = this.state.getWindowObjectById(this.windowId);

      if (target.position()) {
        if (windowObject && windowObject.viewType === 'BookView') {
          scrollPosition = _this.element.scrollLeft() + (target.position().left + (target.next().width() + target.outerWidth())/2) - _this.element.width()/2;
          _this.element.scrollTo(scrollPosition, 900);
        } else {
          //scrollPosition = _this.element.scrollLeft() + (target.position().left + target.width()/2) - _this.element.width()/2;
          scrollPosition = _this.element.scrollTop() + (target.position().top + target.height()/2) - _this.element.height()/2;
          _this.element.scrollTop(scrollPosition);
        }
      }
    },

    listenForActions: function() {
      var _this = this;
      
      /*
      _this.eventEmitter.subscribe(('SET_CURRENT_CANVAS_ID.' + _this.windowId), function(event) {
        _this.currentImageChanged();
      });
      */

      _this.eventEmitter.subscribe('PROVIDER_IMG', function(event,src) {
          jQuery(".scroll-view .provider img").attr("src",src);
      });
      
      _this.eventEmitter.subscribe(('currentCanvasIDUpdated.' + _this.windowId), function(event) {
        _this.currentImageChanged();
      });

      _this.eventEmitter.subscribe('windowResize', $.debounce(function(){
        _this.loadImages();
      }, 100));

    },

    bindEvents: function() {
      var _this = this;
        /* // remove blinking + image moving up/down bug in firefox!
      _this.element.find('img').on('load', function() {
        jQuery(this).hide().fadeIn(750,function(){
          // Under firefox $.show() used under display:none iframe does not change the display.
          // This is workaround for https://github.com/IIIF/mirador/issues/929
          jQuery(this).css('display', 'block');
        });
      });
        */

      // handle pinch event ------------------------------------------------------

      var remove_event = function (ev) {
        for (var i = 0; i < evCache.length; i++) {
          if (evCache[i].pointerId == ev.pointerId) {
            evCache.splice(i, 1);
            break;
          }
        }
      };

      var pointerdown_handler = function (ev) {
        evCache.push(ev);
      } ;


      var pointermove_handler = function (ev) {
        ev.target.style.border = "dashed";

        for (var i = 0; i < evCache.length; i++) {
          if (ev.pointerId == evCache[i].pointerId) {
              evCache[i] = ev;
              break;
          }
        }

        if (evCache.length == 2) {
          var curDiff = Math.abs(evCache[0].clientX - evCache[1].clientX);

          if (prevDiff > 0) {
            if (curDiff > prevDiff) {
              console.log("Zin");
              jQuery("#Zi.on").click();
            }
            if (curDiff < prevDiff) {
              console.log("Zout");
              jQuery("#Zo.on").click();
            }
          }

          prevDiff = curDiff;
        }
      };
      

      var pointerup_handler = function (ev) {
        remove_event(ev);
        if (evCache.length < 2) prevDiff = -1;
      };


      if(_this.scrollView) {
        var el = jQuery(_this.element)[0];
        el.onpointerdown = pointerdown_handler;
        el.onpointermove = pointermove_handler;

        el.onpointerup = pointerup_handler;
        el.onpointercancel = pointerup_handler;
        el.onpointerout = pointerup_handler;
        el.onpointerleave = pointerup_handler;
      }

      // -----------------------------------------------------------------------------




      if(!window.miradorIniScroll  && jQuery("#viewer.inApp").length) {

        window.miradorIniScroll = true ; 
        
        jQuery(window).scroll(function() {          
          console.log("scroll1?",window.miradorNoScroll);
          if( /* window.innerWidth < window.innerHeight ||*/ window.miradorNoScroll) return ;     
          _this.loadImages();
        });
        
        /*
        // DONE fix lazy loading in portrait mode
        jQuery("html,body").scroll(function() {     
          console.log("scroll2?",window.miradorNoScroll);
          if( window.innerWidth > window.innerHeight || window.miradorNoScroll) return ;
          _this.loadImages();
        });
        */

      } else {
        jQuery(_this.element).scroll(function() {
          _this.loadImages();
        });
      }

      _this.eventEmitter.publish('update_orientation');

      //add any other events that would trigger thumbnail display (resize, etc)

      _this.element.find('.thumbnail-image').on('click', function() {
        var canvasID = jQuery(this).attr('data-image-id');
        _this.eventEmitter.publish('SET_CURRENT_CANVAS_ID.' + _this.windowId, canvasID);
        _this.eventEmitter.publish('SET_PAGINATION.' + _this.windowId, jQuery(this).parent().find(".thumb-label").text());
      });

      /*
      jQuery(document).off("mouseup").on('mouseup',function() {
        //if(window.getSelection().toString().length) {

          console.log("docup:",_this,_this.element);
          jQuery(".scroll-view:not(.withMonlam) .scroll-listing-thumbs").find(".monlam-popup,.monlam-hilight").each( function(i,e) {
            console.log("i,e",i,e);
            var je = jQuery(e);
            //if(je.hasClass("init")) je.removeClass("init");
            //else 
            je.remove();
          });

        //}
      });
      */
      
      jQuery(window).resize(function() {        
        if(window.screen.width > 767 || window.currentZoom === undefined) {
          if(window.currentZoom) delete window.currentZoom;
          window.setZoom(0);
          window.setZoom(Z/100);
        }
      });


      jQuery(document).on("keydown", function (myEvent) {
   
        // function that verifies the detection
        myEvent = myEvent || window.event; // 'myEvent' is event object
        var key = myEvent.which || myEvent.keyCode; // this is to detect keyCode         
        // Detecting Ctrl
        var ctrl = myEvent.ctrlKey ? myEvent.ctrlKey : ((key === 17) ? true : false);
        
        if (key == 67 && ctrl && window.monlamAPI && window.monlamAPI.selection) {         
           navigator.clipboard.writeText(window.monlamAPI.selection);
           console.log("copied:",window.monlamAPI.selection);
        }
     });
      
    },

    toggle: function(stateValue) {
      if (stateValue) {
        this.show();
      } else {
        this.hide();
      }
    },

    loadImages: function() {
      var _this = this, ref; //, sav = window.miradorBookmark ;
      if(window.miradorBookmark) delete window.miradorBookmark ;
      var selector = ".mirador-viewer .scroll-view" ;
      if(!_this.element.hasClass("scroll-view")) selector = ".mirador-viewer .panel-thumbnail-view" ;
      // DONE can't use _this.element after switching volume in collection view...      
      jQuery.each(jQuery(selector) /*_this.element*/.find("ul img"), function(key, value) {
        var jmg = jQuery(value);
        
        if(!window.miradorBookmark || !window.miradorBookmark.length) { 
          if($.isOnScreen(value)) {
            var bbox = value.getBoundingClientRect();
            if(bbox.top > 0 && bbox.bottom < window.innerHeight || 
               bbox.top < 0 && bbox.bottom / window.innerHeight > 0.5 || 
               bbox.bottom > window.innerHeight && bbox.top / window.innerHeight < 0.5
              ) {
              window.miradorBookmark = jmg ;
              //console.log("onScr:",window.miradorBookmark.attr("data-image-id"),jQuery(window).scrollTop(),window.miradorBookmark.offset().top);
            } 
          }
        }
        
        //console.log("img?",key,$.isOnScreen(value, _this.lazyLoadingFactor));        

        if ($.isOnScreen(value, _this.lazyLoadingFactor) && (!jmg.attr("src") || jmg.hasClass("etext-pending"))) {          
          setTimeout(function() {
            //console.log("ONSCREEN...",key);
            if ($.isOnScreen(value, _this.lazyLoadingFactor) && (!jmg.attr("src") || jmg.hasClass("etext-pending"))) {              
              //console.log("ONSCREEN",window.MiradorUseEtext,key,_this.imagePromise[jQuery(value).attr("data")]);
              var url = jmg.attr("data");
              if(!_this.imagePromise[url]) {
                //console.log("RELOAD", key);
                _this.loadImage(value, url, ref);            
              } else {
                // DONE fix images disappearing on resize 
                jmg.attr("src",url); 
                // DONE fix rendering first pages of etext 
                if(window.MiradorUseEtext == "open") _this.loadImage(value, url, ref);            
              }
            }
          }, 650);
        } 
        /*
        else {
          if(key < 20) console.log("not on screen",key,value);
        }
        */
        ref = value;
      });
      /*
      if(sav && (!window.miradorBookmark || !window.miradorBookmark.length)) {
        console.warn("no bookM...",sav);
        window.miradorBookmark = sav ;
      }
      */
    },


    callMonlam: function(ev, el, _this, fromPopup){
      console.log("go:");
      jQuery(".scroll-view").addClass("withMonlam");
      ev.preventDefault();
      ev.stopPropagation();
            
      setTimeout(function(){
        var hi = el.find(".monlam-hilight")[0];
        if(hi) hi.scrollIntoView({behavior:"smooth",block:"center",inline:"center"});
        if(fromPopup) ev.currentTarget.remove();
        if(!jQuery(".scroll-view~.monlamResults").length) jQuery(".scroll-view").parent().append("<div class='monlamResults'></div>");
        jQuery(".scroll-view~.monlamResults").html("<div class='loading'><img src='/scripts/mirador/images/spinner.gif'/></div>");
        
        //if(!_this.monlamPS) _this.monlamPS = new PerfectScrollbar(".monlamResults");

        var title = "<h2><a href='https://monlamdic.com' title='monlamdic.com' target='_blank' rel='noopener noreferrer'><img width='32' src='/icons/monlam.png'/></a><a href='https://monlamdic.com' title='monlamdic.com' target='_blank' rel='noopener noreferrer'>"+i18next.t("monlamTitle")+"</a><a href='https://monlamdic.com' title='monlamdic.com' target='_blank' rel='noopener noreferrer'><img width='32' src='/icons/monlam.png'/></a></h2>";

        var closeCode = 'jQuery(".scroll-view").removeClass("withMonlam");jQuery(".scroll-view~.monlamResults").remove();jQuery(document).find(".monlam-hilight,.monlam-popup").remove();';
        var close = "<span class='X' onclick='"+closeCode+"'></span>";

        jQuery.ajax({
          url: 'https://ldspdi.bdrc.io/lexicography/entriesForChunk?chunk="'+encodeURIComponent(window.monlamAPI.chunk)+
            '"&cursor_start='+window.monlamAPI.cursor_start+
            '&cursor_end='+window.monlamAPI.cursor_end+
            '&lang='+window.monlamAPI.lang,
          type: 'GET',
          dataType: 'json',
          success: function(val){
            console.log("monlam val:",val);
            var res = "" ;
            if(val && val.length) { 

              var renderMonlamResults = function(val) {
                var res = jQuery("<div class='tabPanel'></div>") ;
                for(var i in val) {
                  var w = val[i], words = [], defs = [], kws = [] ;
                    
                  //if(! (w.type == "e" || w.type == "c") ) continue ;

                  var word = _this.labelToString([ w.word ], words, undefined, undefined, true);
                  var def = w.def; //_this.labelToString([ w.def ], defs);
                  var kw = _this.labelToString([{ value:window.monlamAPI.selection, lang: window.monlamAPI.lang }], kws, undefined, undefined, true);                                        
                  //console.log("w:",i,w,words,defs,kws);                                        
                  if(kws && kws.length && kws[0].value) kw = kws[0].value ;
                  else kw = window.monlamAPI.selection ;
                  kw = kw.replace(/(^[ ་།/]+)|([ ་།/]+$)/g, "");
                  var kwLayout = "", lang ;
                  if(words && words.length && words[0].value) { 
                    lang = words[0].lang ;
                    if(words[0].value.indexOf("↦") == -1) { 
                      var arr = words[0].value.split(kw);
                      for(var j in arr) {
                        var v = arr[j] ; 
                        if(j > 0) kwLayout += '<span class="kw">'+kw+'</span>';
                        kwLayout += '<span>'+v+'</span>';
                      }
                    } else {
                      kwLayout = words[0].value.replace(/\[?↦\]?([^↤]+?)\[?↤\]?/g,"<span class='kw'>$1</span>");
                    }
                  }
                  var defStyled = [], hasCollapsible = false;
                  defs = def.value.split(/[\r\n]+/);
                  for(var k in defs) {
                    var d = defs[k];
                    if(!d) continue ;
                    d = window.addMonlamStyle(d);
                    d = _this.labelToString([ {value:d, lang: "bo" }], undefined, undefined, undefined, true);
                    defStyled.push(d.replace(/((>) *\] *)|( *\[ *(<))/g,"$2 $4"));
                    if(hasCollapsible) defStyled.push("</div></div>");
                    hasCollapsible = d.indexOf("dhtmlgoodies_answer") != -1 ;
                    //if(!hasCollapsible) defStyled.push("</span>");
                  }
                  defStyled = defStyled.join("");
                  res.append('<div class="def">'+
                      '<b lang="'+lang+'"'+(val.length == 1 ? 'class="on"':'')+'>'+
                        '<span>'+kwLayout+'</span><i class="fa fa-chevron-right" aria-hidden="true"></i>'+
                      '</b>'+
                      '<div><div><div>'+ defStyled + '</div></div></div>'+
                  '</div>');
                }
                return res;                
              };

              var selec = -1;
              var val1 = val.filter(function(r){ return r.type == "e" || r.type == "c"; }), r1 = renderMonlamResults(val1);
              if(val1.length) selec = 0;
              var val2 = val.filter(function(r){ return r.type == "k" ; }), r2 = renderMonlamResults(val2);
              if(selec == -1 && val2.length) selec = 1;
              var val3 = val.filter(function(r){ return r.type == "d" ; }), r3 = renderMonlamResults(val3);
              if(selec == -1 && val3.length) selec = 2;
              res = "<li class='tab "+(selec==0?"on":"")+"' "+(!val1.length?"disabled":"")+">"+i18next.t("monlamExact",  {count:val1.length})+"</li><div>" + r1.html() + "</div>" +
                    "<li class='tab "+(selec==1?"on":"")+"' "+(!val2.length?"disabled":"")+">"+i18next.t("monlamContain",{count:val2.length})+"</li><div>" + r2.html() + "</div>" +
                    "<li class='tab "+(selec==2?"on":"")+"' "+(!val3.length?"disabled":"")+">"+i18next.t("monlamDef",    {count:val3.length})+"</li><div>" + r3.html() + "</div>";
              

            } else {
              res = "<div class='monlam-no-result'>Nothing found for \"<span>"+window.monlamAPI.selection+"</span>\".</div>";
            }
            if(res) {
              jQuery(".scroll-view~.monlamResults").html("<div>"+close+title+res+"</div>").find(".def b").click(function(ev){
                var el = jQuery(ev.currentTarget);
                el.toggleClass("on");
              }).closest(".monlamResults").find("li.tab").click(function(ev){
                var el = jQuery(ev.currentTarget);
                el.toggleClass("on");
              });
              jQuery(".scroll-view~.monlamResults .dhtmlgoodies_question.collapsible").off("click").on("click",function(ev) {
                jQuery(ev.currentTarget).toggleClass("on");
              });
              //setTimeout(function(){ _this.monlamPS.update(); }, 10);
            }
          },
          error: function(err){
            console.error("monlam err:",err);
            var res = "<div class='monlam-no-result'>Nothing found for \"<span>"+window.monlamAPI.selection+"</span>\".</div>";
            jQuery(".scroll-view~.monlamResults").html("<div>"+close+title+res+"</div>");
          }
        });

      }, 150);                                
    },

    loadImage: function(imageElement, url, ref) {
      var _this = this,
        imelem = jQuery(imageElement),
        id = imelem.attr("data-image-id"),
        canvas = _this.imagesList.filter(function(e) { return e["@id"] === id; }),
        imagePromise = $.createImagePromise(url),
        degrees = getCanvasRotation(canvas);

      if(degrees) {

        if(degrees == 180) {
          imelem.css({ transform:"rotate("+degrees+"deg)" });
        }
        else if(degrees == 90 || degrees == 270) {
          var w = Number(imelem.attr("width")), h = Number(imelem.attr("height")), trOri = "100% 0", mL = "calc(("+w+"px - "+h+"px) / 2)", mT ;

          if(_this.element.hasClass("scroll-view")) {
            if(degrees == 270) { trOri = "0 0" ; mL = "calc(("+w+"px - "+h+"px) / -2)"; } 
            if(w < h) {
              imelem
              .addClass("rotate90")
              .css({ position:"absolute", transform:"rotate("+degrees+"deg)", "transform-origin": trOri, "max-width": h, "min-height": 0, width:h, height:w, "margin-left": mL  })
              .parent()
              .css({ "padding-top":(h)+"px" })
              ;
            } else {
              mL = (w-h) ;
              if(degrees == 270) mL = 0;
              imelem
              .addClass("rotate90")
              .css({ position:"absolute", transform:"rotate("+degrees+"deg)", "transform-origin": trOri, "max-width": h, "min-height": 0, width: h, height: w, "margin-left":mL  })
              .parent()
              .css({ "padding-top":(h)+"px", width: w+"px"})
              ;
            }
          } else {
            var ratio = imelem.attr("data-ratio");
            if(!ratio && canvas && canvas.length) ratio = canvas[0].width / canvas[0].height ;              
            if(ratio < 1) { w = 180; h = w * ratio ; mL = "calc(("+w+"px - "+h+"px) /-2)"; }
            else { h = 180 ; w = h / ratio ; trOri = "0 0" ; mL = h ; mT = -w ; }
            if(degrees == 270) { trOri = "0 0" ; mL = h ; mT = 0 ;
              if(w < h) mL = 0;
            }
            imelem
              .addClass("rotate90")
              .css({ position:"absolute", transform:"rotate("+degrees+"deg)", "min-height": 0, width: w, height: h, "transform-origin": trOri, "margin-left": mL, "margin-top":mT })
              .parent()
              .css({ "padding-top":(w)+"px" })
              ;
          }

          /* // v1 with incorrect w/h in manifest
          if(w > h) {
            imelem
            .css({ position:"absolute", transform:"rotate("+degrees+"deg)", "margin-top":(h-w-30)+"px"})
            .parent()
            .css({ "padding-top":(w+40)+"px", width: w+"px" });
          } else {
            imelem
            .css({ position:"absolute", transform:"rotate("+degrees+"deg)", "transform-origin": "100% 50%", "top":(h-w-60)/2+"px" })
            .parent()
            .css({ "padding-top":(w+20)+"px" });
          }
          */
        }
      }

      _this.imagePromise[url] = imagePromise ;

      var dash = i18next.t("_dash");
  
      /* // surprisingly not changing anything ... 
      imagePromise.fail(function() {
        imageElement.src = "missing";
      });
      */

      if(url.indexOf("static::error-copyright") == -1) 
        imelem.on("load",function() {
          var ratio = imageElement.naturalWidth / imageElement.naturalHeight;
          //console.log("im:",ratio,imageElement.naturalWidth,imageElement.naturalHeight,imelem.attr("data-ratio"));
          if(ratio != imelem.attr("data-ratio") && !imelem.hasClass("rotate90")) {
            imelem
            .attr({"data-ratio":ratio}) //,"width":imageElement.naturalWidth,"height":imageElement.naturalHeight})
            .css("min-height",(imelem.width() / ratio)+"px");
          }
        });


      imagePromise.done(function(image) {

        imageElement.src = image ;

        //console.log("canvas:",canvas,degrees);

        //_this.setThumbLabel(canvas, imageElement, dash);        

        setTimeout(function() { if(_this.ps) _this.ps.update(); }, 10);

        var showET = window.MiradorUseEtext ;

        if(showET) {
         

          if(canvas.length) { //} && jQuery(imageElement).isInViewport()) {

              var etc = jQuery(imageElement).next('.etext-content');
              etc.addClass(showET!="open"?"hide":"").html("<div class='pad'></div><div>...</div><div class='pad'></div>");
              imelem.addClass("etext-pending");
              if(window.currentZoom) {
                var h0 = etc.height();
                var p = etc.attr("data-h0",h0).find("div:not(.pad,.monlam-popup,.monlam-hilight)");
                var h = p.innerHeight();
                p.attr("data-h",h).css({"transform":"scale("+1/window.currentZoom+")"});
                etc.find(".pad").height(30 / window.currentZoom + 0.5 * (h / window.currentZoom - h0));
              }
              var prom = _this.updateGetEtextPage(canvas[0]);              
              if(!prom) imelem.removeClass("etext-pending").next('.etext-content').text("");
              else prom.then(function(val) {                
                
                //console.log("val:",canvas[0].label[0],JSON.stringify(val,null,3));
                
                imelem.removeClass("etext-pending");

                try { 


                  var labelArray = [],
                      txt = "",
                      css = "loaded " ;

                  //var checkB = jQuery('#showEtext') ;
                  //if(!checkB || !checkB.get(0).checked) css += "hide " ;
                  if(!showET) css += "hide " ;

                  if(val) { 

                    for(var i in val) {
                      txt += val[i]["@value"] ; //_this.labelToString([ val[i] ], labelArray);
                    }

                    //if(labelArray[0] && labelArray[0]["@language"] === "bo") 
                    var lang = "bo-x-ewts" ;
                    if(val.filter(function(v){return v["@language"]=='bo';}).length && $.guessTibtFromRange(txt)) { //!txt.match(/[a-z]/)) 
                      css += "loaded-bo " ;
                      lang = "bo" ;
                    }

                    if(!txt.match(/[\n\r]/)) 
                      css += "unformated " ;                  

                    jQuery(imageElement).next('.etext-content').addClass(css).html("<div class='pad'></div><div class='monlam-selec'><span>"+txt+"</span></div><div class='pad'></div>")
                    .find(".monlam-selec span").on("mouseup", function(ev){
                      var selection = window.getSelection();
                      if(selection.rangeCount) {
                        window.monlamRange = selection.getRangeAt(0);                        
                        console.log("range:",window.monlamRange);
                      }
                      console.log("up:",selection.toString(),selection,ev);
                      var el = jQuery(ev.currentTarget);
                      var scrollElem = ev.currentTarget.closest(".monlam-selec");
                      var decalH = scrollElem.getBoundingClientRect();
                      var decalP = ev.currentTarget.closest(".etext-content").getBoundingClientRect();
                      jQuery(document).find(".monlam-hilight,.monlam-popup").remove();
                      setTimeout(function() {
                        var selection = window.getSelection();                        
                        console.log("sel:",selection.rangeCount,selection.anchorOffset,selection.focusOffset);
                        // #800
                        if (!selection.rangeCount /*|| selection.anchorOffset == selection.focusOffset*/ || !jQuery(".view-nav .monlam #check.on").length) { 
                          jQuery(".scroll-view").removeClass("withMonlam");
                          jQuery(".scroll-view~.monlamResults").remove();
                          //if(window.monlamRange) delete window.monlamRange ;
                          return ;
                        }
                        var range = selection.getRangeAt(0);
                        if(range) {
                          if(selection.toString().length) {
                            var MAX_SELECTION_LENGTH = 120;
                            var MIN_CONTEXT_LENGTH = 40;
                            var start = Math.min(selection.anchorOffset,selection.focusOffset);
                            var end = Math.max(selection.anchorOffset,selection.focusOffset);
                            var invert = selection.anchorOffset > selection.focusOffset;
                            if(end > start + MAX_SELECTION_LENGTH) { 
                              try {
                                if(!invert) {
                                    end = start + MAX_SELECTION_LENGTH;
                                    range.setEnd(range.startContainer, range.startOffset + MAX_SELECTION_LENGTH);
                                } else {
                                    start = end - MAX_SELECTION_LENGTH;
                                    range.setStart(range.endContainer, range.endOffset - MAX_SELECTION_LENGTH);
                                }
                              } catch(err) {                  
                                console.warn("can't update range", start, end, range, selection);
                                selection.removeAllRanges();
                                return;
                              }
                            }
                            var startOff = Math.max(0, start - MIN_CONTEXT_LENGTH);
                            var endOff = Math.min(el.text().length, end + MIN_CONTEXT_LENGTH);
                            var chunk = el.text().substring(startOff, endOff).replace(/[\r\n]/g," ");
                            start = chunk.indexOf(selection.toString().replace(/[\r\n]/g," "));
                            window.monlamAPI = { chunk: chunk, cursor_start: start, cursor_end:start+selection.toString().replace(/[\r\n]/g," ").length, selection: selection.toString(), lang: lang };
                            var coords = Array.from(range.getClientRects());
                            console.log("coords:",coords,window.monlamAPI);


                            
                            if(!jQuery(".withMonlam ~ .monlamResults").length) el.parent().parent().append("<div class='monlam-popup init' style='border-radius:"+4*(1/window.currentZoom)+"px;line-height:"+18*(1/window.currentZoom)+"px;padding:"+12*(1/window.currentZoom)+"px;font-size:"+15.5*(1/window.currentZoom)+"px;margin-left:"+((1/window.currentZoom) * 13.25)+"px;top:"+((1/window.currentZoom)*(coords[0].top-decalP.top-57))+"px;left:"+((1/window.currentZoom)*(coords[0].left-decalP.left-13))+"px'><img style='width:"+32*(1/window.currentZoom)+"px;padding-right:"+10*(1/window.currentZoom)+"px;' src='/icons/monlam.png'/><span>"+i18next.t("find")+"&nbsp;</span></div>")                          
                                .parent().find(".monlam-popup").on("mousedown",function(ev){ _this.callMonlam(ev, el, _this, true); });
                            else _this.callMonlam(ev, el, _this); 
                            
                            

                            coords.map(function(c){ 
                              el.append("<div class='monlam-hilight' style='scroll-margin:0;width:"+c.width+"px;height:"+c.height+"px;top:"+(c.top-decalH.top+scrollElem.scrollTop)+"px;left:"+(c.left-decalH.left+scrollElem.scrollLeft)+"px;position:absolute;background:rgba(252,224,141,0.65);padding:0;margin:0;box-shadow:none;mix-blend-mode:darken;'></div>"); 
                              //el.parent().parent().append("<div class='monlam-hilight' style='scroll-margin:50px;width:"+(1/window.currentZoom)*c.width+"px;height:"+(1/window.currentZoom)*c.height+"px;top:"+(1/window.currentZoom)*(c.top-decalP.top)+"px;left:"+(1/window.currentZoom)*(c.left-decalP.left)+"px;position:absolute;background:rgba(0,153,255,0.35);padding:0;margin:0;box-shadow:none;'></div>"); 
                            });
                            selection.removeAllRanges();

                            console.log("decal:",decalH,decalP,scrollElem.scrollLeft);
                          }
                        }                        
                      }, 150);
                    });
                    /*
                    .on("mousedown", function(ev){
                      console.log("down:",ev);
                      var el = jQuery(ev.currentTarget);
                      el.parent().find(".monlam-hilight,.monlam-popup").remove();
                    }) ;                       
                    */
                  } 
                  else { 
                    jQuery(imageElement).next('.etext-content').addClass(css).html("<div class='pad'></div><div>--</div><div class='pad'></div>"); 
                  }
                  if(window.currentZoom) {
                    var h0 = etc.height();
                    var p = etc.attr("data-h0",h0).find("div:not(.pad,.monlam-popup,.monlam-hilight)");
                    var h = p.innerHeight();
                    p.attr("data-h",h).css({"transform":"scale("+1/window.currentZoom+")", "max-width":"calc(95% * "+window.currentZoom+")" });
                    etc.find(".pad").height(30 / window.currentZoom + 0.5 * (h / window.currentZoom - h0));
                  }
                }
                catch(e){ 
                  console.error("ERROR fetching etext data",canvas,val); 
                  jQuery(imageElement).next('.etext-content').text("");
                }
              }) ;
          }
        }
      });
    },

    reloadImages: function(newThumbHeight, triggerShow, useThumbnailProperty) {
      var _this = this;
      this.thumbInfo.thumbsHeight = newThumbHeight;
      if(useThumbnailProperty == undefined) useThumbnailProperty = true ;

      jQuery.each(this.imagesList, function(index, image) {
        var aspectRatio = image.height/image.width,
        width = (_this.thumbInfo.thumbsHeight/aspectRatio),
        height = _this.thumbInfo.thumbsHeight,
        id = image['@id'];      

        //console.log("reload:",image,width,height,image.width,image.height,_this.thumbInfo.thumbsHeight);

        width = image.width;
        height = width * aspectRatio;


        var newThumbURL = $.getThumbnailForCanvas(image, width, useThumbnailProperty);        
        var imageElement = _this.element.find('img[data-image-id="'+id+'"]');
        imageElement.attr('data', newThumbURL).attr('height', image.height).attr('width', image.width).attr('src', '');
      });
      if (triggerShow) {
        this.show();
      }
    },

    template:  $.Handlebars.compile([
        '<div class="{{thumbnailCls}}">',
        '<ul class="{{listingCssCls}}" role="list" aria-label="Thumbnails">',
        '{{#thumbs}}',
        '<li class="{{highlight}}" role="listitem" aria-label="Thumbnail">',
        '<img class="thumbnail-image {{highlight}}" data-image-id="{{id}}" src="" data="{{thumbUrl}}" width="{{width}}" style="min-height:{{height}}px;">',
        '<div class="thumb-label" lang={{lang}}>{{title}}</div>',
        '</li>',
        '{{/thumbs}}',
        '</ul>',
        '</div>'
    ].join('')),

    hide: function() {
      var element = jQuery(this.element);
      if (this.panel) {
        element = element.parent();
      }
      element.hide({effect: "fade", duration: 300, easing: "easeOutCubic"});
    },

    show: function() {
      var element = jQuery(this.element);
      if (this.panel) {
        element = element.parent();
      }
      var _this = this;
      element.show({
        effect: "fade",
        duration: 300,
        easing: "easeInCubic",
        complete: function() {
          // Under firefox $.show() used under display:none iframe does not change the display.
          // This is workaround for https://github.com/IIIF/mirador/issues/929
          jQuery(this).css('display', 'block');
          _this.loadImages();
        }
      });
    },

    adjustWidth: function(className, hasClass) {
      var _this = this;
      if (hasClass) {
        _this.eventEmitter.publish('REMOVE_CLASS.'+this.windowId, className);
      } else {
        _this.eventEmitter.publish('ADD_CLASS.'+this.windowId, className);
      }
    },

    adjustHeight: function(className, hasClass) {
      if (hasClass) {
        this.element.removeClass(className);
      } else {
        this.element.addClass(className);
      }
    }

  };



}(Mirador));
