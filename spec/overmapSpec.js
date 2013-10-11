
var fake = {
  polygon: (function(){
    var points = [
      new google.maps.LatLng(0.0, 0.0),
      new google.maps.LatLng(1.0, 0.0),
      new google.maps.LatLng(1.0, 1.0),
      new google.maps.LatLng(0.0, 1.0),
      new google.maps.LatLng(0.0, 0.0)
    ];

    return new google.maps.Polygon({
      paths: points,
      strokeColor: '#000',
      strokeOpacity: 1,
      strokeWeight: 2,
      fillColor:  '#000',
      fillOpacity: 0.8
    });
  }()),

  triggerOverlayCompleted: function(drawingManager){
    google.maps.event.trigger(drawingManager, "overlaycomplete",
      {
        overlay: this.polygon,
        type:google.maps.drawing.OverlayType.POLYGON
      }
    );
  }

};


describe("Overmap", function() {
  var map, drawingManager;

  beforeEach(function() {

    var mapOptions = {
      zoom:6,
      center:this.mapCenter,
      mapTypeId:google.maps.MapTypeId.HYBRID,
      panControl:true,
      streetViewControl:false,
      mapTypeControl:true,
      disableDoubleClickZoom:true,
      mapTypeControlOptions:{
        style:google.maps.MapTypeControlStyle.DEFAULT,
        position:google.maps.ControlPosition.TOP_RIGHT
      }
    };

    map = new google.maps.Map(document.getElementById('map'), mapOptions);
    drawingManager = new Overmap.DrawingManager(map);
  });

  it("should correctly initialize a layer on a map", function() {
    var layer = new Overmap.Layer('layer', map);
    expect(layer.getMap()).toEqual(map);
    expect(layer.getName()).toEqual('layer');
    expect(layer.getFeature()).toEqual(null);
    expect(layer.isSomeoneDrawingOn()).toEqual(false);
  });

  describe("listeners", function(){
    var layer,
      otherLayer,
      layerListener, otherListener;


    beforeEach(function(){
      layer = new Overmap.Layer('drawingLayer', map);
      otherLayer = new Overmap.Layer('otherLayer', map);

      layerListener = jasmine.createSpy('EventListener');
      otherListener = jasmine.createSpy('EventListener');
    });

    it("should handle drawing started", function(){
      layer.addListener(Overmap.Layer.Events.DRAWING_STARTED, layerListener, this);
      otherLayer.addListener(Overmap.Layer.Events.DRAWING_STARTED, otherListener, this);
      drawingManager.startDrawOnLayer(layer);

      expect(layerListener).toHaveBeenCalled();
      expect(otherListener).not.toHaveBeenCalled();

      expect(layer.isSomeoneDrawingOn()).toBeTruthy();
      expect(otherLayer.isSomeoneDrawingOn()).toBeFalsy();
    });

    it("should handle drawing complete", function(){
      layer.addListener(Overmap.Layer.Events.DRAWING_COMPLETED, layerListener, this);
      layer.addListener(Overmap.Layer.Events.DRAWING_FINISHED, otherListener, this);
      drawingManager.startDrawOnLayer(layer);

      expect(layer.isSomeoneDrawingOn()).toBeTruthy();
      fake.triggerOverlayCompleted(drawingManager.getDrawingManager());

      expect(layerListener).toHaveBeenCalled();
      expect(layer.getFeature()).toEqual(fake.polygon);


      expect(otherListener).toHaveBeenCalled();
    });

    it("should handle drawing aborted", function(){
      layer.addListener(Overmap.Layer.Events.DRAWING_ABORTED, layerListener, this);
      layer.addListener(Overmap.Layer.Events.DRAWING_FINISHED, otherListener, this);
      drawingManager.startDrawOnLayer(layer);

      expect(layer.isSomeoneDrawingOn()).toBeTruthy();
      drawingManager.stopDraw();
      expect(layerListener).toHaveBeenCalled();

    });

    it("should export shape in wkt format", function(){
      layer.addListener(Overmap.Layer.Events.DRAWING_COMPLETED, layerListener, this);
      layer.addListener(Overmap.Layer.Events.DRAWING_FINISHED, otherListener, this);
      drawingManager.startDrawOnLayer(layer);

      expect(layer.isSomeoneDrawingOn()).toBeTruthy();
      fake.triggerOverlayCompleted(drawingManager.getDrawingManager());

      expect(layerListener).toHaveBeenCalled();
      expect(layer.getFeatureAsWKT()).toEqual('POLYGON((0 0,0 1,1 1,1 0,0 0))');
    });

    it("should set layer shape from wkt", function(){
      layer.addListener(Overmap.Layer.Events.DRAWING_STARTED, otherListener, this);
      layer.addListener(Overmap.Layer.Events.DRAWING_COMPLETED, layerListener, this);
      layer.setFeatureWithWKT('POLYGON((0 0,0 1,1 1,1 0,0 0))');

      expect(otherListener).toHaveBeenCalled();
      expect(layerListener).toHaveBeenCalled();
      expect(layer.getFeatureAsWKT()).toEqual('POLYGON((0 0,0 1,1 1,1 0,0 0))');
    });



  });

});





