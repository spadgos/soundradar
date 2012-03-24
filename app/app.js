$(function(){

  var computeHeading = google.maps.geometry.spherical.computeHeading,
      computeDistanceBetween = google.maps.geometry.spherical.computeDistanceBetween,
      map,
      mapElement = document.getElementById("map_canvas"),
      center = new google.maps.LatLng(52.371, 4.895);

  function getFeatures(category, type, bounds) {
    var ne = bounds.getNorthEast(),
        sw = bounds.getSouthWest(),
        n = ne.lat(),
        e = ne.lng(),
        s = sw.lat(),
        w = sw.lng();

    var deferred = $.Deferred();
    var url = CONFIG.api + '/node[' + category + '=' + type + '][bbox=' + [w, s, e, n].join(',') + ']';

    $.ajax({
      url : url,
      dataType: 'xml'
    }).done(function (xml) {
      var features = $(xml).find('node').map(function (node) {
        return new google.maps.LatLng(parseFloat(this.getAttribute('lat')), parseFloat(this.getAttribute('lon')));
      }).get();
      deferred.resolve(features);
    }).fail(deferred.reject);

    return deferred;
  }

  function getMapBounds() {
    return map.getBounds();
  }

  map = new google.maps.Map(mapElement, {
    center:    center,
    zoom:      15,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  });

  setTimeout(function(){
    getFeatures('amenity', 'bar', getMapBounds()).done(function(features){
      console.log(features);
      features.forEach(function(featureLatLng){
        var featureMarker = new google.maps.Marker({
          map: map,
          clickable: false,
          position: featureLatLng
        })
      })
    });

  }, 3000)

});
