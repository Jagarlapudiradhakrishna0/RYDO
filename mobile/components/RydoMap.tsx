import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from 'react';
import { StyleSheet, View, ViewStyle, Platform, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
};

export type CrewMember = {
  id?: string;
  _id?: string;
  name?: string;
  latitude: number;
  longitude: number;
  isLive?: boolean;
  role?: string;
};

export type RouteStop = {
  latitude: number;
  longitude: number;
  name?: string;
};

export type SosEventMarker = {
  latitude: number;
  longitude: number;
  name?: string;
  role?: string;
  eventId?: string;
};

export type RydoMapRef = {
  animateToRegion: (region: MapRegion, duration?: number) => void;
  fitToCoordinates: (
    coordinates: Coordinate[],
    options?: { edgePadding?: any; animated?: boolean }
  ) => void;
  animateCamera: (options: { center?: Coordinate; zoom?: number }, config?: { duration?: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
};

export type RydoMapProps = {
  style?: ViewStyle;
  initialRegion?: MapRegion;
  roadRoute?: Coordinate[];
  emergencyRoute?: Coordinate[];
  captainLocation?: { latitude: number; longitude: number; name?: string; heading?: number } | null;
  riderLocation?: { latitude: number; longitude: number; name?: string } | null;
  liveRiders?: CrewMember[];
  startLocation?: { latitude: number; longitude: number; name?: string } | null;
  stops?: RouteStop[];
  destinationLocation?: { latitude: number; longitude: number; name?: string } | null;
  activeSosEvent?: SosEventMarker | null;
  onMapReady?: () => void;
  onSosPress?: (sos: SosEventMarker) => void;
  onRiderPress?: (rider: CrewMember) => void;
  showUserLocation?: boolean;
  showControls?: boolean;
};

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
      box-sizing: border-box;
    }
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #121212;
      touch-action: pan-x pan-y pinch-zoom;
    }
    .leaflet-control-attribution {
      display: none !important;
    }
    .leaflet-control-zoom {
      display: none !important;
    }
    
    /* CUSTOM MARKER STYLES */
    .captain-marker {
      width: 38px;
      height: 38px;
      border-radius: 19px;
      background: #1677FF;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 0 14px rgba(22, 119, 255, 0.9), 0 3px 6px rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 900;
      font-size: 15px;
      font-family: sans-serif;
    }
    .rider-marker {
      width: 32px;
      height: 32px;
      border-radius: 16px;
      background: #147BFF;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 0 12px rgba(20, 123, 255, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rider-marker-inner {
      width: 10px;
      height: 10px;
      border-radius: 5px;
      background: #FFFFFF;
    }
    .crew-marker {
      width: 32px;
      height: 32px;
      border-radius: 16px;
      background: #1677FF;
      border: 2px solid #22C55E;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 13px;
      font-family: sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }
    .crew-marker.offline {
      background: #333333;
      border-color: #777777;
    }
    .start-marker {
      width: 32px;
      height: 32px;
      border-radius: 16px;
      background: #22C55E;
      border: 2.5px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 900;
      font-size: 14px;
      font-family: sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }
    .stop-marker {
      width: 28px;
      height: 28px;
      border-radius: 14px;
      background: #F59E0B;
      border: 2px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 12px;
      font-family: sans-serif;
      box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    }
    .destination-marker {
      width: 34px;
      height: 34px;
      border-radius: 17px;
      background: #EF4444;
      border: 2.5px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 900;
      font-size: 16px;
      font-family: sans-serif;
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.8);
    }
    .sos-marker {
      width: 44px;
      height: 44px;
      border-radius: 22px;
      background: #DC2626;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 18px #EF4444, 0 4px 8px rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      animation: pulse 1.2s infinite;
      cursor: pointer;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.18); box-shadow: 0 0 25px #EF4444; }
      100% { transform: scale(1); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var markers = {};
    var routePolyline = null;
    var emergencyPolyline = null;
    var currentData = {};
    var lastRouteHash = '';

    function initMap(lat, lng, zoom) {
      map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        boxZoom: true,
        tap: false
      }).setView([lat, lng], zoom || 14);

      // OpenStreetMap Standard Tiles (100% Free, Public, Reliable)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map);

      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
    }

    function createDivIcon(html, size, anchor) {
      return L.divIcon({
        className: 'custom-icon',
        html: html,
        iconSize: size || [32, 32],
        iconAnchor: anchor || [size ? size[0]/2 : 16, size ? size[1]/2 : 16]
      });
    }

    window.updateMapData = function(jsonStr) {
      if (!map) return;
      try {
        var data = JSON.parse(jsonStr);
        currentData = data;

        // 1. ROUTE POLYLINE (BLUE) - ONLY update when coordinates actually change to prevent blinking
        if (data.roadRoute && data.roadRoute.length > 1) {
          var firstPt = data.roadRoute[0] || {};
          var lastPt = data.roadRoute[data.roadRoute.length - 1] || {};
          var routeHash = data.roadRoute.length + '_' + Number(firstPt.latitude).toFixed(5) + '_' + Number(firstPt.longitude).toFixed(5) + '_' + Number(lastPt.latitude).toFixed(5) + '_' + Number(lastPt.longitude).toFixed(5);
          if (lastRouteHash !== routeHash || !routePolyline) {
            lastRouteHash = routeHash;
            var latlngs = data.roadRoute.map(function(c) { return [c.latitude, c.longitude]; });
            if (routePolyline) {
              routePolyline.setLatLngs(latlngs);
            } else {
              routePolyline = L.polyline(latlngs, {
                color: '#1677FF',
                weight: 6,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);
            }
          }
        } else if (routePolyline) {
          map.removeLayer(routePolyline);
          routePolyline = null;
          lastRouteHash = '';
        }

        // 2. EMERGENCY SOS POLYLINE (RED)
        if (data.emergencyRoute && data.emergencyRoute.length > 1) {
          var eLatlngs = data.emergencyRoute.map(function(c) { return [c.latitude, c.longitude]; });
          if (emergencyPolyline) {
            emergencyPolyline.setLatLngs(eLatlngs);
          } else {
            emergencyPolyline = L.polyline(eLatlngs, {
              color: '#EF4444',
              weight: 6,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          }
        } else if (emergencyPolyline) {
          map.removeLayer(emergencyPolyline);
          emergencyPolyline = null;
        }

        // 3. CAPTAIN MARKER
        if (data.captainLocation && Number.isFinite(data.captainLocation.latitude)) {
          var cPos = [data.captainLocation.latitude, data.captainLocation.longitude];
          if (markers['captain']) {
            markers['captain'].setLatLng(cPos);
          } else {
            markers['captain'] = L.marker(cPos, {
              icon: createDivIcon('<div class="captain-marker">C</div>', [38, 38], [19, 19]),
              zIndexOffset: 500
            }).addTo(map);
            markers['captain'].bindPopup('<b>' + (data.captainLocation.name || 'Captain') + '</b><br>Ride Captain');
          }
        } else if (markers['captain']) {
          map.removeLayer(markers['captain']);
          delete markers['captain'];
        }

        // 4. RIDER (YOU) MARKER
        if (data.riderLocation && Number.isFinite(data.riderLocation.latitude)) {
          var rPos = [data.riderLocation.latitude, data.riderLocation.longitude];
          if (markers['rider']) {
            markers['rider'].setLatLng(rPos);
          } else {
            markers['rider'] = L.marker(rPos, {
              icon: createDivIcon('<div class="rider-marker"><div class="rider-marker-inner"></div></div>', [32, 32], [16, 16]),
              zIndexOffset: 450
            }).addTo(map);
            markers['rider'].bindPopup('<b>You</b><br>Live GPS Location');
          }
        } else if (markers['rider']) {
          map.removeLayer(markers['rider']);
          delete markers['rider'];
        }

        // 5. START MARKER
        if (data.startLocation && Number.isFinite(data.startLocation.latitude)) {
          var sPos = [data.startLocation.latitude, data.startLocation.longitude];
          if (markers['start']) {
            markers['start'].setLatLng(sPos);
          } else {
            markers['start'] = L.marker(sPos, {
              icon: createDivIcon('<div class="start-marker">S</div>', [32, 32], [16, 16]),
              zIndexOffset: 400
            }).addTo(map);
            markers['start'].bindPopup('<b>START</b><br>' + (data.startLocation.name || ''));
          }
        } else if (markers['start']) {
          map.removeLayer(markers['start']);
          delete markers['start'];
        }

        // 6. DESTINATION MARKER
        if (data.destinationLocation && Number.isFinite(data.destinationLocation.latitude)) {
          var dPos = [data.destinationLocation.latitude, data.destinationLocation.longitude];
          if (markers['destination']) {
            markers['destination'].setLatLng(dPos);
          } else {
            markers['destination'] = L.marker(dPos, {
              icon: createDivIcon('<div class="destination-marker">🏁</div>', [34, 34], [17, 17]),
              zIndexOffset: 400
            }).addTo(map);
            markers['destination'].bindPopup('<b>DESTINATION</b><br>' + (data.destinationLocation.name || ''));
          }
        } else if (markers['destination']) {
          map.removeLayer(markers['destination']);
          delete markers['destination'];
        }

        // 7. STOPS
        if (data.stops && data.stops.length) {
          data.stops.forEach(function(stop, idx) {
            var sKey = 'stop_' + idx;
            if (Number.isFinite(stop.latitude)) {
              var pos = [stop.latitude, stop.longitude];
              if (markers[sKey]) {
                markers[sKey].setLatLng(pos);
              } else {
                markers[sKey] = L.marker(pos, {
                  icon: createDivIcon('<div class="stop-marker">' + (idx + 1) + '</div>', [28, 28], [14, 14]),
                  zIndexOffset: 350
                }).addTo(map);
                markers[sKey].bindPopup('<b>STOP ' + (idx + 1) + '</b><br>' + (stop.name || ''));
              }
            }
          });
        }

        // 8. CREW / OTHER LIVE RIDERS
        if (data.liveRiders && data.liveRiders.length) {
          var currentRiderKeys = {};
          data.liveRiders.forEach(function(rider, idx) {
            var key = 'crew_' + (rider._id || rider.id || rider.name || idx);
            currentRiderKeys[key] = true;
            if (Number.isFinite(rider.latitude) && Number.isFinite(rider.longitude) && rider.latitude !== 0) {
              var pos = [rider.latitude, rider.longitude];
              var initial = (rider.name || 'R').charAt(0).toUpperCase();
              var isOffline = rider.isLive === false;
              var html = '<div class="crew-marker ' + (isOffline ? 'offline' : '') + '">' + initial + '</div>';
              if (markers[key]) {
                markers[key].setLatLng(pos);
              } else {
                markers[key] = L.marker(pos, {
                  icon: createDivIcon(html, [32, 32], [16, 16]),
                  zIndexOffset: 300
                }).addTo(map);
                markers[key].on('click', function() {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'RIDER_PRESS', payload: rider }));
                });
              }
            }
          });
          Object.keys(markers).forEach(function(k) {
            if (k.startsWith('crew_') && !currentRiderKeys[k]) {
              map.removeLayer(markers[k]);
              delete markers[k];
            }
          });
        }

        // 9. ACTIVE SOS EMERGENCY MARKER
        if (data.activeSosEvent && Number.isFinite(data.activeSosEvent.latitude)) {
          var sosPos = [data.activeSosEvent.latitude, data.activeSosEvent.longitude];
          if (markers['sos']) {
            markers['sos'].setLatLng(sosPos);
          } else {
            markers['sos'] = L.marker(sosPos, {
              icon: createDivIcon('<div class="sos-marker">🚨</div>', [44, 44], [22, 22]),
              zIndexOffset: 1000
            }).addTo(map);
            markers['sos'].on('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SOS_PRESS', payload: data.activeSosEvent }));
            });
          }
        } else if (markers['sos']) {
          map.removeLayer(markers['sos']);
          delete markers['sos'];
        }

      } catch (e) {
        console.error('Error updating map data:', e);
      }
    };

    window.mapZoomIn = function() {
      if (!map) return;
      map.zoomIn();
    };

    window.mapZoomOut = function() {
      if (!map) return;
      map.zoomOut();
    };

    window.mapRecenter = function() {
      if (!map) return;
      if (currentData.activeSosEvent && Number.isFinite(currentData.activeSosEvent.latitude)) {
        map.flyTo([currentData.activeSosEvent.latitude, currentData.activeSosEvent.longitude], 16, { duration: 0.8 });
        return;
      }
      if (currentData.roadRoute && currentData.roadRoute.length > 1) {
        var bounds = L.latLngBounds(currentData.roadRoute.map(function(c) { return [c.latitude, c.longitude]; }));
        map.fitBounds(bounds, { padding: [40, 40], animate: true });
        return;
      }
      if (currentData.riderLocation && Number.isFinite(currentData.riderLocation.latitude)) {
        map.flyTo([currentData.riderLocation.latitude, currentData.riderLocation.longitude], 15, { duration: 0.8 });
        return;
      }
      if (currentData.captainLocation && Number.isFinite(currentData.captainLocation.latitude)) {
        map.flyTo([currentData.captainLocation.latitude, currentData.captainLocation.longitude], 15, { duration: 0.8 });
        return;
      }
    };

    window.mapAnimateTo = function(lat, lng, zoom, durationSec) {
      if (!map) return;
      map.flyTo([lat, lng], zoom || map.getZoom() || 14, {
        duration: durationSec || 0.8
      });
    };

    window.mapFitBounds = function(coordsJson, padding) {
      if (!map) return;
      try {
        var coords = JSON.parse(coordsJson);
        if (coords.length > 0) {
          var bounds = L.latLngBounds(coords.map(function(c) { return [c.latitude, c.longitude]; }));
          map.fitBounds(bounds, {
            padding: padding ? [padding.top || 40, padding.left || 40] : [40, 40],
            animate: true
          });
        }
      } catch (e) {
        console.error('Error in mapFitBounds:', e);
      }
    };
  </script>
</body>
</html>
`;

export const RydoMap = forwardRef<RydoMapRef, RydoMapProps>(
  (
    {
      style,
      initialRegion,
      roadRoute = [],
      emergencyRoute = [],
      captainLocation,
      riderLocation,
      liveRiders = [],
      startLocation,
      stops = [],
      destinationLocation,
      activeSosEvent,
      onMapReady,
      onSosPress,
      onRiderPress,
      showControls = true,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView | null>(null);
    const isReadyRef = useRef(false);

    const initialLat =
      initialRegion?.latitude ??
      captainLocation?.latitude ??
      riderLocation?.latitude ??
      startLocation?.latitude ??
      17.9689;

    const initialLng =
      initialRegion?.longitude ??
      captainLocation?.longitude ??
      riderLocation?.longitude ??
      startLocation?.longitude ??
      79.5941;

    const computeZoom = (delta?: number) => {
      if (!delta || delta > 0.5) return 10;
      if (delta > 0.2) return 12;
      if (delta > 0.08) return 13;
      if (delta > 0.03) return 14;
      if (delta > 0.01) return 15;
      return 16;
    };

    const initialZoom = computeZoom(initialRegion?.latitudeDelta);

    const sendUpdate = useCallback(() => {
      if (!webViewRef.current || !isReadyRef.current) return;

      const payload = {
        roadRoute,
        emergencyRoute,
        captainLocation,
        riderLocation,
        liveRiders,
        startLocation,
        stops,
        destinationLocation,
        activeSosEvent,
      };

      const js = `window.updateMapData && window.updateMapData(${JSON.stringify(JSON.stringify(payload))}); true;`;
      webViewRef.current.injectJavaScript(js);
    }, [
      roadRoute,
      emergencyRoute,
      captainLocation,
      riderLocation,
      liveRiders,
      startLocation,
      stops,
      destinationLocation,
      activeSosEvent,
    ]);

    useEffect(() => {
      sendUpdate();
    }, [sendUpdate]);

    const handleZoomIn = () => {
      if (!webViewRef.current || !isReadyRef.current) return;
      webViewRef.current.injectJavaScript('window.mapZoomIn && window.mapZoomIn(); true;');
    };

    const handleZoomOut = () => {
      if (!webViewRef.current || !isReadyRef.current) return;
      webViewRef.current.injectJavaScript('window.mapZoomOut && window.mapZoomOut(); true;');
    };

    const handleRecenter = () => {
      if (!webViewRef.current || !isReadyRef.current) return;
      webViewRef.current.injectJavaScript('window.mapRecenter && window.mapRecenter(); true;');
    };

    useImperativeHandle(ref, () => ({
      animateToRegion: (region: MapRegion, duration = 1000) => {
        if (!webViewRef.current || !isReadyRef.current) return;
        const zoom = computeZoom(region.latitudeDelta);
        const durationSec = duration / 1000;
        const js = `window.mapAnimateTo && window.mapAnimateTo(${region.latitude}, ${region.longitude}, ${zoom}, ${durationSec}); true;`;
        webViewRef.current.injectJavaScript(js);
      },
      fitToCoordinates: (coordinates: Coordinate[], options?: { edgePadding?: any }) => {
        if (!webViewRef.current || !isReadyRef.current || !coordinates.length) return;
        const json = JSON.stringify(coordinates);
        const padJson = options?.edgePadding ? JSON.stringify(options.edgePadding) : 'null';
        const js = `window.mapFitBounds && window.mapFitBounds(${JSON.stringify(json)}, ${padJson}); true;`;
        webViewRef.current.injectJavaScript(js);
      },
      animateCamera: (options: { center?: Coordinate; zoom?: number }, config?: { duration?: number }) => {
        if (!webViewRef.current || !isReadyRef.current || !options.center) return;
        const durationSec = (config?.duration || 800) / 1000;
        const js = `window.mapAnimateTo && window.mapAnimateTo(${options.center.latitude}, ${options.center.longitude}, ${options.zoom || 14}, ${durationSec}); true;`;
        webViewRef.current.injectJavaScript(js);
      },
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      recenter: handleRecenter,
    }));

    const handleMessage = (event: any) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'MAP_READY') {
          isReadyRef.current = true;
          sendUpdate();
          onMapReady?.();
        } else if (msg.type === 'SOS_PRESS' && msg.payload) {
          onSosPress?.(msg.payload);
        } else if (msg.type === 'RIDER_PRESS' && msg.payload) {
          onRiderPress?.(msg.payload);
        }
      } catch (e) {
        console.error('Error handling map message:', e);
      }
    };

    const injectedInitScript = `
      initMap(${initialLat}, ${initialLng}, ${initialZoom});
      true;
    `;

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: LEAFLET_HTML }}
          injectedJavaScript={injectedInitScript}
          onMessage={handleMessage}
          style={styles.webView}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          bounces={false}
          overScrollMode="never"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          geolocationEnabled={true}
          allowFileAccess={true}
          mixedContentMode="always"
        />

        {showControls && (
          <View style={styles.controlsContainer} pointerEvents="box-none">
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.controlBtn}
              onPress={handleZoomIn}
            >
              <Text style={styles.controlBtnText}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.controlBtn}
              onPress={handleZoomOut}
            >
              <Text style={[styles.controlBtnText, { fontSize: 22, marginTop: -2 }]}>−</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.controlBtn, styles.recenterBtn]}
              onPress={handleRecenter}
            >
              <Text style={styles.recenterIcon}>🎯</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#121212',
    position: 'relative',
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#121212',
  },
  controlsContainer: {
    position: 'absolute',
    right: 12,
    top: '30%',
    flexDirection: 'column',
    gap: 8,
    zIndex: 999,
  },
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20, 20, 20, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
  },
  recenterBtn: {
    marginTop: 4,
    backgroundColor: 'rgba(22, 119, 255, 0.88)',
    borderColor: '#FFFFFF',
  },
  controlBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  recenterIcon: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default RydoMap;
