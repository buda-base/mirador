
function getService(resource) {
  var service ;
  if(resource.full) service = resource.full.service ;
  else if(resource.default) service = source.default.service ;
  else service = resource.service;
  if(!service) throw new Error("no IIIf service found in:\n"+JSON.stringify(resource,null,3));
  return service;
}

(function($) {

  $.trimString = function(str) {
    return str.replace(/^\s+|\s+$/g, '');
  };

  /* --------------------------------------------------------------------------
     Methods related to manifest data
     -------------------------------------------------------------------------- */

  $.getImageIndexById = function(imagesList, id) {
    var imgIndex = 0;

    jQuery.each(imagesList, function(index, img) {
      if ($.trimString(img['@id']) === $.trimString(id)) {
        imgIndex = index;
      }
    });

    return imgIndex;
  };

  $.getThumbnailForCanvas = function(canvas, width, useThumbnailProperty) {
    var version = "1.1",
    compliance = -1,
    service,
    thumbnailUrl;
    if(useThumbnailProperty == undefined) useThumbnailProperty = true ;

    // Ensure width is an integer...
    width = parseInt(width, 10);

    // Respecting the Model...
    if (useThumbnailProperty && canvas.hasOwnProperty('thumbnail')) {
      // use the thumbnail image, prefer via a service
      if (typeof(canvas.thumbnail) == 'string') {
        thumbnailUrl = canvas.thumbnail;
      } else if (canvas.thumbnail.hasOwnProperty('service')) {
        service = canvas.thumbnail.service;
        if(service.hasOwnProperty('profile')) {
            compliance = $.Iiif.getComplianceLevelFromProfile(service.profile);
        }
        if(compliance === 0){
            // don't change existing behaviour unless compliance is explicitly 0
            thumbnailUrl = canvas.thumbnail['@id'];
        } else {
            // Get the IIIF Image API via the @context
            if (service.hasOwnProperty('@context')) {
                version = $.Iiif.getVersionFromContext(service['@context']);
            }
            thumbnailUrl = $.Iiif.makeUriWithWidth(service, width, version);
        }
      } else {
        thumbnailUrl = canvas.thumbnail['@id'];
      }
    } else {
      // No thumbnail, use main image
      var resource ;
      if(canvas.images) {
        resource = canvas.images[0].resource;
        service = getService(resource);
        if (service.hasOwnProperty('@context')) {
          version = $.Iiif.getVersionFromContext(service['@context']);
        }
        var cl = $.Iiif.getComplianceLevelFromProfile(service.profile),w,h; 
        if (cl == 0  && service.width && width > 200) {          
          w = Number(service.width); 
          h = Number(service.height);
          if(w > h) {
            // fix for very big images like bdr:I1CZ5005
            if(w < 3500) thumbnailUrl = $.Iiif.makeUriWithWidth(service, "max", version); 
            else thumbnailUrl = $.Iiif.makeUriWithWidth(service, 3500, version);
          } else {
            // fix for loading big portrait images 
            if(h < 2500) thumbnailUrl = $.Iiif.makeUriWithWidth(service, "max", version); 
            else thumbnailUrl = $.Iiif.makeUriWithWidth(service, Math.round(2000 * w/h), version);
          }
        } else {
          // same for Taisho case
          w = Number(canvas.width); 
          h = Number(canvas.height);
          if(w > h) width = Math.min(w,3500);
          else if(h < 2500) width = w;
          else width = Math.round(2000 * w/h);
          thumbnailUrl = $.Iiif.makeUriWithWidth(service, width, version);
        }
      } 
    }
    return thumbnailUrl;
  };

  /*
     miscellaneous utilities
     */

  $.getQueryParams = function(url) {
    var assoc  = {};
    var decode = function (s) { return decodeURIComponent(s.replace(/\+/g, " ")); };
    var queryString = url.split('?')[1];
    if (typeof queryString === "undefined") {
      return {};
    }
    var keyValues = queryString.split('&');

    for(var i in keyValues) {
      var key = keyValues[i].split('=');
      if (key.length > 1) {
        assoc[decode(key[0])] = decode(key[1]);
      }
    }

    return assoc;
  };

  $.genUUID = function() {
    var idNum = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });

    return idNum;
  };

  jQuery.fn.slideFadeToggle  = function(speed, easing, callback) {
    return this.animate({opacity: 'toggle', height: 'toggle'}, speed, easing, callback);
  };

  $.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;

    if (typeof options !== 'undefined') {
      options = {};
    }

    var later = function() {
      previous = options.leading === false ? 0 : new Date();
      timeout = null;
      result = func.apply(context, args);
    };
    return function() {
      var now = new Date();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  $.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;
    return function() {
      context = this;
      args = arguments;
      timestamp = new Date();
      var later = function() {
        var last = (new Date()) - timestamp;
        if (last < wait) {
          timeout = setTimeout(later, wait - last);
        } else {
          timeout = null;
          if (!immediate) result = func.apply(context, args);
        }
      };
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) result = func.apply(context, args);
      return result;
    };
  };


  var nativeranges = [
    {"range": [0x0F00, 0x0FFF], "lt": "tibt"},
  ];

  $.guessTibtFromRange = function(str) {
    var i, cp ;
    var nl = nativeranges[0];
    for(i = 0 ; i < str.length ; i++) {
      cp = str.codePointAt(i);
      if (cp > nl.range[0] && cp < nl.range[1]) {
        return true;
      }
    }
    return false;
  };

  // http://upshots.org/javascript/jquery-test-if-element-is-in-viewport-visible-on-screen
  $.isOnScreen = function(elem, outsideViewportFactor, container) {
    var factor = 1;
    if (outsideViewportFactor) {
      factor = outsideViewportFactor;
    }
    var win = jQuery(window);
    //if(container) win = container ;
    //if(!win.scrollTop()) win = jQuery("html,body");
    //if(!win.scrollTop()) win = jQuery("body");
    var viewport = {
      top : win.scrollTop(), //* factor),
      left : (win.scrollLeft() * factor)
    };
    viewport.bottom = viewport.top + (win.outerHeight()) * factor;
    viewport.right = (viewport.left + win.outerWidth()) * factor;

    var el = jQuery(elem);
    var bounds = el.offset(), dim = el[0].getBoundingClientRect();
    bounds.bottom = bounds.top + dim.height;
    bounds.right = bounds.left + dim.width;

    var valid = (bounds.left != 0 && bounds.right != bounds.left) ;

    var ret = valid && (!(viewport.right < bounds.left || viewport.left > bounds.right || viewport.bottom < bounds.top || viewport.top > bounds.bottom));

    //if(ret) 
    //  console.log("vp",ret,elem.style.cssText,JSON.stringify(bounds),JSON.stringify(viewport));
    
    return ret ;

  };

  $.getRangeIDByCanvasID = function(structures, canvasID /*, [given parent range] (for multiple ranges, later) */) {
    var ranges = jQuery.grep(structures, function(range) { return jQuery.inArray(canvasID, range.canvases) > -1; }),
    rangeIDs = jQuery.map(ranges,  function(range) { return range['@id']; });

    return rangeIDs;
  };

  $.layoutDescriptionFromGridString = function (gridString) {
    var columns = parseInt(gridString.substring(gridString.indexOf("x") + 1, gridString.length),10),
    rowsPerColumn = parseInt(gridString.substring(0, gridString.indexOf("x")),10),
    layoutDescription = {
      type:'row'
    };

    if (gridString === "1x1") return layoutDescription;

    layoutDescription.children = [];

    // Javascript does not have range expansions quite yet,
    // long live the humble for loop.
    // Use a closure to contain the column and row variables.
    for (var i = 0, c = columns; i < c; i++) {
      var column = { type: 'column'};

      if (rowsPerColumn > 1) {
        column.children = [];
        for (var j = 0, r = rowsPerColumn; j < r; j++) {
          column.children.push({
            type: 'row'
          });
        }
      }

      layoutDescription.children.push(column);
    }

    return layoutDescription;
  };

  // Configurable Promises
  $.createImagePromise = function(imageUrl) {
    var img = new Image(),
    dfd = jQuery.Deferred();

    img.onload = function() {
      dfd.resolve(img.src);
    };

    img.onerror = function() {
      dfd.reject(img.src);
    };

    dfd.fail(function() {
      console.log('image failed to load: ' + img.src);      
      dfd.resolve("failed");
    });

    img.src = imageUrl;
    return dfd.promise();
  };

  $.enterFullscreen = function(el) {
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  };

  $.exitFullscreen = function() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  };

  $.isFullscreen = function() {
    var fullscreen = $.fullscreenElement();
    return (fullscreen.length > 0);
  };

  $.fullscreenElement = function() {
    return (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement);
  };

  $.sanitizeHtml = function(dirty) {
    return sanitizeHtml(dirty, {
      allowedTags: ['a', 'b', 'br', 'i', 'img', 'p', 'span', 'strong', 'em', 'ul', 'ol', 'li'],
      allowedAttributes: {
        'a': ['href', 'target'],
        'img': ['src', 'alt'],
        'p': ['dir']
      }
    });
  };

  $.handlePDFdownload = function(render, clickable, elemSelec) {

    var defaultRange = render[0]["@id"].replace(/^.*?([-0-9]+)$/,"$1");

    var reinit = function(elem,value) {
      elem.find(".fa-close").click(function(ev){ 
        var elem = jQuery(ev.currentTarget).closest("[data-init]");
        var t = value.indexOf("pdf") != -1 ? "pdf" : "zip";
        elem.attr("data-init",1).attr("data-value",value)
          .html("<a>"+i18next.t("full")+"</a> " +
            i18next.t("or")+" "+i18next.t("range")[0].toUpperCase()+i18next.t("range").substring(1)+":<input type='text' value='"+defaultRange+"'/><button>ok</button><a data-range='"+defaultRange+"'></a><i class='fa fa-close'></i>");
        elem.find("input").on("keypress",function(ev) { if(ev.key == "Enter") getRange(ev); });
        elem.find("button").click(function(ev) { getRange(ev); });
        elem.find(".fa-close").click(function(ev){
            var elem = jQuery(ev.currentTarget).closest("[data-init]");
            var t = value.indexOf("pdf") != -1 ? "pdf" : "zip";
            elem.attr("data-init",0).text(i18next.t("get" + (t == "pdf"?"PDF":"ZIP")));
            ev.stopPropagation();  
        });   
        ev.stopPropagation();        
      });                               
    };

    var pdfTimer = {} ;
    var updatePdfPercent = function(elem,headers,value,range){
      if(!range) range = defaultRange;

      var ok = range.match(/^([0-9]*)-([0-9]*)$/);
      if(!(range != "-" && ok && (ok[1] != '' && ok[2] != '' && Number(ok[1]) <= Number(ok[2]) || ok[1] === '' && ok[2] !== '' || ok[1] !== '' && ok[2] === ''))) {
        if(pdfTimer[value]) clearInterval(pdfTimer[value]);
        elem.html("Incorrect image range: "+range+"<i class='fa fa-close'></i>");
        reinit(elem,value);
        return;
      } 

      var request = jQuery.ajax({
        url: value.replace(/[-0-9]+$/,range),
        dataType:'json',
        async: true,
        headers: headers
      });

      request.error(function(jsonLd) {
        if(pdfTimer[value]) clearInterval(pdfTimer[value]);
        console.log("error:",jsonLd,elem);
        if([401].includes(jsonLd.status)) { 
          elem.parent().addClass("login").html(i18next.t("mustLogin")).click(function() {
            window.location.href = 
              window.location.href.replace(/^(https?:\/\/[^/]+).*/,"$1/login?backToViewer="+encodeURIComponent(window.location.href));
          });
        } else if([403].includes(jsonLd.status)){
          elem.html(i18next.t("dlError403")+"<i class='fa fa-close'></i>");
          reinit(elem,value);
        } else if([404].includes(jsonLd.status)){
          elem.html("Incorrect image range: "+range+"<i class='fa fa-close'></i>");
          reinit(elem,value);
        } else {
          elem.html("Server error (range: "+range+")<i class='fa fa-close'></i>");
          reinit(elem,value);
        }
      });

      request.done(function(jsonLd) {
        console.log("ajax:",jsonLd,elem,value);
        if(jsonLd.link) {
          if(pdfTimer[value]) clearInterval(pdfTimer[value]);
          elem.html("<a download target='_blank' href='"+//url.replace(/^(.*?bdrc.io).*/,"$1")
            jsonLd.link+"'>"+i18next.t("dl"+(value.indexOf("pdf") != -1 ? "PDF":"ZIP" ))+
            "</a><i class='fa fa-close'>");
          reinit(elem,value);
        } else if(jsonLd.percentdone != undefined)  {
          elem.text(elem.text().replace(/([0-9]+%)?$/, " "+jsonLd.percentdone+"%")) ;
        }
      });
    };
              
    var getRange = function(ev) {
      var elem = jQuery(ev.target).closest("[data-init]");
      var range = elem.find("input").val();
      console.log("ev:",ev, range);
      elem.find("[data-range]").attr("data-range",range).click();
    };

    clickable.click(function(event){

      var elem = jQuery(event.currentTarget).closest(elemSelec);            

      var headers, id_token, jwt, url ;

      if(elem.attr("data-value")) {
        url = elem.attr("data-value");
        var init = elem.attr("data-init");
        if(init == 0) {
          elem.attr("data-init",1)
            .html("<a>"+i18next.t("full")+"</a> " +
              i18next.t("or")+" "+i18next.t("range")[0].toUpperCase()+i18next.t("range").substring(1)+":<input type='text' value='"+defaultRange+"'/><button>ok</button><a data-range='"+defaultRange+"'></a><i class='fa fa-close'></i>");
          elem.find("input").on("keypress",function(ev) { if(ev.key == "Enter") getRange(ev); });
          elem.find("button").click(function(ev) { getRange(ev); });
          elem.find(".fa-close").click(function(ev){
            var elem = jQuery(ev.currentTarget).closest("[data-init]");
            var t = elem.attr("data-value").includes("pdf") ? "pdf" : "zip";
            console.log("fa:",elem,t);
            elem.attr("data-init",0).text(i18next.t("get" + (t == "pdf"?"PDF":"ZIP")));
            ev.stopPropagation();
          });                  
        } else if(url && event.target.tagName == "A") {
          var value = elem.attr("data-value");
          elem.removeAttr("data-value").text(i18next.t("gen"+(value.indexOf("pdf") != -1 ? "PDF":"ZIP" )));

          headers = {};
          id_token = localStorage.getItem('id_token');
          if(id_token && url && url.match(/[^?&]+[.]bdrc[.]io[/]/)) {
            jwt = parseJwt(id_token);
            if(jwt.exp && jwt.exp > Date.now() / 1000)
              headers = { "Authorization": "Bearer " + id_token } ; // TODO no need if manifest not from BDRC x is token valid ?
          }

          console.log("header:",headers);

          var range = defaultRange;
          if(!(range = jQuery(event.target).attr("data-range"))) range = defaultRange;
          pdfTimer[value] = setInterval(function() { updatePdfPercent(elem, headers, value, range); }, 3000);
          updatePdfPercent(elem, headers, value, range);
        }
        event.stopPropagation();
        event.preventDefault();
        return false;
      }
      else if(!elem.find("a").length) {
        event.stopPropagation();
        event.preventDefault();
        return false;
      } else if(elem.attr("data-source")){

        console.log("click",elem);

        if(elem.hasClass("checked")) {
          elem.removeClass("checked already error");
          return true;
        }

        event.stopPropagation();
        event.preventDefault();

        if(elem.hasClass("already")) return ;
        elem.addClass("already");

        //url = "https://iiif.bdrc.io/bdr:I0GN010020001::I0GN010020001002.jpg/full/1065,/0/default.jpg";  // test
        url = elem.attr("data-source");

        headers = {};
        id_token = localStorage.getItem('id_token');
        if(id_token && url && url.match(/[^?&]+[.]bdrc[.]io[/]/)) {
         jwt = parseJwt(id_token);
          if(jwt.exp && jwt.exp > Date.now() / 1000)
            headers = { "Authorization": "Bearer " + id_token } ; // TODO no need if manifest not from BDRC x is token valid ?
        }

        var xhr, request = jQuery.ajax({
          url: url,
          async: true,
          headers: headers,
          xhr:function(){
            xhr = new XMLHttpRequest();
            xhr.responseType= 'blob';
            return xhr;
          }
        });

        xhr.addEventListener("progress", function(val) {
          elem.addClass("checked");
          setTimeout(function() { 
            jQuery(".mirador-hud .view-nav .DL ul.select").toggleClass("on");
            elem.find("a").text(sav).get(0).click(); 
          }, 10); 
          request.abort();
        }, false);

        var sav = elem.text();
        elem.find("a").text(i18next.t("downloading"));

        /*
        request.done(function (response) {
          console.log("response:",response);

          var filename = url.split(/[\\\/]/).pop().replace(/[.]jpe?g$/i, ".tif"); // default
          var disposition = xhr.getResponseHeader('Content-Disposition');
          if (disposition && disposition.indexOf('attachment') !== -1) {
            var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            var matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) { 
              filename = matches[1].replace(/['"]/g, '');
            }
          }
          
          var temp = window.URL.createObjectURL(response);
          var link = document.createElement("a");
          link.href = temp;
          link.setAttribute("download", filename);    
          link.click();
          window.URL.revokeObjectURL(link);          
          
          jQuery(".mirador-hud .view-nav .DL ul.select").toggleClass("on");
          elem.find("a").text(sav);
          elem.removeClass("already error");
        });
        */

        request.error(function(jsonLd) {
          if(jsonLd.status == 0) return ; // case of abort
          if([401].includes(jsonLd.status)) {                                
            elem.parent().addClass("login").html(i18next.t("mustLogin")).click(function() {
              window.location.href = 
              window.location.href.replace(/^(https?:\/\/[^/]+).*/,"$1/login?backToViewer="+encodeURIComponent(window.location.href));
            });
          } else {
            elem.find("a").text("Server error ("+jsonLd.status+")");
          }
          elem.addClass("error").removeClass("already");
        });

        return false;
      }
    });
  };

}(Mirador));
