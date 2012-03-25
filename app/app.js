/*globals google, Audiolet, CONFIG, Triangle */
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
      gain: 0.7,
      icon: colors[index % colors.length],
      added: false
    };
    $('#featureSelect').append($('<option>')
      .text(type.replace(/^.*=/, '').replace(/_/g, ' ').replace(/\b[a-z]/, function (chr) { return chr.toUpperCase(); }))
      .val(type)
    );
  });

  /////////////
  // UI SHIT //
  /////////////
  $('#playLabel').hide();

  $('#featureSelect').change(function () {
    var type = types[selectedType = $(this).val()];
    $('#octave').val(type.octave);
    $('#attack').val(type.attack);
    $('#release').val(type.release);
    $('#gain').val(type.gain);
    $('#color').val(type.icon);
    $('#add').toggle(!type.added, 'slow');
    $('#remove').toggle(type.added);
  }).trigger('change');


  $('#add').click(function (e) {
    e.preventDefault();
    var type = $('#featureSelect').val();
    $('#addLabel').hide();
    $(this).hide();
    $('#remove').show();
    types[type].added = true;
    addFeature(type);
  });
  $('#remove').click(function (e) {
    e.preventDefault();
    remove(selectedType);
    $('#remove').hide();
    $('#add').show();
  });
  $('#octave').on('input', function () {
    types[selectedType].octave = parseInt(this.value, 10);
  });
  $('#attack').on('input', function () {
    types[selectedType].attack = parseFloat(this.value);
  });
  $('#gain').on('input', function () {
    types[selectedType].gain = parseFloat(this.value);
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
  $('#pause').click(function (e) {
    e.preventDefault();
    pause();
  });
  $('#loading').ajaxStart(function () {
    $(this).show();
  }).ajaxStop(function () {
    $(this).hide();
  }).hide();

  $('#aboutLink').click(function (e) {
    e.preventDefault();
    $('#about').removeClass('hidden');
  });
  $('#about .shade').click(function () {
    $('#about').addClass('hidden');
  });

  $('#link').on('mouseenter', function () {
    this.href = '#' + generateLink();
  });

  ////////////////////////////////////////////

  function addFeature(type) {
    var mapBounds = map.getBounds();
    // calculateDistanceFactor();
    return getFeatures(type, mapBounds).done(function () {
      $('#addLabel').show('slow');
      $('#playLabel').show('slow');
    });
  }

  function generateLink() {
    var i, type, ret = {}, center = map.getCenter();
    ret._ = [
      center.lat(),
      center.lng(),
      map.getZoom()
    ];
    for (i in types) {
      if (types.hasOwnProperty(i)) {
        type = types[i];
        if (type.added) {
          ret[i] = {
            o: type.octave,
            a: type.attack,
            r: type.release,
            g: type.gain,
            c: type.icon
          };
        }
      }
    }
    return JSON.stringify(ret);
  }

  // function parseLink()

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

  function remove(type) {
    var featureObj,
        kill = function (f) {
          return function () {
            f.marker.setMap(null);
          };
        };
    for (var i = features.length; i--;) {
      featureObj = features[i];
      if (featureObj.type === type) {
        features.splice(i, 1);
        featureObj.marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(kill(featureObj), 1125);
      }
    }
    types[type].added = false;
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

  (function () {
    var zoom = 15;
    if (window.location.hash.length > 1) {
      var hash = window.location.hash.substr(1),
          info, i;
      try {
        // {"_":[52.371124458365045,4.888959665298436],"amenity=parking":{"o":2,"a":2.6,"r":0.8,"g":0.7,"c":"red"}}
        info = JSON.parse(hash);
        for (i in info) {
          if (i === '_') {
            center = new google.maps.LatLng(info._[0], info._[1]);
            zoom = info._[2];
          } else {
            types[i].attack = info[i].a;
            types[i].release = info[i].r;
            types[i].octave = info[i].o;
            types[i].gain = info[i].g;
            types[i].icon = info[i].c;
            types[i].added = true;
            setTimeout(addFeature.bind(null, i), 250);
          }
        }
      } catch (e) {}
    }
    map = new google.maps.Map(mapElement, {
      center:    center,
      zoom:      zoom,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });
  }());
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
  var nowPlaying;
  function play() {
    if ($('#play').hasClass('sc-button-selected')) {
      return;
    }
    $('#play').addClass('sc-button-selected');
    var durations = [],
        delta, i, l;

    for (i = 0, l = features.length; i < l; i++) {
      if (i === l - 1) {
        delta = 360 - features[i].heading;
      } else {
        delta = features[i+1].heading - features[i].heading;
      }
      durations.push(delta/10);
    }
    durations.push(1);
    var dSeq = new PSequence(durations);
    nowPlaying = [new PSequence(features.concat(0xDEADBEEF))];
    audiolet.scheduler.play(nowPlaying, dSeq, function(featureObj) {
      if (featureObj === 0xDEADBEEF) {
        pause();
        return;
      }
      playNote(featureObj);
    });
  }

  function pause() {
    $('#play').removeClass('sc-button-selected');
    if (nowPlaying) {
      nowPlaying[0].list = []; // cheating? yes.
    }
  }

  function playNote(featureObj) {
    featureObj.marker.setAnimation(google.maps.Animation.BOUNCE);
    var synth = new Synth(audiolet, featureObj);
    synth.connect(audiolet.output);
  }

  var Synth = function(audiolet, featureObj) {

    this.featureObj = featureObj;
    var type = types[featureObj.type];
    this.note = Math.floor((1 - featureObj.distance / distanceFactor) * 12);
    this.scale = new MajorScale();
    this.octave = type.octave;

    var frequency = this.getFrequency();

    AudioletGroup.apply(this, [audiolet, 0, 1]);
    this.sine = new Triangle(this.audiolet, frequency);
    this.modulator = new Square(this.audiolet, frequency * 4);
    this.modulatorMulAdd = new MulAdd(this.audiolet, frequency / 2, frequency);

    this.gain = new Gain(this.audiolet);
    this.envelope = new PercussiveEnvelope(this.audiolet, type.gain, type.attack, type.release, function() {
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
