$(function(){

  var computeHeading = google.maps.geometry.spherical.computeHeading,
      computeDistanceBetween = google.maps.geometry.spherical.computeDistanceBetween,
      map,
      mapElement = document.getElementById("map_canvas"),
      center = new google.maps.LatLng(52.371, 4.895);

  function getMarker(position) {
      new google.maps.Marker({
        map: map,
        clickable: false,
        position: position,
        icon: 'http://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_red.png'
      })
  }

  function getFeatures(category, type, bounds) {
    var boundsCenter = bounds.getCenter(),
        ne = bounds.getNorthEast(),
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
        var latLng = new google.maps.LatLng(parseFloat(this.getAttribute('lat')), parseFloat(this.getAttribute('lon')));
        return {
          type: category + '=' + type,
          latLng: latLng,
          heading: computeHeading(boundsCenter, latLng),
          distance: computeDistanceBetween(boundsCenter, latLng)
        };
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
      features.forEach(function(featureObj){
        var featureMarker = getMarker(featureObj.latLng);
      });

    });

  }, 3000)

});
