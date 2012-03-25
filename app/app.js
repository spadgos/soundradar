/*globals google, Audiolet */
$(function(){

  var computeHeading = google.maps.geometry.spherical.computeHeading,
      computeDistanceBetween = google.maps.geometry.spherical.computeDistanceBetween,
      map,
      centerMarker,
      features = [],
      mapElement = document.getElementById("map_canvas"),
      centerCoords = localStorage.getItem('center') ? JSON.parse(localStorage.getItem('center')) : [52.371, 4.895],
      center = new google.maps.LatLng(centerCoords[0], centerCoords[1]),
      audiolet = new Audiolet(),
      icon = function (color) {
        return 'http://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_' + color + '.png';
      },
      colors = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'brown', 'black', 'white', 'gray'],
      distanceFactor,
      selectedType,
      types = {
        'amenity=parking': {},
        'amenity=school': {},
        'amenity=place_of_worship': {},
        'amenity=restaurant': {},
        'amenity=bench': {},
        'amenity=fuel': {},
        'amenity=grave_yard': {},
        'amenity=post_box': {},
        'amenity=kindergarten': {},
        'amenity=bank': {},
        'amenity=fast_food': {},
        'amenity=hospital': {},
        'amenity=post_office': {},
        'amenity=cafe': {},
        'amenity=recycling': {},
        'amenity=pub': {},
        'amenity=public_building': {},
        'amenity=pharmacy': {},
        'amenity=telephone': {},
        'amenity=fire_station': {},
        'amenity=police': {},
        'amenity=bicycle_parking': {},
        'amenity=toilets': {},
        'amenity=swimming_pool': {},
        'amenity=atm': {},
        'amenity=townhall': {},
        'amenity=library': {},
        'amenity=drinking_water': {},
        'amenity=shelter': {},
        'amenity=waste_basket': {},
        'leisure=pitch': {},
        'leisure=park': {},
        'leisure=swimming_pool': {},
        'leisure=playground': {},
        'leisure=garden': {},
        'leisure=sports_centre': {},
        'leisure=nature_reserve': {},
        'leisure=common': {},
        'leisure=stadium': {},
        'leisure=track': {},
        'leisure=golf_course': {},
        'leisure=recreation_ground': {},
        'leisure=slipway': {},
        'public_transport=stop_position': {},
        'power=tower': {},
        'power=pole': {},
        'power=line': {},
        'power=generator': {},
        'power=sub_station': {},
        'power=minor_line': {},
        'power=station': {},
        'power=cable_distribution_cabinet': {},
        'power=transformer': {}
      },
      allTypes = Object.keys(types);

  allTypes.forEach(function (type, index) {
    types[type] = {
      octave: Math.floor(Math.random() * 6 + 2),
      attack: Math.floor(Math.pow(Math.random(), 2) * 30) / 10,
      release: Math.floor(Math.pow(Math.random(), 2) * 30) / 10,
      icon: colors[index % colors.length],
      added: false
    };
    $('#featureSelect').append($('<option>')
      .text(type)
      .val(type)
    );
  });
  $('#featureSelect').change(function () {
    var type = types[selectedType = $(this).val()];
    $('#octave').val(type.octave);
    $('#attack').val(type.attack);
    $('#release').val(type.release);
    $('#color').val(type.icon);
    $('#addLabel').toggle(!type.added, 'slow');
  }).trigger('change');
  $('#playLabel').hide();
  $('#add').click(function (e) {
    e.preventDefault();
    var type = $('#featureSelect').val();
    $('#addLabel').hide();
    types[type].added = true;
    addFeature(type).done(function () {
      $('#playLabel').show('slow');
    });
  });
  $('#octave').on('input', function () {
    console.log(types[selectedType].octave = parseInt(this.value, 10));
  });
  $('#attack').on('input', function () {
    types[selectedType].attack = parseFloat(this.value);
  });
  $('#release').on('input', function () {
    types[selectedType].release = parseFloat(this.value);
  });
  $('#color').on('input', function () {
    var t = types[selectedType];
    t.icon = $(this).val();
    if (t.added) {
      features.forEach(function (featureObj) {
        if (featureObj.type === selectedType) {
          featureObj.marker.setIcon(icon(t.icon));
        }
      });
    }
  });
  $('#bpm').on('input', function () {
    audiolet.scheduler.setTempo(parseInt($('#bpm').val(), 10));
  });

  $('#play').click(function (e) {
    e.preventDefault();
    play();
  });
  $('#loading').ajaxStart(function () {
    $(this).show();
  }).ajaxStop(function () {
    $(this).hide();
  }).hide();

  function addFeature(type) {
    var mapBounds = map.getBounds();
    calculateDistanceFactor();
    return getFeatures(type, mapBounds);
  }

  function createMarker(position, type) {
    return new google.maps.Marker({
      map: map,
      clickable: false,
      position: position,
      icon: types[type] && icon(types[type].icon)
    });
  }

  function calculateDistanceFactor() {
    var mapBounds = map.getBounds();
    distanceFactor = computeDistanceBetween(mapBounds.getNorthEast(), mapBounds.getSouthWest()) / 2;
  }

  function sortFeatures() {
    features.sort(function(a, b) {
      return a.heading < b.heading ? -1 : 1;
    });
  }

  function getFeatures(type, bounds) {
    var boundsCenter = bounds.getCenter(),
        ne = bounds.getNorthEast(),
        sw = bounds.getSouthWest(),
        n = ne.lat(),
        e = ne.lng(),
        s = sw.lat(),
        w = sw.lng(),
        resultObjects;

    var deferred = $.Deferred();
    var url = CONFIG.api + '/node[' + type + '][bbox=' + [w, s, e, n].join(',') + ']';

    $.ajax({
      url : url,
      dataType: 'xml'
    }).done(function (xml) {
      resultObjects = $(xml).find('node').map(function (node) {
        var latLng = new google.maps.LatLng(parseFloat(this.getAttribute('lat')), parseFloat(this.getAttribute('lon')));
        return {
          type: type,
          latLng: latLng,
          heading: (computeHeading(boundsCenter, latLng) + 360) % 360,
          distance: computeDistanceBetween(boundsCenter, latLng)
        };
      }).get();
      features.splice.apply(features, [features.length, 0].concat(resultObjects));
      sortFeatures();
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
  centerMarker = createMarker(center, true);
  google.maps.event.addListener(map, 'center_changed', function() {
    var mapCenter = map.getCenter(),
        mapBounds = map.getBounds();

    calculateDistanceFactor();
    centerMarker.setPosition(mapCenter);
    features = features.filter(function(featureObj) {
      if (mapBounds.contains(featureObj.latLng)) {
        return true;
      } else {
        featureObj.marker.setMap(null);
        return false;
      }
    });
    features.forEach(function(featureObj) {
      featureObj.heading = (computeHeading(mapCenter, featureObj.latLng) + 360) % 360;
      featureObj.distance = computeDistanceBetween(mapCenter, featureObj.latLng);
    });
    sortFeatures();
    localStorage.setItem('center', JSON.stringify([mapCenter.lat(), mapCenter.lng()]));
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
    this.envelope = new PercussiveEnvelope(this.audiolet, 1, 0.2, .1, function() {
      this.audiolet.scheduler.addRelative(0, function() {
        this.remove();
        featureObj.marker.setIcon(icon(types[featureObj.type].icon));
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

  function play() {
    var durations = [],
        delta;

    for (var i = 0, l = features.length; i < l; i++) {
      if ( i === l - 1) {
        delta = 360 - features[i].heading;
      } else {
        delta = features[i+1].heading - features[i].heading;
      }
      durations.push(delta/10);
    }

    var dSeq = new PSequence(durations);
    var fSeq = new PSequence(features);
    audiolet.scheduler.play([fSeq], dSeq, function(featureObj) {
      featureObj.marker.setIcon('http://www.google.com/mapfiles/dd-start.png');
      var synth = new Synth(audiolet, featureObj);
      synth.connect(audiolet.output);
    });
  }
  window.play = play;
});
