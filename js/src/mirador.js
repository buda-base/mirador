

// This file defines the global Mirador constructor function.
// This is the entry point to Mirador and is intentionally sparse.
(function(global) {
  function checkContainer(containerId) {
    var container = jQuery('#' + containerId);
    if (!container.hasClass('mirador-container')) {
      // Add necessary namespace class to the container element so that
      // style definitions will be applied correctly
      container.addClass('mirador-container');
    }
  }

  function Mirador(config) {

    // auto // console.log("M options?",config);

    // TODO add token to info.json (OSD)

    if (this instanceof Mirador) {
        checkContainer(config.id);

        // initialize the event emitter for this mirador instance
        this.eventEmitter = new Mirador.EventEmitter();

        // pass the config through the save and restore process,
        // returning the config that will, in fact, populate the application
        this.saveController = new Mirador.SaveController(jQuery.extend(true, {}, config, {'eventEmitter': this.eventEmitter}));

        // initialize the application
        this.viewer = new Mirador.Viewer({
            'state': this.saveController,
            'eventEmitter': this.eventEmitter,
            'resID': config.resID,
            'locale':config.locale
        });
        return this;
    } else {
        return new Mirador(config);
    }
  }
  global.Mirador = global.Mirador || Mirador;


  var originalConfigure = OpenSeadragon.IIIFTileSource.prototype.configure;
  OpenSeadragon.IIIFTileSource.prototype.configure = function(data, url) {
    data = originalConfigure.call(this, data, url);

    if(data.preferredFormats) for (var f = 0; f < data.preferredFormats.length; f++ ) {
      if ( OpenSeadragon.imageFormatSupported(data.preferredFormats[f]) ) {
        data.tileFormat = data.preferredFormats[f];
        break;
      }
    }
    else if(data.formatHints) for (var g = 0; g < data.formatHints.length; g++ ) {
      if ( OpenSeadragon.imageFormatSupported(data.formatHints[g]) ) {
        data.tileFormat = data.formatHints[g];
        break;
      }
    }
    return data;
  };
})(window);
