$(function(){

  var computeHeading = google.maps.geometry.spherical.computeHeading,
      computeDistanceBetween = google.maps.geometry.spherical.computeDistanceBetween,
      map,
      features = [],
      mapElement = document.getElementById("map_canvas"),
      center = new google.maps.LatLng(52.371, 4.895),
      audiolet = new Audiolet(),
      icon = function (color) {
        return 'http://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_' + color + '.png'
      },
      distanceFactor,
      types = {
        'amenity=pub' : {
          iconColor: icon('red'),
          octave: 5
        },
        'amenity=place_of_worship' : {
          iconColor: icon('green'),
          octave: 5
        },
        'amenity=fast_food' : {
          iconColor: icon('purple'),
          octave: 5
        }
      };

  function createMarker(position, type) {
      return new google.maps.Marker({
        map: map,
        clickable: false,
        position: position,
        icon: types[type] && types[type].iconColor
      })
  }

  function getFeatures(category, type, bounds) {
    var boundsCenter = bounds.getCenter(),
        ne = bounds.getNorthEast(),
        sw = bounds.getSouthWest(),
        n = ne.lat(),
        e = ne.lng(),
        s = sw.lat(),
        w = sw.lng(),
        resultObjects;

    var deferred = $.Deferred();
    var url = CONFIG.api + '/node[' + category + '=' + type + '][bbox=' + [w, s, e, n].join(',') + ']';

    $.ajax({
      url : url,
      dataType: 'xml'
    }).done(function (xml) {
      var resultObjects = $(xml).find('node').map(function (node) {
        var latLng = new google.maps.LatLng(parseFloat(this.getAttribute('lat')), parseFloat(this.getAttribute('lon')));
        return {
          type: category + '=' + type,
          latLng: latLng,
          heading: (computeHeading(boundsCenter, latLng) + 360) % 360,
          distance: computeDistanceBetween(boundsCenter, latLng)
        };
      }).get();
      features.splice.apply(features, [features.length, 0].concat(resultObjects));
      features.sort(function(a, b) {
        return a.heading < b.heading ? -1 : 1;
      });
      resultObjects.forEach(function(featureObj) {
        featureObj.marker = createMarker(featureObj.latLng, featureObj.type);
      });
      deferred.resolve(resultObjects);
    }).fail(deferred.reject);

    return deferred;
  }

  map = new google.maps.Map(mapElement, {
    center:    center,
    zoom:      15,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  });
  createMarker(center, true);
  google.maps.event.addListener(map, 'center_changed', function() {

  });

  var Synth = function(audiolet, featureObj) {
    this.featureObj = featureObj;
    this.note = Math.floor((1 - featureObj.distance/distanceFactor)* 12),
    this.scale = new MajorScale();
    this.octave = types[featureObj.type].octave;

    var frequency = this.getFrequency();

    AudioletGroup.apply(this, [audiolet, 0, 1]);
    this.sine = new Square(this.audiolet, frequency);
    this.modulator = new Pulse(this.audiolet, frequency * 2);
    this.modulatorMulAdd = new MulAdd(this.audiolet, frequency / 2, frequency);

    this.gain = new Gain(this.audiolet);
    this.envelope = new PercussiveEnvelope(this.audiolet, 1, 0.7, 1, function() {
      this.audiolet.scheduler.addRelative(0, function() {
        this.remove();
        featureObj.marker.setIcon(types[featureObj.type].iconColor);
      }.bind(this));
    }.bind(this));
    this.modulator.connect(this.modulatorMulAdd);
    this.modulatorMulAdd.connect(this.sine);
    this.envelope.connect(this.gain, 0, 1);
    this.sine.connect(this.gain);
    this.gain.connect(this.outputs[0]);
  };
  extend(Synth, AudioletGroup);

  Synth.prototype.getFrequency = function() {
    return this.scale.getFrequency(this.note, 16.352, this.octave);
  };

  window.play = function() {
    var durations = [],
        delta;

    for (var i = 0, l = features.length; i < l; i++) {
      if ( i == l-1) {
        delta = 360 - features[i].heading;
      } else {
        delta = features[i+1].heading - features[i].heading;
      }
      durations.push(delta/10);
    }

    var dSeq = new PSequence(durations);
    var fSeq = new PSequence(features);
    audiolet.scheduler.play([fSeq], dSeq, function(featureObj) {
      featureObj.marker.setIcon(icon('yellow'));
      var synth = new Synth(audiolet, featureObj);
      synth.connect(audiolet.output);
    });
  };

  setTimeout(function(){
    var mapBounds = map.getBounds();
    distanceFactor = computeDistanceBetween(mapBounds.getNorthEast(), mapBounds.getSouthWest()) / 2;
    getFeatures('amenity', 'pub', mapBounds);
    getFeatures('amenity', 'fast_food', mapBounds);
    getFeatures('amenity', 'place_of_worship', mapBounds);
  }, 500)
});
