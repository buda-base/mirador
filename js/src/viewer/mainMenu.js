(function($) {

    $.MainMenu = function(options) {

        console.log("MM options?",options);

        jQuery.extend(true, this, {
            element:                    null,
            mainMenuHeight:             null,
            mainMenuWidth:              null,
            windowOptionsMenu:          null,
            loadWindow:                 null,
            clearLocalStorage:          '',
            viewerCls:                  'mirador-viewer',
            mainMenuBarCls:             'mirador-main-menu-bar',
            mainMenuCls:                'mirador-main-menu',
            windowOptionsMenuCls:       'mirador-window-options-menu',
            clearLocalStorageCls:       'clear-local-storage',
            clearLocalStorageDialogCls: 'mirador-main-menu-clear-local-storage',
            collectionsListingCls:      'mirador-listing-collections',
            state:                      null,
            eventEmitter:               null,
            resID:                      null
        }, options);

        this.element  = this.element || jQuery('<div/>');

        this.init();

    };


    $.MainMenu.prototype = {

        init: function() {

            // TODO use "responsive" flag to work in library as well
            var urlParams = new URLSearchParams(window.location.search), origin = urlParams.get("origin"), inApp;
            var force = "";
            if(window.innerWidth < 800 || origin) {
              if(window.innerWidth < 800 || origin.startsWith("BDRCLibApp")) inApp = true ;
              if(origin) { 
                if(origin.startsWith("BDRCLibApp")) force = "off" ;
                else force = "forced" ;
              }
              jQuery('<div class="mobile-button top '+force+'"><img src="/icons/burger.svg"/><i class="fa fa-arrow-left" aria-hidden="true"></i></div>')
              .appendTo(this.appendTo);
            }


            //this.mainMenuHeight = this.parent.mainMenuSettings.height;
            //this.mainMenuWidth = this.parent.mainMenuSettings.width;
            this.element
            .addClass(this.mainMenuBarCls)
            //.height(this.mainMenuHeight)
            //.width(this.mainMenuWidth)
            .appendTo(this.appendTo);

            this.element.append(this.template({
                resID:       this.resID,
                mainMenuCls: this.mainMenuCls,
                showBookmark : this.state.getStateProperty('mainMenuSettings').buttons.bookmark,
                showLayout : this.state.getStateProperty('mainMenuSettings').buttons.layout,
                showOptions: this.state.getStateProperty('mainMenuSettings').buttons.options,
                showFullScreenViewer : this.state.getStateProperty('mainMenuSettings').buttons.fullScreenViewer,
                userButtons: this.state.getStateProperty('mainMenuSettings').userButtons,
                userLogo:    this.state.getStateProperty('mainMenuSettings').userLogo,
                useClose:    window.closeViewer?true:false,
                useTarget:   force=="forced"?true:false
            }));

            this.element.find('.mainmenu-button').each(function() {
              jQuery(this).qtip({
                content: {
                  text: jQuery(this).attr('title'),
                },
                position: {
                  my: 'top center',
                  at: 'bottom center'
                },
                style: {
                  classes: 'qtip-dark qtip-shadow qtip-rounded'
                },
              });
            });

            this.listenForActions();
            this.bindEvents(inApp);
        },

        listenForActions: function() {
          var _this = this;

          _this.eventEmitter.subscribe('MAINMENU_FULLSCREEN_BUTTON', function(event) {
            var fullScreenButton = _this.element.find('.fullscreen-viewer span');
            if (fullScreenButton.hasClass('fa-expand')) {
              fullScreenButton.removeClass('fa-expand').addClass('fa-compress');
            } else {
              fullScreenButton.removeClass('fa-compress').addClass('fa-expand');
            }
          });
        },

        bindEvents: function(inApp) {
            var _this = this;
            //change 'change-layout' to mouseover events rather than click?
            this.element.find('.change-layout').on('click', function() { 
              _this.eventEmitter.publish('TOGGLE_WORKSPACE_PANEL');
              //remove active class from other buttons
              _this.element.find('.bookmark-workspace').removeClass('active');
              if (jQuery(this).hasClass('active')) {
                jQuery(this).removeClass('active');
              } else {
                jQuery(this).addClass('active');
              }
            });

            this.element.find('.bookmark-workspace').on('click', function() { 
              _this.eventEmitter.publish('TOGGLE_BOOKMARK_PANEL');
              //remove active class from other buttons
              _this.element.find('.change-layout').removeClass('active');
              if (jQuery(this).hasClass('active')) {
                jQuery(this).removeClass('active');
              } else {
                jQuery(this).addClass('active');
              }
            });

            // when options are implemented, this will need to do something
            this.element.find('.window-options').on('click', function() { });
            this.element.find('.fullscreen-viewer').on('click', function() {
              _this.eventEmitter.publish('TOGGLE_FULLSCREEN');
            });

            this.element.find("#breadcrumbs #collec").on('click', function() { 
              jQuery(".mobile-button.top").removeClass("image");
              if(!jQuery(this).hasClass("on")) {
                jQuery(this).parent().find(".on").removeClass("on");
                jQuery(this).addClass("on");
                _this.eventEmitter.publish('manifestsPanelVisible.set',true);
                jQuery(".nav-bar-top #breadcrumbs #vol,.nav-bar-top #breadcrumbs #image").removeClass("active on");
                if(inApp) { 
                  if(window.innerWidth <= 800 && window.innerWidth <= window.innerHeight) {
                    if(jQuery("#manifest-select-menu .member-select-results ul li").length == 1) {
                      if(jQuery("#collection-tree-resizer").hasClass("closed")){
                        jQuery("#collection-tree-resizer .collec-tree-open-close").click();
                      }
                    }
                  }
                  setTimeout(function() { jQuery(window).scrollTop(0); }, 150);
                }
              }
            });

            this.element.find("#breadcrumbs #vol").on('click', function() { 
              jQuery(".scroll-view.withMonlam").removeClass("withMonlam").parent().find(".monlamResults").remove();
              jQuery(".mobile-button.top").removeClass("image");
              var the = jQuery(this);
              if(!the.hasClass("on")) {
                the.parent().find(".on").removeClass("on");
                the.addClass("on");
                //if(the.attr("data-reading-view-id"))  jQuery(".preview-image[data-image-id='"+the.attr("data-reading-view-id")+"']").click();
                //else 
                jQuery(".mirador-viewer li.scroll-option").click();                
              }
            });

            this.element.find("#breadcrumbs #image").on('click', function() {
              jQuery(".mobile-button.top").addClass("image");
              var the = jQuery(this);
              if(!the.hasClass("on")) {
                the.parent().find(".on").removeClass("on");
                the.addClass("on");
                if(!the.attr("data-reading-view-id") || the.attr("data-reading-view-id") === jQuery("#breadcrumbs #vol").attr("data-reading-view-id")) { 
                  var image = jQuery(".thumbnail-image[data-image-id='"+the.attr("data-page-view-id")+"']");
                  if(image.length) image.click();
                  else {
                    window.tmpScroll = true ;
                    jQuery(".preview-image[data-image-id='"+the.attr("data-reading-view-id")+"']").click();
                    var timer = setInterval(function(){
                      image = jQuery(".thumbnail-image[data-image-id='"+the.attr("data-page-view-id")+"']");
                      console.log(image,the.attr("data-page-view-id"));
                      if(image.length) { 
                        image.click();
                        clearInterval(timer);
                      }
                    },10);
                  }
                  setTimeout(function(){ clearInterval(timer); },500);
                }
              }
            });
        },

        template: $.Handlebars.compile([

      //'<div class="nav-bar-top"><div><a href="https://www.tbrc.org" target="_blank" id="bdrc"><img src="/BDRC-Logo.png"/></a><a href="/" id="buda"><img src="/LIBRARY.svg"/></a></div>',
      '<div class="nav-bar-top"><div id="logo"><a {{#if useTarget}}href="https://library.bdrc.io/" target="_blank"{{else}}href="/"{{/if}} id="buda" ><img src="/icons/BUDA-small.svg"/></a><a href="/"><span>BUDA</span></a><a><span>by</span></a><a href="https://bdrc.io/" target="_blank"  id="bdrc"><span>BDRC</span></a><a href="https://bdrc.io" target="_blank"><img src="/BDRC-Logo_.png"/></a></div>',
        
      '<div id="breadcrumbs">',
      '{{#if useClose}}',
      '<a onClick="javascript:window.closeViewer(arguments[0], true)" id="return" class="active"><span>{{t "results"}}</span><span>{{t "resultsMob"}}</span></a>',
      //'{{else}}',
      //'<a href="/show/{{resID}}" id="return" class="active">{{t "return"}}</a>',
      '{{/if}}',
      '<a id="collec"><span>{{t "browse"}}</span></a><a id="vol"><span>Reading View</span></a><a id="image"><span>Page View</span></a></div>',
      '<span class="X" onClick="javascript:window.closeViewer(arguments[0], false)"></span>',
      '</div>',

        '{{#if userLogo}}',
          '<ul class="user-logo {{mainMenuCls}}">',
            '{{userlogo userLogo}}',
          '</ul>',
        '{{/if}}',
        '<ul class="{{mainMenuCls}}">',
        '{{#if showBookmark}}',
          '<li>',
            '<a href="javascript:;" class="bookmark-workspace mainmenu-button" title="{{t "bookmarkTooltip"}}" aria-label="{{t "bookmarkTooltip"}}">',
              '<span class="fa fa-bookmark fa-lg fa-fw"></span> {{t "bookmark"}}',
            '</a>',
          '</li>',
        '{{/if}}',
        /*'{{#if showOptions}}',
          '<li>',
            '<a href="javascript:;" class="window-options" title="Window Options">',
              '<span class=""></span>Options',
            '</a>',
          '</li>',
        '{{/if}}',*/
        '{{#if showLayout}}',
          '<li>',
            '<a href="javascript:;" class="change-layout mainmenu-button" title="{{t "changeLayoutTooltip"}}" aria-label="{{t "changeLayoutTooltip"}}">',
              '<span class="fa fa-th-large fa-lg fa-fw"></span> {{t "changeLayout"}}',
            '</a>',
          '</li>',
        '{{/if}}',
        '{{#if showFullScreenViewer}}',
          '<li>',
            '<a href="javascript:;" class="fullscreen-viewer mainmenu-button" title="{{t "fullScreenTooltip"}}" aria-label="{{t "fullScreenTooltip"}}">',
              '<span class="fa fa-expand fa-lg fa-fw"></span> {{t "fullScreen"}}',
            '</a>',
          '</li>',
        '{{/if}}',
        '</ul>',
        '{{#if userButtons}}',
          '{{userbtns userButtons}}',
        '{{/if}}'
        ].join(''))
    };

    /* Helper methods for processing userButtons provided in configuration */

    /*    Processes userButtons configuration setting   *
     ****************************************************
     * userButtons, if present, should be an array      *
     *                                                  *
     * Its elements should be objects, which can        *
     * have the following attributes:                   *
     *                                                  *
     *   label: text label assigned to the link         *
     *          created. (required)                     *
     *   attributes: HTML attributes to add to the      *
     *          button.  If there is a "callback"       *
     *          attribute for the button, this MUST     *
     *          exist and MUST contain an "id" value    *
     *   li_attributes: HTML attributes to add to the   *
     *          list item containing the button.        *
     *   iconClass: class or space-separated list of    *
     *          classes. If present, an empty span with *
     *          these classes will be prepended to the  *
     *          content of the link element
     *   sublist: Sublist of buttons, to be implemented *
     *          as a dropdown via CSS/JS                *
     *   ul_attributes: HTML attributes to add to the   *
     *          sublist UL contained in the button.     *
     *          Ignored if button isn't representing    *
     *          a sublist.                              *
     *                                                  *
     * NOTE: sublist dropdown functionality is not yet  *
     *       implemented                                *
     ****************************************************/
    var processUserButtons = function (btns) {
        var output = [];
        var btn;
        var btns_len = btns.length;

        for (var i = 0; i < btns_len; i++){
            output.push(processUserBtn(btns[i]));
        }
        return output;
    };

    var processUserBtn = function (btn) {
        var $li = jQuery('<li>');
        var $a = jQuery('<a>');
        var $sub_ul;

        try {
            /* Enclosing <li> for button */
            if (btn.li_attributes){
                $li.attr(btn.li_attributes);
            }

            /* Link for button. */
            if (!btn.label) {
                throw "userButtons must have labels";
            }

            $a.text(btn.label);

            if (btn.iconClass) {
                $a.prepend('<span class="' + btn.iconClass + '"></span> ');
            }

            if (btn.attributes){
                $a.attr(btn.attributes);
            }

            $li.append($a);

            /* Sublist if present */
            if (btn.sublist) {
                $sub_ul = jQuery('<ul>');
                if (btn.ul_attributes){
                    $sub_ul.attr(btn.ul_attributes);
                }
                /* Recurse! */
                $sub_ul.append(processUserButtons(btn.sublist));

                $li.append($sub_ul);
            }

            return $li;
        }
        catch (err) {
            console && console.log && console.log(err);
            return jQuery();
        }
    };

    $.Handlebars.registerHelper('userbtns', function (userButtons) {
        return new $.Handlebars.SafeString(
            jQuery('<ul class="user-buttons ' + this.mainMenuCls +'"></ul>').append(processUserButtons(userButtons)).get(0).outerHTML
        );
    });

    $.Handlebars.registerHelper('userlogo', function (userLogo) {
        return new $.Handlebars.SafeString(
            processUserBtn(userLogo).get(0).outerHTML
        );
    });

}(Mirador));
