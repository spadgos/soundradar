$(function(){

  var computeHeading = google.maps.geometry.spherical.computeHeading,
      computeDistanceBetween = google.maps.geometry.spherical.computeDistanceBetween,
      map,
      features,
      mapElement = document.getElementById("map_canvas"),
      center = new google.maps.LatLng(52.371, 4.895),
      audiolet = new Audiolet(),
      redIcon = 'http://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_red.png',
      greenIcon = 'http://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_green.png',
      distanceFactor,
      freqRange = [220,1760];

  function createMarker(position, bigIcon) {
      return new google.maps.Marker({
        map: map,
        clickable: false,
        position: position,
        icon: bigIcon ? undefined : redIcon
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
      features = $(xml).find('node').map(function (node) {
        var latLng = new google.maps.LatLng(parseFloat(this.getAttribute('lat')), parseFloat(this.getAttribute('lon')));
        return {
          type: category + '=' + type,
          latLng: latLng,
          heading: (computeHeading(boundsCenter, latLng) + 360) % 360,
          distance: computeDistanceBetween(boundsCenter, latLng)
        };
      }).get();
      features.sort(function(a, b) {
        return a.heading < b.heading ? -1 : 1;
      });
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
  createMarker(center, true);

  var Synth = function(audiolet, featureObj) {
    var frequency = (1 - featureObj.distance/distanceFactor)*(freqRange[1] - freqRange[0]) + freqRange[0];
    AudioletGroup.apply(this, [audiolet, 0, 1]);
    this.sine = new Sine(this.audiolet, frequency);
    this.modulator = new Saw(this.audiolet, frequency * 2);
    this.modulatorMulAdd = new MulAdd(this.audiolet, frequency / 2, frequency);

    this.gain = new Gain(this.audiolet);
    this.envelope = new PercussiveEnvelope(this.audiolet, 1, 0.2, 0.5, function() {
      this.audiolet.scheduler.addRelative(0, function(){
        this.remove();
        featureObj.marker.setIcon(redIcon);
      }.bind(this));
    }.bind(this));

    this.modulator.connect(this.modulatorMulAdd);
    this.modulatorMulAdd.connect(this.sine);
    this.envelope.connect(this.gain, 0, 1);
    this.sine.connect(this.gain);
    this.gain.connect(this.outputs[0]);
  };
  extend(Synth, AudioletGroup);

  window.play = function() {
    var durations = [],
        frequencies = [],
        freq,
        delta;

    for (var i = 0, l = features.length; i < l; i++) {
      if ( i == l-1) {
        delta = 360 - features[i].heading;
      } else {
        delta = features[i+1].heading - features[i].heading;
      }
      freq = (1 - features[i].distance/distanceFactor)*(freqRange[1] - freqRange[0]) + freqRange[0];

      frequencies.push(freq);
      durations.push(delta/10);
    }

    var dSeq = new PSequence(durations);
    var fSeq = new PSequence(features);
    audiolet.scheduler.play([fSeq], dSeq, function(featureObj) {
      featureObj.marker.setIcon(greenIcon);
      var synth = new Synth(audiolet, featureObj);
      synth.connect(audiolet.output);
    });
  };

  setTimeout(function(){
    var mapBounds = getMapBounds();
    distanceFactor = computeDistanceBetween(mapBounds.getNorthEast(), mapBounds.getSouthWest()) / 2;
    getFeatures('amenity', 'bar', mapBounds).done(function(features){
      features.forEach(function(featureObj){
        featureObj.marker = createMarker(featureObj.latLng);
      });

    });

  }, 3000)

});
