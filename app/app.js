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
      return {
        lat: parseFloat(this.getAttribute('lat')),
        lon: parseFloat(this.getAttribute('lon'))
      };
    }).get();
    deferred.resolve(features);
  }).fail(deferred.reject);

  return deferred;
}
