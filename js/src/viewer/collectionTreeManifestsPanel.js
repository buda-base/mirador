(function($) {

    $.CollectionTreeManifestsPanel = function(options) {

        jQuery.extend(true, this, {
            element:                    null,
            listItems:                  null,
            appendTo:                   null,
            manifestListItems:          [],
            manifestListElement:        null,
            manifestLoadStatusIndicator: null,
            treeElement:                null, //The container element around the collection tree
            expectedThings:             [], //A list of manifest URIs expected for the current collection "folder"
            preloadedManifests:         [], //A list of manifest URIs loaded in through the data attribute
            userManifests:              [], //A list of manifest URIs loaded in through the "Load Object from URL" form
            nodeManifests:              {}, //Maps node IDs to a list of manifest URIs its collection holds
            nodeCollections:            {}, //Maps node IDs to a list of collection URIs its collection holds
            nodeIdToUri:                {}, //Maps node IDs to their respective URIs
            uriToNodeId:                {}, //Maps URIs to a list of node IDs that represent it (Inverse of nodeIdToUri)
            nodeChildren:               {}, //Maps node IDs to a list of children node IDs
            unexpandedNodes:            {}, //A set of node ID => true entries that contains all node IDs pending expansion (i.e. may have more content)
            topCollectionsUris:         {}, //A set of URIs already placed at the top level of the collection tree
            treeQueue:                  [], //A list that holds event triggers before the tree is ready; will be removed when ready
            resultsWidth:               0,
            lazyLoadingFactor:          1.2,
            lazyLoadingManifests:       [],
            state:                      null,
            eventEmitter:               null,
            labelToString:              function(label) { return $.JsonLd.getTextValue(label); },
        }, options);

        var _this = this;
        _this.init();

    };

    $.CollectionTreeManifestsPanel.prototype = {

        init: function() {
            var _this = this;            
            this.element = jQuery(this.template({
                showURLBox : this.state.getStateProperty('showAddFromURLBox'),
                lang:i18next.language
            })).appendTo(this.appendTo);
            this.manifestListElement = this.element.find('ul');

            // Populate the preloads folder with manifests in the configuration
            jQuery.each(this.state.currentConfig.data, function(_, v) {
              if (v.hasOwnProperty('manifestUri')) {
                _this.preloadedManifests.push(v.manifestUri);
              }
            });
            // Expect these preloads by default
            this.expectedThings = this.preloadedManifests;
            // Create the collection tree
            this.treeElement = jQuery('#collection-tree').jstree({
              core: {
                // Seed the tree with the two basic "folders"
                data: [
                  {
                    id: 'preload',
                    text: i18next.t('preloadedManifests'),
                    icon: 'fa fa-suitcase',
                    state: {
                      selected: true
                    },
                    children: []
                  },
                  {
                    id: 'user',
                    text: i18next.t('myManifests'),
                    icon: 'fa fa-user',
                    children: []
                  }
                ],
                // Tune looks
                themes: {
                  dots: false
                },
                check_callback: true, // IMPORTANT: This line allows code to edit the tree later
                multiple: false, // IMPORTANT: This prevents multiple nodes from being selected
                dblclick_toggle : false // open node on single click instead of double
              }
            // Hook up event for when a node is selected
            }).on('select_node.jstree', function(event, data) {
              _this.changeNode(data.node);
            // Hook up event for when a node is expanded (> clicked)
            }).on('open_node.jstree', function(event, data) {
              _this.expandNode(data.node);
            // Hook up "ready" event to handle backlogged collection loads
            }).on('ready.jstree', function() {
              // Cache the backlog and remove the original; this signals to other methods that it's OK to manipulate the tree
              var theQueue = _this.treeQueue.slice(0);
              delete _this.treeQueue;
              // Process the backlog
              jQuery.each(theQueue, function(_, v) {
                if (v.length == 4) { // When a collection is loaded successfully, the logged entry is 4 elements long
                  _this.onCollectionReceived.apply(_this, v);
                } else { // When a collection fails to load, the logged entry is 3 elements long
                  _this.onCollectionNotReceived.apply(_this, v);
                }
              });
              console.log("ok",theQueue);
            });

            //this code gives us the max width of the results area, used to determine how many preview images to show
            //cloning the element and adjusting the display and visibility means it won't break the normal flow
            var clone = this.element.clone().css("visibility","hidden").css("display", "block").appendTo(this.appendTo);
            this.resultsWidth = clone.find('.member-select-results').outerWidth();
            this.controlsHeight = clone.find('.manifest-panel-controls').outerHeight();
            this.paddingListElement = this.controlsHeight;
            this.manifestListElement.css("padding-bottom", this.paddingListElement);
            clone.remove();

            // this.manifestLoadStatusIndicator = new $.ManifestLoadStatusIndicator({
            //   manifests: this.parent.manifests,
            //   appendTo: this.element.find('.member-select-results')
            // });
            this.bindEvents();
            this.listenForActions();

            if(!jQuery("#viewer.inApp").length) {
              this.ps = new PerfectScrollbar(".member-select-results",{ minScrollbarLength:16, maxScrollbarLength:16 });
              this.psTree = new PerfectScrollbar("#collection-tree",{ minScrollbarLength:16, maxScrollbarLength:16 });
            }
        },

        // TODO get pdf download link via popin not new tab

        listenForActions: function() {
          var _this = this;

          _this.eventEmitter.subscribe('UPDATE_COLLECTION_SCROLL_BAR', function(_) {
            //console.log("update",_this.ps);
            if(_this.ps) _this.ps.update();
          });

          setTimeout(function() { 
            if(_this.ps) _this.ps.update(); 
          }, 10);

          // handle subscribed events
          // When the manifest selection panel is brought up or hidden
          _this.eventEmitter.subscribe('manifestsPanelVisible.set', function(_, stateValue) {
            _this.onPanelVisible(_, stateValue);
          });

          // When a manifest is received
          _this.eventEmitter.subscribe('manifestReceived', function(event, newManifest) {
            _this.onManifestReceived(event, newManifest);
          });

          // When a collection is received
          _this.eventEmitter.subscribe('collectionReceived', function(event, newCollection, parentUri, parentNodeId) {
            _this.onCollectionReceived(event, newCollection, parentUri, parentNodeId);
          });

          // When a collection failed to load
          _this.eventEmitter.subscribe('collectionNotReceived', function(event, parentUri, parentNodeId) {
            _this.onCollectionNotReceived(event, parentUri, parentNodeId);
          });

          // When Mirador gets an explicit request to load a manifest from a URL
          _this.eventEmitter.subscribe('ADD_MANIFEST_FROM_URL', function(event, url) {
            // Add it if it has not been loaded before
            if (_this.userManifests.indexOf(url) == -1) {
              _this.userManifests.push(url);
            }
            // Shift to the "User-Loaded Manifests" folder
            _this.treeElement.jstree('deselect_all');
            _this.treeElement.jstree('select_node', 'user');
          });

          // When Mirador gets an explicit request to load a collection from a URL
          _this.eventEmitter.subscribe('ADD_COLLECTION_FROM_URL', function(event, url, source) {
            _this.addCollectionFromUrl(url, null, true);
          });

          // When Mirador gets a request to load an object (manifest or collection) from a URL (e.g. the "Add object from URL" form)
          _this.eventEmitter.subscribe('ADD_OBJECT_FROM_URL', function(event, url, source) {
            _this.addObjectFromUrl(url, source, true);
          });
        },

        bindEvents: function() {
            var _this = this;
            

            // toggle node on simple click
            jQuery('#collection-tree').on('click', '.jstree-anchor', function (e) {
                jQuery(this).jstree(true).toggle_node(e.target);                
                if(window.innerWidth < window.innerHeight && window.innerWidth <= 800 && jQuery(this).parent().hasClass("jstree-leaf")) {
                  jQuery(".collec-tree-open-close").click();
                }                
            }).jstree();

            jQuery('.collec-tree-open-close').on('click', function(event) {
              var elem = jQuery("#collection-tree-resizer");
              if(!elem.hasClass("closed")) elem.addClass("closed").animate({"margin-left":-(elem.width() - 25)},400);    
              else elem.removeClass("closed").animate({"margin-left":0},400);    
            });

            jQuery("#viewer.inApp").on('swiperight', function(e) {              
              var tree = jQuery("#collection-tree-resizer:not(.disabled):visible .collec-tree-open-close");
              //console.log("L:",tree);
              if(tree.parent().hasClass("closed")) tree.click();
            });

            jQuery("#viewer.inApp").on('swipeleft', function(e) {              
              var tree = jQuery("#collection-tree-resizer:not(.disabled):visible .collec-tree-open-close");
              //console.log("R:",tree);
              if(!tree.parent().hasClass("closed")) tree.click();
            });

            // handle interface events
            this.element.find('form#url-load-form').on('submit', function(event) {
              event.preventDefault();
              _this.addObjectUrl(jQuery(this).find('input').val());
            });

            this.element.find('.remove-object-option').on('click', function(event) {
              _this.togglePanel(event);
            });

            // Filter manifests based on user input
            this.element.find('#manifest-search').on('keyup input', function(event) {
              _this.filterManifests(this.value);
            });

            this.element.find('#manifest-search-form').on('submit', function(event) {
              event.preventDefault();
            });

            var resizePanel = function(ev) {

              var elem = jQuery('#collection-tree-resizer');
              var w = jQuery(".mirador-container #manifest-select-menu").width();
              var mw = 240 ;
              if(w > 1600) mw = 350 ;
              var coef = 0.75 ;
              if(w <= 800) { 
                if(window.innerWidth < window.innerHeight) { 
                  coef = 1 ;
                  mw = w ;
                } else {
                  coef = 0.5 + 13/w;
                  mw = w ;                  
                }
              }

              if(!elem.resizable("instance")) elem.resizable({
                minWidth: Math.min(mw,w*(1-coef)),
                maxWidth: w*coef,
                handles: "e"
              });
              else {
                elem.resizable("option","minWidth", Math.min(mw,w*(1-coef)));
                elem.resizable("option","maxWidth", w*coef);
              }
              

              var ew = elem.width() ; 
              if(ew) {
                console.log("W:"+w+":",ew,mw,w*(1-coef),w * coef, Math.min(mw,w*(1-coef)), ev.type);
                if(w <= 800)  { 
                  elem.width(w * coef);
                  if(elem.hasClass("closed")) elem.css({"margin-left":-(w*coef - 25)+"px"});
                } else if(ew && ew > w*coef) elem.width(w * coef);
                else if(ew && ew < Math.min(mw,w*(1-coef))) elem.width(Math.min(mw,w*(1-coef)));
              }

              /*
              var tree = jQuery("#collection-tree-resizer");
              if(tree.hasClass("disabled")) {
                if(window.innerWidth < 800) {
                  tree.removeClass("closed");
                  jQuery(".collec-tree-open-close").click();
                } else {
                  tree.removeClass("disabled");                  
                  if(tree.hasClass("closed")) {
                    tree.removeClass("closed");
                    jQuery(".collec-tree-open-close").click();
                  }
                }
              }
              */

            };

            // jQuery(window).on("orientationchange", resizePanel); // no need (resize already triggered in that case)
            jQuery(window).resize($.throttle(resizePanel, 100, true));

            setTimeout(function(){ jQuery(window).resize(); },650);  

            _this.resizePanel();

            // Lazy loading
            var elem = this.element.find('.member-select-results');            

            var lazy = function() {

              if(!elem.is(":visible")) return ; 

              console.log("scroll?");

              jQuery(".member-select-results").find('.preview-images').each(function(_, w) {
                var img = jQuery(this).find('img[data-src]');
                if(img.length) {
                  img.each(function(_, v) {
                    if ($.isOnScreen(v, _this.lazyLoadingFactor,elem)) {
                      v.setAttribute('src', v.getAttribute('data-src'));
                      v.removeAttribute('data-src');
                    }
                  });
                }
                else if ($.isOnScreen(w, _this.lazyLoadingFactor, elem)) {
                  var url = jQuery(w).parent().parent().attr('data-url');                  
                  //console.log("should load manifest",url);
                  if(_this.lazyLoadingManifests.indexOf(url) === -1) {
                    _this.lazyLoadingManifests.push(url);
                    var manifest = new $.Manifest(url,'');                     
                    
                    _this.eventEmitter.publish('manifestQueued', manifest, '');   

                    manifest.request.done(function() {
                      jQuery("li[data-url='"+url+"']").remove();
                      _this.eventEmitter.publish('manifestReceived', manifest);
                    });
                      
                    manifest.request.error(function() {
                      if(url) jQuery("li[data-url='"+url+"']").remove();
                      _this.eventEmitter.publish('manifestReceived', manifest);
                    });
                    
                  }
                }
              });
            }; 
            
            // DONE fix lazyloading for mobile
            if(jQuery("#viewer.inApp").length) {

              jQuery(window).scroll( $.throttle( lazy, 50, true) );

            } else {

              elem.scroll( $.throttle( lazy, 50, true) );

            }
            

          this.element.find('.mirador-osd-fullscreen').on('click', function() {
            if ($.fullscreenElement()) {
              $.exitFullscreen();
            } else {
              console.log("click fs");
              $.enterFullscreen(_this.element.closest("html")[0]);
            }
          });

        },

        hide: function() {
            jQuery(".workspace-container").show({effect: "fade", duration: 160, easing: "easeInCubic"});              
            var _this = this;
            jQuery(this.element).hide({effect: "fade", duration: 160, easing: "easeOutCubic"});
            jQuery(".mobile-button.top").removeClass("on collec");
        },

        show: function() {
            var _this = this;
            jQuery(".workspace-container").hide({effect: "fade", duration: 160, easing: "easeInCubic"});              
            jQuery(this.element).show({effect: "fade", duration: 160, easing: "easeInCubic"});            
            this.element.find('.member-select-results').scroll();
            jQuery(".mobile-button.top").addClass("on collec");
            
            Z = 0 ;
            if(window.currentZoom != undefined) delete window.currentZoom ;

            var urlParams = new URLSearchParams(window.location.search), origin = urlParams.get("origin");
            var inApp = (window.innerWidth < 800) || (origin && origin.startsWith("BDRCLibApp"));
            if(inApp) {
              this.element.find('.member-select-results').addClass("auto_rela").parents().addClass("auto_rela");
            }

        },

        // Send explicit request for adding a manifest from a URL
        addManifestUrl: function(url) {
          var _this = this;
          _this.eventEmitter.publish('ADD_MANIFEST_FROM_URL', [url, "(Added from URL)"]);
        },

        // Send explicit request for adding a manifest or collection from a URL
        addObjectUrl: function(url) {
          var _this = this;
          _this.eventEmitter.publish('ADD_OBJECT_FROM_URL', [url, "(Added from URL)"]);
        },

        togglePanel: function(event) {
          var _this = this;
          _this.eventEmitter.publish('TOGGLE_LOAD_WINDOW');
        },

        filterManifests: function(value) {
          var _this = this;
          if (value.length > 0) {
             _this.element.find('.items-listing li').show().filter(function() {
                return jQuery(this).text().toLowerCase().indexOf(value.toLowerCase()) === -1;
             }).hide();
          } else {
             _this.element.find('.items-listing li').show();
          }
        },

        resizePanel: function() {
          var _this = this;
          var clone = _this.element.clone().css("visibility","hidden").css("display", "block").appendTo(_this.appendTo);
          _this.resultsWidth = clone.find('.member-select-results').outerWidth();
          clone.remove();
          this.element.find('.select-results').scroll();
          _this.eventEmitter.publish("manifestPanelWidthChanged", _this.resultsWidth);
        },

        onPanelVisible: function(_, stateValue) {
          var _this = this;
          if (stateValue) { _this.show(); return; }
           _this.hide();
        },

        // Handler for when manifest data is loaded for the first time
        onManifestReceived: function(event, newManifest) {
          var _this = this;
          // Show a manifest list item only if the currently selected "folder" expects it
          if (_this.expectedThings.indexOf(newManifest.uri) != -1) {
            _this.manifestListItems.push(new $.ManifestListItem({
              //url:"new2?",
              labelToString:_this.labelToString,
              manifest: newManifest,
              resultsWidth: _this.resultsWidth,
              state: _this.state,
              eventEmitter: _this.eventEmitter,
              forcedIndex: _this.expectedThings.indexOf(newManifest.uri),
              appendTo: _this.manifestListElement }));
            _this.element.find('#manifest-search').keyup();
            _this.element.find('.member-select-results').scroll();
          }
        },

        // Handler for when collection data is loaded for the first time
        onCollectionReceived: function(event, newCollection, uri, parentNodeId) {
          
          // If the tree isn't ready, hold it and move on
          if (typeof this.treeQueue !== 'undefined') {
            this.treeQueue.push([event, newCollection, uri, parentNodeId]);
            return;
          }
          // Update nodes if the target isn't top; create new node if the target is top
          if (parentNodeId) {
            this.updateCollectionNode(parentNodeId, newCollection);
          } else {

             if(newCollection && newCollection.jsonLd && (!newCollection.jsonLd.collections || !newCollection.jsonLd.collections.length)) {
                var tree = jQuery("#collection-tree-resizer");
                tree.addClass("disabled");
                if(!tree.hasClass("closed") && window.innerWidth < 800) jQuery(".collec-tree-open-close").click();
              }
         

            var node = this.addCollectionNode(parentNodeId, newCollection);
            console.log("ok?",node,newCollection);
            this.treeElement.jstree('deselect_all');
            this.treeElement.jstree('select_node', node);
            this.treeElement.jstree('open_node', node);          

            var _this = this, timer ;
            if(newCollection && newCollection.jsonLd && !newCollection.jsonLd.collections && newCollection.jsonLd.manifests && newCollection.jsonLd.manifests.length === 1) { 
              timer = setInterval(function(){
                if(jQuery(".member-select-results .setClick .preview-image").length) {
                  _this.eventEmitter.publish('OPEN_MANIFEST.'+newCollection.jsonLd.manifests[0]["@id"]);                                
                  clearInterval(timer);
                }
              },10);
            }
            else {
              jQuery(".nav-bar-top #breadcrumbs .on").removeClass("on");
              jQuery(".nav-bar-top #breadcrumbs #collec span").text(this.labelToString(newCollection.jsonLd.label))
              .parent().addClass("active on").attr("title","Browse Collection: "+this.labelToString(newCollection.jsonLd.label)) ;
              
              /*
              timer = setInterval(function(){
                if(jQuery(".member-select-results .setClick .preview-image").length) {
                  _this.eventEmitter.publish('UPDATE_MAIN_MENU_MANIFEST.'+newCollection.jsonLd.manifests[0]["@id"]);                                
                  clearInterval(timer);                
                }
              },10);
              */            
            }            
          }
        },

        // Handler for when collection data is loaded for the first time and failed
        onCollectionNotReceived: function(event, uri, parentNodeId) {
          // If the tree isn't ready, hold it and move on
          if (typeof this.treeQueue !== 'undefined') {
            this.treeQueue.push([event, uri, parentNodeId]);
            return;
          }
          // Mark the child node belonging to this as a fail
          var _this = this;
          jQuery.each(this.uriToNodeId[uri], function(_, nodeId) {
            _this.treeElement.jstree('set_icon', nodeId, 'fa fa-ban'); // Set icon to (/)
            _this.treeElement.jstree('disable_node', nodeId); // Don't let the user click it
          });
        },

        // Clean out the list of manifest items on the right side
        clearManifestItems: function() {
          this.manifestListItems = [];
          this.manifestListElement.html('');
        },

        // Set up 2-way correspondence between node IDs and URIs
        registerNodeIdUriPair: function(nodeId, uri) {
          // Map node ID to URI
          this.nodeIdToUri[nodeId] = uri;
          if (this.uriToNodeId[uri]) {
            this.uriToNodeId[uri].push(nodeId); // Existing URI => new node ID
          } else {
            this.uriToNodeId[uri] = [nodeId]; // New URI => new node ID
          }
        },

        // Handler for selecting a new node
        changeNode: function(node) {
          var _this = this;
          // Clean out manifest items on the right side
          this.clearManifestItems();
          // Listen in on manifests in the "folder" or collection it represents
          switch (node.id) {
            case 'preload': _this.expectedThings = _this.preloadedManifests; break;
            case 'user': _this.expectedThings = _this.userManifests; break;
            default: _this.expectedThings = _this.nodeManifests[node.id]; break;
          }
          // Populate and refresh the manifests listings
          jQuery.each(_this.expectedThings, function(_, expectedThing) {
            _this.addManifestFromUrl(expectedThing);
          });
          this.element.find('#manifest-search').keyup();
          this.element.find('.member-select-results').scroll();
        },

        // Handler for expanding a node (> clicked)
        expandNode: function(node) {
          var _this = this;
          // Update its children by loading their stated URIs
          jQuery.each(_this.nodeCollections[node.id], function(_, uri) {
            _this.updateCollectionFromUrl(uri, node.id);
          });
        },

        // Helper for loading a manifest or collection from a URL
        addObjectFromUrl: function(url, source) {
          var _this = this,
            object = _this.state.getStateProperty('manifests')[url]; // Attempt to get from cache
          // Cache hit
          if (object) {
            // Fire off the correct event if its cache entry is loaded
            if (object.jsonLd) {
              switch (object.jsonLd['@type']) {
                case 'sc:Collection':
                  _this.eventEmitter.publish('ADD_COLLECTION_FROM_URL', [url, source]);
                break;
                case 'sc:Manifest':
                  _this.eventEmitter.publish('ADD_MANIFEST_FROM_URL', [url, source]);
                break;
              }
            }
          }
          // Cache miss
          else {
            // Get the manifest or collection with AJAX
            jQuery.ajax({
              url: url,
              dataType: 'json',
              type: 'GET',
              // Fire off the correct event once it finishes loading
              success: function(data) {
                switch (data['@type']) {
                  case 'sc:Collection':
                    object = new $.Collection(url, source, data);
                    _this.eventEmitter.publish('manifestQueued', object, '');
                    _this.eventEmitter.publish('ADD_COLLECTION_FROM_URL', [url, source]);
                  break;
                  case 'sc:Manifest':
                    object = new $.Manifest(url, source, data);
                    _this.eventEmitter.publish('manifestQueued', object, ''); // Use the state manager's manifest caching to store collections too
                    _this.eventEmitter.publish('ADD_MANIFEST_FROM_URL', [url, source]);
                  break;
                }
              }
            });
          }
        },

        // Helper for loading a manifest from a URL
        addManifestFromUrl: function(url) {            
          var _this = this,
            manifest;
          // Cache hit: Show the manifest panel item if it is loaded
          if (_this.state.getStateProperty('manifests')[url]) {
            manifest = _this.state.getStateProperty('manifests')[url];
            if (manifest.jsonLd) {
              _this.manifestListItems.push(new $.ManifestListItem({
                url:url,
                labelToString:_this.labelToString,
                manifest: manifest,
                resultsWidth: _this.resultsWidth,
                state: _this.state,
                eventEmitter: _this.eventEmitter,
                forcedIndex: _this.expectedThings.indexOf(url),
                appendTo: _this.manifestListElement }));
              this.element.find('.member-select-results').scroll();
            }
          }
          // Cache miss: Queue the loading and defer the received event until it is done
          else {
                        
            _this.manifestListItems.push(new $.ManifestListItem({
              url:url,
              labelToString:_this.labelToString,
              resultsWidth: _this.resultsWidth,
              state: _this.state,
              eventEmitter: _this.eventEmitter,
              forcedIndex: _this.expectedThings.indexOf(url),
              appendTo: _this.manifestListElement }));
            this.element.find('.member-select-results').scroll();          

            /*
            _this.eventEmitter.publish('manifestQueued', manifest, '');
            manifest.request.done(function() {
              _this.eventEmitter.publish('manifestReceived', manifest);
            });
            */
          }
        },

        // Helper for loading a manifest from a URL as a child node of some other node (null = top level)
        // Optionally, jump to that new child node if jumpToIt is specified as true
        addCollectionFromUrl: function(url, nodeId, jumpToIt) {
          var _this = this,
            collection;
          // Is it adding to the top level?
          if (!nodeId) {
            // Pass if it is already loaded
            if (_this.topCollectionsUris[url]) {
              return;
            }
            // Otherwise, make note of it
            else {
              _this.topCollectionsUris[url] = true;
            }
          }
          // Cache hit: Add the node right away if it is loaded
          if (typeof _this.state.getStateProperty('manifests')[url] !== 'undefined') {
            collection = _this.state.getStateProperty('manifests')[url];
            if (collection.jsonLd) {
              var newNode = _this.addCollectionNode(nodeId, collection);
              // Also jump to the node if specified
              if (jumpToIt) {
                _this.treeElement.jstree('deselect_all');
                _this.treeElement.jstree('select_node', newNode);
                // Expand the node if it has children
                if (collection.getCollectionUris().length > 0) {
                  _this.treeElement.jstree('open_node', newNode);
                }
              }
            }
          }
          // Cache miss: Queue the loading and defer the received event until it is done or failed
          else {
            collection = new $.Collection(url, '');
            _this.eventEmitter.publish('manifestQueued', collection, ''); // Use the state manager's manifest caching to store collections too
            collection.request.done(function() {
              _this.eventEmitter.publish('collectionReceived', [collection, url, nodeId ? nodeId : null]);
            });
            collection.request.fail(function() {
              _this.eventEmitter.publish('collectionNotReceived', [url, nodeId ? nodeId : null]);
            });
          }
        },

        // Helper for updating a subnode of nodeId corresponding to the specified URL
        updateCollectionFromUrl: function(url, nodeId) {
          var _this = this,
            collection;
          // Cache hit: Get the collection object and update right away
          if (typeof _this.state.getStateProperty('manifests')[url] !== 'undefined') {
            collection = _this.state.getStateProperty('manifests')[url];
            if (collection.jsonLd) {
              _this.updateCollectionNode(nodeId, collection);
            }
          }
          // Cache miss: Queue the loading and defer the received event until it is done or failed
          else {
            collection = new $.Collection(url, '');
            _this.eventEmitter.publish('manifestQueued', collection, ''); // Use the state manager's manifest caching to store collections too
            collection.request.done(function() {
              _this.eventEmitter.publish('collectionReceived', [collection, url, nodeId ? nodeId : null]);
            });
            collection.request.fail(function() {
              _this.eventEmitter.publish('collectionNotReceived', [url, nodeId ? nodeId : null]);
            });
          }
        },

        // Helper for loading a Collection object as a child of nodeId
        // Optionally, skip seeding subnodes under this collection if unexpanded is specified; this marks it as "still loading"
        addCollectionNode: function(nodeId, collection, unexpanded) {          
          var _this = this,
              subcollectionBlocks = collection.getCollectionBlocks();
          // Add the new node
          var newNodeId = _this.treeElement.jstree('create_node', nodeId ? nodeId : null, {
            text: this.labelToString(collection.jsonLd.label),
            icon: unexpanded ? 'fa fa-spinner fa-pulse' : 'fa fa-folder', // Unexpanded = still loading, expanded = loaded
            children: []
          }, 'last');
          // Don't let nodes that are still loading be selected
          if (unexpanded) {
            _this.treeElement.jstree('disable_node', newNodeId);
          }
          // Register the new node's apparent contents
          _this.registerNodeIdUriPair(newNodeId, collection.jsonLd['@id']);
          _this.nodeCollections[newNodeId] = collection.getCollectionUris();
          _this.nodeManifests[newNodeId] = collection.getManifestUris();
          _this.nodeChildren[newNodeId] = [];
          // Add subcollections if unexpanded is not specified
          if (!unexpanded) {
            jQuery.each(subcollectionBlocks, function(i, v) {
              // Create the subnode
              var nid = _this.treeElement.jstree('create_node', newNodeId, {
                text: _this.labelToString(v.label),
                icon: 'fa fa-spinner fa-pulse',
                children: []
              }, 'last');
              // Register the subnode's apparent contents
              _this.registerNodeIdUriPair(nid, v['@id']);
              _this.unexpandedNodes[nid] = true;
              _this.nodeChildren[newNodeId].push(nid);
              // Don't let it be selected yet
              _this.treeElement.jstree('disable_node', nid);
            });
          }
          // If unexpanded is specified, mark this node as requiring expansion later
          else {
            _this.unexpandedNodes[newNodeId] = true;
          }
          // Return newly created node ID for future reference
          return newNodeId;
        },

        // Helper for updating a subnode of nodeId corresponding to the specified URL
        updateCollectionNode: function(nodeId, collection) {
          var _this = this,
              atId = collection.uri,
              collectionBlocks = collection.getCollectionBlocks(),
              collectionUris = collection.getCollectionUris(),
              manifestUris = collection.getManifestUris();
          // Find the right node to update that corresponds to the collection's URI
          jQuery.each(_this.nodeChildren[nodeId], function(_, n) {
            if (_this.nodeIdToUri[n] == atId && _this.unexpandedNodes[n]) {
              // Register the node's contents
              _this.nodeCollections[n] = collectionUris;
              _this.nodeManifests[n] = manifestUris;
              _this.nodeChildren[n] = [];
              // Add children under the node if it has any subcollections, but don't expand them yet
              jQuery.each(collectionBlocks, function(i, v) {
                var nn = _this.addCollectionNode(n, new $.Collection(v['@id'], null, v), true);
                _this.nodeChildren[n].push(nn);
                _this.unexpandedNodes[nn] = true;
              });
              // This node is already expanded, unmark it
              delete _this.unexpandedNodes[n];
              // Change its icon to a folder and allow it to be selected
              _this.treeElement.jstree('set_icon', n, 'fa fa-folder');
              _this.treeElement.jstree('enable_node', n);
            }
          });

          var elem = jQuery('#collection-tree-resizer');
          var w = jQuery(".mirador-container #manifest-select-menu").width();
          var coef = 0.75, mw = 240;
          if(w <= 800) {
            if(window.innerWidth < window.innerHeight) {
              coef = 1 ;
              mw = w ;
            } else {
              coef = 0.5 + 13/w ;
              mw = w ;
            }
          }
          if(elem.width() > w*coef) elem.width(w * coef);
          else if(elem.width() < Math.min(mw,w*(1-coef))) elem.width(Math.min(mw,w*(1-coef)));
        },

        template: $.Handlebars.compile([
          '<div id="manifest-select-menu">',
          '<div class="container">',
            '<div class="manifest-panel-controls">',
              '<a class="remove-object-option"><i class="fa fa-times fa-lg fa-fw"></i>{{t "close"}}</a>',
              '<div id="load-controls">',
                '{{#if showURLBox}}',
                  '<form action="" id="url-load-form">',
                    '<label for="url-loader">{{t "addNewObject"}}:</label>',
                    '<input type="text" id="url-loader" name="url-load" placeholder="https://...">',
                    '<input type="submit" value="{{t "load"}}">',
                  '</form>',
                '{{/if}}',
                '<form action="" id="manifest-search-form">',
                  '<label for="manifest-search">{{t "filterObjects"}}:</label>',
                  '<input id="manifest-search" type="text" name="manifest-filter">',
                '</form>',
              '</div>',
            '</div>',
              '<div id="collection-tree-resizer">',            
                '<div class="collec-tree-open-close">',
                '</div>',
                '<div id="collection-tree" lang={{lang}}>',
                '</div>',
              '</div>',
              '<div class="member-select-results">',
                '<ul class="items-listing">',
                '</ul>',
              '</div>',
          '</div>',
          '<a class="mirador-btn mirador-osd-fullscreen mirador-tooltip" role="button" title="{{t "fullScreenWindowTooltip"}}" aria-label="{{t "fullScreenWindowTooltip"}}">',
          '<span></span>',
          '</a>',
          '</div>'
        ].join(''))
    };

}(Mirador));
