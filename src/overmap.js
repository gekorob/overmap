(function () {

  var root = this;

  var Overmap;


  if (typeof exports !== 'undefined') {
    Overmap = exports;
  } else {
    Overmap = root.Overmap = {};
  }

  Overmap.VERSION = '0.0.1';


  var polygon2wkt = function (polygon) {
    var path = polygon.getPath();
    var pathLength = path.getLength();
    if (pathLength < 3) {
      for (var i = 0; i < (3 - pathLength); i++) {
        path.push(path.getAt(pathLength - 1));
      }
    }
    var firstPoint = path.getAt(0);
    var lastPoint = path.getAt(pathLength - 1);
    if (!firstPoint.equals(lastPoint) || pathLength < 4) {
      path.push(path.getAt(0));
    }

    var wkt_string = 'POLYGON((';
    path.forEach(function (element, index) {
      wkt_string = wkt_string + roundNumber(element.lng(), 6) + ' ' + roundNumber(element.lat(), 6) + ',';
    });
    wkt_string = wkt_string.substring(0, wkt_string.length - 1) + '))';

    return wkt_string;
  };

  var wkt2polygon = function(wkt, options){
    var pattern = /(-?\d+(\.\d+)?\s-?\d+(\.\d+)?)/g;
    var points= [];
    while (match = pattern.exec(wkt)){
      var xY = match[0].split(/\s/);
      points.push(new google.maps.LatLng(xY[1], xY[0]));
    }

    var polygon = new google.maps.Polygon({
      paths: points,
      strokeColor: '#ffff00',
      strokeOpacity: 1,
      strokeWeight: 2,
      fillOpacity: 0.3,
      fillColor: "#eeee00",
      clickable: false,
      editable: true,
      zIndex: 100000,
      geodesic: true
    });
    if (options){
      polygon.setOptions(options);
    }

    return polygon;
  };


  var Layer = Overmap.Layer = function (layerName, layerMap) {
    var name = layerName,
      map = layerMap,
      isInDrawing = false,
      feature = null;

    this._listeners = {};

    Layer.Events = {
      DRAWING_STARTED: 'layer:drawing:started',
      DRAWING_FINISHED: 'layer:drawing:finished',
      DRAWING_COMPLETED: 'layer:drawing:completed',
      DRAWING_ABORTED: 'layer:drawing:aborted'
    };

    this.layerOptions = {
      strokeColor: '#ffff00',
      strokeOpacity: 1,
      strokeWeight: 2,
      fillOpacity: 0.3,
      fillColor: "#eeee00",
      clickable: false,
      editable: true,
      zIndex: 100000,
      geodesic: true
    };

    var setFeature = function (newFeature) {
      feature = newFeature;
      feature.setMap(map);
    };

    var setDrawingOn = function (state) {
      isInDrawing = state;
    };

    this.getName = function () {
      return name;
    };

    this.getMap = function () {
      return map;
    };

    this.getFeature = function () {
      return feature;
    };

    this.getFeatureAsWKT = function () {
      if (feature) {
        return polygon2wkt(feature);
      }
      return null;
    };

    this.setFeatureWithWKT = function(wkt){
      if (!this.isSomeoneDrawingOn() && wkt){
        this.update(DrawingManager.Events.SHAPE_DRAWING_STARTED);
        this.update(DrawingManager.Events.SHAPE_DRAWING_COMPLETED, wkt2polygon(wkt, this.layerOptions));
      }
    };

    this.isSomeoneDrawingOn = function () {
      return isInDrawing;
    };

    this.clearLayer = function () {
      if (feature && !this.isSomeoneDrawingOn()) {
        feature.setEditable(false);
        feature.setMap(null);
        feature = null;
      }
    };

    this.setEditable = function (state) {
      if (feature) {
        feature.setEditable(state);
      }
    };

    this.show = function () {
      if (feature) {
        feature.setMap(map);
      }
    };

    this.hide = function () {
      if (feature) {
        feature.setMap(null);
      }
    };

    this.update = function (event, arg) {
      switch (event) {
        case DrawingManager.Events.SHAPE_DRAWING_STARTED:
          this.clearLayer();
          setDrawingOn(true);
          this.trigger(Layer.Events.DRAWING_STARTED);
          break;

        case DrawingManager.Events.SHAPE_DRAWING_COMPLETED:
          setFeature(arg);
          setDrawingOn(false);
          this.trigger(Layer.Events.DRAWING_COMPLETED);
          break;

        case DrawingManager.Events.SHAPE_DRAWING_FINISHED:
          if (this.isSomeoneDrawingOn()) {
            this.trigger(Layer.Events.DRAWING_ABORTED);
          }
          setDrawingOn(false);
          this.trigger(Layer.Events.DRAWING_FINISHED);
          break;

        default:
          console.log('update notification not managed');
          break;
      }
    };
  };

  Layer.prototype.addListener = function (event, callback, context) {
    var eventListeners = this._listeners[event] || (this._listeners[event] = []);
    eventListeners.push({cbk: callback, ctx: context});
  };

  Layer.prototype.removeListener = function (event, callback) {
    var i,
      length,
      eventListeners = this._listeners[event],
      listener;

    if (eventListeners) {
      if (!callback) {
        this._listeners[event] = [];
        delete this._listeners[event];
        return;
      }

      for (i = 0, length = eventListeners.length; i < length; i++) {
        listener = eventListeners[i];
        if (callback && listener.cbk === callback) {
          eventListeners.splice(i, 1);
          if ((this._listeners.length) === 0) {
            delete this._listeners[event];
          }
          return;
        }
      }
    }
  };

  Layer.prototype.trigger = function (event) {
    if (!this._listeners) {
      return;
    }

    var args = [].slice.call(arguments, 1);
    var eventListeners = this._listeners[event];
    if (eventListeners) {
      notifyToListeners(eventListeners, args);
    }
  };

  Layer.prototype.removeAllListeners = function () {
    if (!this._listeners) {
      return;
    }

    for (var event in this._listeners) {
      this._listeners[event] = [];
      delete this._listeners[event];
    }
  };

  var notifyToListeners = function (listeners, args) {
    var listener,
      i = -1,
      l = listeners.length;

    while (++i < l) {
      (listener = listeners[i]).cbk.apply(listener.ctx, args);
    }
  };

  var roundNumber = function (num, decimal) {
    return (Math.round(num * Math.pow(10, decimal)) / Math.pow(10, decimal));
  };


  var DrawingManager = Overmap.DrawingManager = function (mapWidget) {
    this.map = mapWidget;
    this.overlayCompletListener = null;

    DrawingManager.Events = {
      SHAPE_DRAWING_STARTED: 'shape:drawing:started',
      SHAPE_DRAWING_FINISHED: 'shape:drawing:finished',
      SHAPE_DRAWING_COMPLETED: 'shape:drawing:completed'
    };


    var that = this;
    this.drawingManager = new google.maps.drawing.DrawingManager({
      drawingControl: false,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [
          google.maps.drawing.OverlayType.POLYGON
        ]
      },
      polygonOptions: that.overlayOptions
    });
    this.drawingManager.setMap(this.map);
    this.currentLayer = null;
  };

  DrawingManager.prototype.getDrawingManager = function () {
    return this.drawingManager;
  };

  DrawingManager.prototype.showDrawingManager = function () {
    this.drawingManager.setOptions({
      drawingControl: true
    });
  };

  DrawingManager.prototype.hideDrawingManager = function () {
    this.drawingManager.setOptions({
      drawingControl: false
    });
  };

  DrawingManager.prototype.startDrawOnLayer = function (layer) {
    var that = this;
    if (!this.currentLayer || !this.currentLayer.isSomeoneDrawingOn()) {
      this.currentLayer = layer;

      this.drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
      this.drawingManager.polygonOptions = this.currentLayer.layerOptions;
      this.currentLayer.update(DrawingManager.Events.SHAPE_DRAWING_STARTED);

      this.overlayCompleteListenerOnce = google.maps.event.addListenerOnce(this.drawingManager, 'overlaycomplete', function (e) {
        var newShape = e.overlay;
        newShape.type = e.type;
        that.currentLayer.update(DrawingManager.Events.SHAPE_DRAWING_COMPLETED, newShape);
        that.stopDraw();
      });
    }
  };

  DrawingManager.prototype.stopDraw = function () {
    if (this.currentLayer) {
      this.currentLayer.update(DrawingManager.Events.SHAPE_DRAWING_FINISHED);
      this.drawingManager.setDrawingMode(null);
      google.maps.event.removeListener(this.overlayCompleteListenerOnce);
    }
  };

}).call(this);