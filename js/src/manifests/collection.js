(function($){

  // This is an analogue of the Manifest utility class, but for collections
  $.Collection = function(collectionUri, location, collectionContent) {
    if (collectionContent) {
      jQuery.extend(true, this, {
          jsonLd: null,
          location: location,
          uri: collectionUri,
          request: null
      });
      this.initFromCollectionContent(collectionContent);
    } else {
      jQuery.extend(true, this, {
        jsonLd: null,
        location: location,
        uri: collectionUri,
        request: null
      });

      this.init(collectionUri);
    }
  };

  $.Collection.prototype = {
    init: function(collectionUri) {
      var _this = this,
        headers = {},
        id_token ;       

      try { 
        id_token = localStorage.getItem('id_token');
        if(id_token && collectionUri && collectionUri.match(/[^?&]+[.]bdrc[.]io[/]/) && !collectionUri.match(/bdr:[WI]0?(SAT|EAP|CDL|IA|SBB|LOC|LULDC)/)) {        
          var jwt = parseJwt(id_token);
          if(jwt.exp && jwt.exp > Date.now() / 1000)
            headers = { "Authorization": "Bearer " + id_token } ; // TODO no need if manifest not from BDRC x is token valid ?
        }
      } catch(e) {
        console.error("error with token:",id_token,e);
      }

      this.request = jQuery.ajax({
        url: collectionUri,
        dataType: 'json',
        async: true,
        headers: headers
      });

      //console.log("collection?",headers,this.request);

      this.request.done(function(jsonLd) {
        _this.jsonLd = jsonLd;
      });

      this.request.error(function(jsonLd) {
        console.error("collection:",jsonLd);
        _this.jsonLd = {
          label:{"@language":"en","@value":jsonLd.status == 404 ? "images not available" : "problem fetching collection"},
          sequences:[{canvases:[]}],
          error:jsonLd.status
        } ;
      });
    },
    initFromCollectionContent: function (collectionContent) {
      var _this = this;
      this.request = jQuery.Deferred();
      this.request.done(function(jsonLd) {
        _this.jsonLd = jsonLd;
      });
      _this.request.resolve(collectionContent); // resolve immediately
    },
    
    // Get the IIIF API version of this collection
    getVersion: function() {
      var versionMap = {
        'http://www.shared-canvas.org/ns/context.json': '1', // is this valid?
        'http://iiif.io/api/presentation/1/context.json': '1',
        'http://iiif.io/api/presentation/2/context.json': '2',
        'http://iiif.io/api/presentation/2.1/context.json': '2.1'
      };
      return versionMap[this.jsonLd['@context']];
    },
    
    // Return a list of sub-manifest URIs contained in this collection
    getManifestUris: function() {
      // "manifests" key present
      if (this.jsonLd.manifests) {
        return jQuery.map(this.jsonLd.manifests, function(v, _) {
          return v['@id'];
        });
      }
      // "members" key present, sift-out non-manifests
      if (this.jsonLd.members) {
        return jQuery.map(this.jsonLd.members, function(v, _) {
          if (v['@type'] === 'sc:Manifest') {
            return v['@id'];
          }
        });
      }
      // Neither present
      return [];
    },
    
    // Return a list of sub-manifest JSON blocks contained in this collection
    getManifestBlocks: function() {
      // "manifests" key present
      if (this.jsonLd.manifests) {
        return this.jsonLd.manifests;
      }
      // "members" key present, sift-out non-manifests
      if (this.jsonLd.members) {
        return jQuery.map(this.jsonLd.members, function(v, _) {
          if (v['@type'] === 'sc:Manifest') {
            return v;
          }
        });
      }
      // Neither present
      return [];
    },
    
    // Return a list of sub-collection URIs contained in this collection
    getCollectionUris: function() {
      // "collections" key present
      if (this.jsonLd.collections) {
        return jQuery.map(this.jsonLd.collections, function(v, _) {
          return v['@id'];
        });
      }
      // "members" key present, sift-out non-collections
      if (this.jsonLd.members) {
        return jQuery.map(this.jsonLd.members, function(v, _) {
          if (v['@type'] === 'sc:Collection') {
            return v['@id'];
          }
        });
      }
      // Neither present
      return [];
    },
    
    // Return a list of sub-collection JSON blocks contained in this collection
    getCollectionBlocks: function() {
      // "collections" key present
      if (this.jsonLd.collections) {
        return this.jsonLd.collections;
      }
      // "members" key present, sift out non-collections
      if (this.jsonLd.members) {
        return jQuery.map(this.jsonLd.members, function(v, _) {
          if (v['@type'] === 'sc:Collection') {
            return v;
          }
        });
      }
      // Neither present
      return [];
    }
  };

}(Mirador));
