/*globals google, Audiolet, CONFIG */
/*globals MajorScale, Square, Pulse, Gain, PercussiveEnvelope, AudioletGroup, MulAdd, extend, PSequence */

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
      attack: Math.max(0.05, Math.floor(Math.pow(Math.random(), 3) * 30) / 10),
      release: Math.max(0.05, Math.floor(Math.pow(Math.random(), 3) * 30) / 10),
      icon: colors[index % colors.length],
      added: false
    };
    $('#featureSelect').append($('<option>')
      .text(type.replace(/^.*=/, '').replace(/_/g, ' ').replace(/\b[a-z]/, function (chr) { return chr.toUpperCase(); }))
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
    types[selectedType].octave = parseInt(this.value, 10);
  });
  $('#attack').on('input', function () {
    types[selectedType].attack = parseFloat(this.value);
  });
  $('#release').on('input', function () {
    types[selectedType].release = parseFloat(this.value);
  });
  $('#color').on('change', function () {
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

  var markerQueue = [];
  function createMarker(position, type) {
    var isMiddleMarker = !type;
    var m = new google.maps.Marker({
      clickable: !isMiddleMarker,
      position: position,
      animation: google.maps.Animation.DROP,
      icon: isMiddleMarker ? null : icon(types[type].icon)
    });
    markerQueue.push(m);
    setTimeout(function () {
      markerQueue.shift().setMap(map);
    }, Math.log(markerQueue.length) * 200);
    return m;
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
        google.maps.event.addListener(featureObj.marker, 'click', function() {
          playNote(featureObj);
          $('#featureSelect').val(featureObj.type).trigger('change');
        });
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
  centerMarker = createMarker(center, false);
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
      playNote(featureObj);
    });
  }

  function playNote(featureObj) {
    featureObj.marker.setAnimation(google.maps.Animation.BOUNCE);
    var synth = new Synth(audiolet, featureObj);
    synth.connect(audiolet.output);
  }

  var Synth = function(audiolet, featureObj) {

    this.featureObj = featureObj;
    type = types[featureObj.type];
    this.note = Math.floor((1 - featureObj.distance / distanceFactor) * 12);
    this.scale = new MajorScale();
    this.octave = types[featureObj.type].octave;

    var frequency = this.getFrequency();

    AudioletGroup.apply(this, [audiolet, 0, 1]);
    this.sine = new Triangle(this.audiolet, frequency);
    this.modulator = new Square(this.audiolet, frequency * 4);
    this.modulatorMulAdd = new MulAdd(this.audiolet, frequency / 2, frequency);

    this.gain = new Gain(this.audiolet);
    this.envelope = new PercussiveEnvelope(this.audiolet, 1, type.attack, type.release, function() {
      this.audiolet.scheduler.addRelative(0, function() {
        this.remove();
        featureObj.marker.setAnimation(null);

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

});
