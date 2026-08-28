import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Share,
  Alert,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import MapView, {
  Marker,
  Polyline,
  LatLng,
} from 'react-native-maps';

import * as Location from 'expo-location';

import { Socket } from 'socket.io-client';
import ProfileHeaderButton from '@/components/ProfileHeaderButton';
import CommunicationButton from '@/components/CommunicationButton';
import { communicationService } from '@/services/communicationService';
import { socketService } from '@/services/socketService';
import { SosButton } from '@/components/SosButton';
import { SosEmergencyOverlay } from '@/components/SosEmergencyOverlay';
import { SosEvent } from '@/services/sosService';

import { API_URL } from '@/constants/network';

/* =====================================================
   OSRM
===================================================== */

const OSRM_URL =
  'https://router.project-osrm.org/route/v1/driving';

/* =====================================================
   TYPES
===================================================== */

type Coordinate = {
  latitude: number;
  longitude: number;
};

type RiderLocation = {
  latitude: number;
  longitude: number;
  updatedAt?: string;
};

type Rider = {
  _id?: string;
  name: string;
  role?: string;
  joinedAt?: string;
  location?: RiderLocation | null;
};

type RoutePoint = {
  name: string;
  latitude: number;
  longitude: number;
};

type RouteData = {
  start: RoutePoint | null;
  destination: RoutePoint | null;
  stops: RoutePoint[];
};

type CaptainLocation = {
  latitude: number;
  longitude: number;
  updatedAt?: string;
};

/* =====================================================
   CAPTAIN DASHBOARD
===================================================== */

export default function CaptainDashboard() {
  /* ===================================================
     RIDE
  =================================================== */

  const [rideStarted, setRideStarted] =
    useState(false);

  /* ===================================================
     RIDERS
  =================================================== */

  const [riders, setRiders] =
    useState<Rider[]>([]);

  const [selectedRider, setSelectedRider] =
    useState<Rider | null>(null);

  const [loadingRiders, setLoadingRiders] =
    useState(true);

  const isRiderLive = (rider: Rider) => {
    if (!rider.location?.updatedAt) return true;
    const age = Date.now() - new Date(rider.location.updatedAt).getTime();
    return age < 35000;
  };

  const getRiderStatusLabel = (rider: Rider) => {
    if (!rider.location) return 'NO LOCATION';
    if (!rider.location.updatedAt) return 'LIVE';
    const ageMs = Date.now() - new Date(rider.location.updatedAt).getTime();
    const ageSec = Math.floor(ageMs / 1000);
    if (ageSec < 35) return 'LIVE';
    if (ageSec < 60) return `LAST SEEN ${ageSec}s AGO`;
    const ageMin = Math.floor(ageSec / 60);
    if (ageMin < 60) return `LAST SEEN ${ageMin}m AGO`;
    return 'OFFLINE';
  };

  /* ===================================================
     ROUTE
  =================================================== */

  const [routeData, setRouteData] =
    useState<RouteData>({
      start: null,
      destination: null,
      stops: [],
    });

  const [loadingRoute, setLoadingRoute] =
    useState(true);

  /* ===================================================
     ROAD ROUTE
  =================================================== */

  const [roadRoute, setRoadRoute] =
    useState<LatLng[]>([]);

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [routeError, setRouteError] =
    useState('');

  /* ===================================================
     ROUTE INFORMATION
  =================================================== */

  const [routeDistance, setRouteDistance] =
    useState(0);

  const [routeDuration, setRouteDuration] =
    useState(0);

  const [remainingDistance, setRemainingDistance] =
    useState(0);

  const [remainingDuration, setRemainingDuration] =
    useState(0);

  /* ===================================================
     LOCATION
  =================================================== */

  const [location, setLocation] =
    useState<Location.LocationObjectCoords | null>(
      null
    );

  const [captainLocation, setCaptainLocation] =
    useState<CaptainLocation | null>(
      null
    );

  const [locationPermission, setLocationPermission] =
    useState(false);

  const [locationLoading, setLocationLoading] =
    useState(true);

  /* ===================================================
     HEADING
  =================================================== */

  const [heading, setHeading] =
    useState(0);

  const previousLocationRef =
    useRef<{
      latitude: number;
      longitude: number;
    } | null>(null);

  /* ===================================================
     NAVIGATION
  =================================================== */

  const [navigationMode, setNavigationMode] =
    useState(false);

  /* ===================================================
     MAP
  =================================================== */

  const [mapReady, setMapReady] =
    useState(false);

  const mapRef =
    useRef<MapView | null>(null);

  /* ===================================================
     SOCKET
  =================================================== */

  const socketRef =
    useRef<Socket | null>(null);

  /* ===================================================
     FETCH CONTROL
  =================================================== */

  const mountedRef =
    useRef(true);

  const fetchInProgressRef =
    useRef(false);

  const lastLocationUploadRef =
    useRef(0);

  // Persistent last-known rider locations keyed by userId
  // Never cleared by temporary empty API responses
  const lastKnownRiderLocationsRef =
    useRef<Record<string, { latitude: number; longitude: number; updatedAt?: string }>>({});

  // Monotonically increasing fetch sequence number
  // Prevents stale responses from overwriting newer state
  const fetchSeqRef = useRef(0);

  // SOS Emergency States
  const [activeSosEvent, setActiveSosEvent] = useState<SosEvent | null>(null);
  const [sosOverlayVisible, setSosOverlayVisible] = useState<boolean>(false);
  const [emergencyRoute, setEmergencyRoute] = useState<Coordinate[]>([]);

  /* ===================================================
     PARAMS
  =================================================== */

  const {
    rideName,
    captainName,
    rideCode,
  } =
    useLocalSearchParams<{
      rideName?: string;
      captainName?: string;
      rideCode?: string;
    }>();

  /* ===================================================
     DISPLAY VALUES
  =================================================== */

  const displayRideName =
    rideName || 'RYDO RIDE';

  const displayCaptain =
    captainName || 'Captain';

  const displayRideCode =
    rideCode || '------';

  useEffect(() => {
    console.log('[RYDO LOCATION DEBUG]', {
      role: 'captain',
      userId: `captain-${String(displayCaptain).toLowerCase().replace(/\s+/g, '-')}`,
      name: displayCaptain,
      rideCode,
      isCaptain: true,
      isRideMember: true,
    });
  }, [rideCode, displayCaptain]);

  /* ===================================================
     BEARING
  =================================================== */

  const calculateBearing = (
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number
  ) => {
    const startLatitude =
      (startLat * Math.PI) / 180;

    const endLatitude =
      (endLat * Math.PI) / 180;

    const differenceLongitude =
      ((endLon - startLon) * Math.PI) / 180;

    const y =
      Math.sin(differenceLongitude) *
      Math.cos(endLatitude);

    const x =
      Math.cos(startLatitude) *
        Math.sin(endLatitude) -
      Math.sin(startLatitude) *
        Math.cos(endLatitude) *
        Math.cos(differenceLongitude);

    let bearing =
      (Math.atan2(y, x) * 180) /
      Math.PI;

    bearing =
      (bearing + 360) % 360;

    return bearing;
  };

  /* ===================================================
     HAVERSINE
  =================================================== */

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const earthRadius = 6371000;

    const dLat =
      ((lat2 - lat1) * Math.PI) / 180;

    const dLon =
      ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +
      Math.cos(
        (lat1 * Math.PI) / 180
      ) *
        Math.cos(
          (lat2 * Math.PI) / 180
        ) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return earthRadius * c;
  };

  /* ===================================================
     FIND NEAREST ROUTE POINT
  =================================================== */

  const findNearestRoutePoint = (
    currentLatitude: number,
    currentLongitude: number
  ) => {
    if (
      roadRoute.length === 0
    ) {
      return 0;
    }

    let nearestIndex = 0;
    let nearestDistance =
      Infinity;

    roadRoute.forEach(
      (point, index) => {
        const distance =
          calculateDistance(
            currentLatitude,
            currentLongitude,
            point.latitude,
            point.longitude
          );

        if (
          distance <
          nearestDistance
        ) {
          nearestDistance =
            distance;

          nearestIndex =
            index;
        }
      }
    );

    return nearestIndex;
  };

  /* ===================================================
     UPDATE REMAINING ROUTE
  =================================================== */

  const updateRemainingRoute = (
    currentLocation:
      Location.LocationObjectCoords
  ) => {
    if (
      roadRoute.length < 2 ||
      routeDistance <= 0
    ) {
      return;
    }

    const nearestIndex =
      findNearestRoutePoint(
        currentLocation.latitude,
        currentLocation.longitude
      );

    let remaining =
      calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        roadRoute[nearestIndex].latitude,
        roadRoute[nearestIndex].longitude
      );

    for (
      let i = nearestIndex;
      i < roadRoute.length - 1;
      i++
    ) {
      remaining +=
        calculateDistance(
          roadRoute[i].latitude,
          roadRoute[i].longitude,
          roadRoute[i + 1].latitude,
          roadRoute[i + 1].longitude
        );
    }

    remaining =
      Math.min(
        remaining,
        routeDistance
      );

    setRemainingDistance(
      remaining
    );

    const ratio =
      routeDistance > 0
        ? Math.min(
            Math.max(
              remaining /
                routeDistance,
              0
            ),
            1
          )
        : 0;

    setRemainingDuration(
      routeDuration * ratio
    );
  };

  /* ===================================================
     FORMAT DISTANCE
  =================================================== */

  const formatDistance = (
    meters: number
  ) => {
    if (
      !meters ||
      meters <= 0
    ) {
      return '--';
    }

    if (
      meters < 1000
    ) {
      return `${Math.round(
        meters
      )} m`;
    }

    return `${(
      meters / 1000
    ).toFixed(1)} km`;
  };

  /* ===================================================
     FORMAT TIME
  =================================================== */

  const formatDuration = (
    seconds: number
  ) => {
    if (
      !seconds ||
      seconds <= 0
    ) {
      return '--';
    }

    const totalMinutes =
      Math.round(
        seconds / 60
      );

    if (
      totalMinutes < 60
    ) {
      return `${totalMinutes} min`;
    }

    const hours =
      Math.floor(
        totalMinutes / 60
      );

    const minutes =
      totalMinutes % 60;

    if (
      minutes === 0
    ) {
      return `${hours} hr`;
    }

    return `${hours} hr ${minutes} min`;
  };

  /* ===================================================
     PUBLISH CAPTAIN LOCATION
  =================================================== */

  const publishCaptainLocation =
    async (
      coords:
        Location.LocationObjectCoords
    ) => {
      if (!rideCode) {
        return;
      }

      const code =
        String(rideCode)
          .trim()
          .toUpperCase();

      const name =
        String(displayCaptain || 'Captain').trim();

      const lat = coords.latitude;
      const lng = coords.longitude;

      // 1. Emit live location via Socket.IO
      // NOTE: userId is REQUIRED by socket server (line 220 of rideSocket.js)
      const socket = socketRef.current;
      const captainSocketId = `captain-${name.toLowerCase().replace(/\s+/g, '-')}`;
      if (socket && socket.connected) {
        socket.emit('updateLocation', {
          rideCode: code,
          userId: captainSocketId,
          memberId: captainSocketId,
          userName: name,
          role: 'captain',
          latitude: lat,
          longitude: lng,
          updatedAt: new Date().toISOString(),
        });
      }

      // Development safe log
      console.log(
        `RYDO LOCATION: User: ${name} | Role: captain | Ride: ${code} | Latitude: ${lat.toFixed(5)} | Longitude: ${lng.toFixed(5)}`
      );

      // 2. Throttled HTTP update (every 5s)
      const now =
        Date.now();

      if (
        now -
          lastLocationUploadRef.current <
        5000
      ) {
        return;
      }

      lastLocationUploadRef.current =
        now;

      try {
        await fetch(
          `${API_URL}/api/rides/${encodeURIComponent(
            code
          )}/captain-location`,
          {
            method:
              'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              latitude: lat,
              longitude: lng,
            }),
          }
        );
      } catch (error) {
        console.log(
          'RYDO: Captain location upload error:',
          error
        );
      }
    };

  /* ===================================================
     FETCH RIDER LOCATIONS
  =================================================== */

  const fetchRiderLocations =
    async () => {
      if (!rideCode) {
        return;
      }

      const code =
        String(rideCode)
          .trim()
          .toUpperCase();

      // Assign a monotonically increasing sequence number to this request.
      // If a newer request completes first, this stale response is discarded.
      const thisSeq = ++fetchSeqRef.current;

      try {
        const response =
          await fetch(
            `${API_URL}/api/rides/${encodeURIComponent(
              code
            )}/locations`
          );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        // Discard stale response — a newer request already completed
        if (thisSeq !== fetchSeqRef.current) {
          return;
        }

        if (!data.success) {
          return;
        }

        const backendRiders: any[] =
          Array.isArray(data.riders) ? data.riders : [];

        const ridersWithLoc = backendRiders.filter(
          (r) =>
            r.location &&
            typeof r.location.latitude === 'number' &&
            typeof r.location.longitude === 'number'
        );

        console.log(
          '[LIVE] RESPONSE rideCode:', code,
          '| captainPresent:', !!(data.captain?.location),
          '| riderCount:', backendRiders.length,
          '| ridersWithLoc:', ridersWithLoc.length
        );

        // Update last-known cache for riders that have valid locations.
        // Cache under BOTH userId key AND name key — handles myMemberId fallback case.
        backendRiders.forEach((serverRider: any) => {
          const key = serverRider.userId || serverRider.id || serverRider._id;
          const rName = serverRider.name;
          if (
            serverRider.location &&
            typeof serverRider.location.latitude === 'number' &&
            typeof serverRider.location.longitude === 'number'
          ) {
            const locEntry = {
              latitude: Number(serverRider.location.latitude),
              longitude: Number(serverRider.location.longitude),
              updatedAt: serverRider.location.updatedAt,
            };
            if (key) lastKnownRiderLocationsRef.current[String(key)] = locEntry;
            if (rName) lastKnownRiderLocationsRef.current[rName.toLowerCase()] = locEntry;
          }
        });

        // Merge rider data into state.
        // SOURCE OF TRUTH: ride.riders membership (already in state from fetchRide).
        // LOCATION SOURCE: live locations response + lastKnownRiderLocations cache.
        // NEVER replace location with null if we have a last-known value.
        setRiders(currentRiders => {
          const merged = [...currentRiders];

          backendRiders.forEach((serverRider: any) => {
            const key = serverRider.userId || serverRider.id || serverRider._id;
            const name = serverRider.name;

            // Match by userId (primary) then by name (fallback)
            const idx = merged.findIndex(
              (r) =>
                (key && r._id && String(r._id) === String(key)) ||
                (name && r.name && r.name.toLowerCase() === String(name).toLowerCase())
            );

            const hasValidLoc =
              serverRider.location &&
              typeof serverRider.location.latitude === 'number' &&
              typeof serverRider.location.longitude === 'number';

            // Priority: fresh API location > last-known cache (by key or name) > existing state location
            const cachedLoc =
              (key && lastKnownRiderLocationsRef.current[String(key)]) ||
              (name && lastKnownRiderLocationsRef.current[name.toLowerCase()]) ||
              null;

            const locData = hasValidLoc
              ? {
                  latitude: Number(serverRider.location.latitude),
                  longitude: Number(serverRider.location.longitude),
                  updatedAt: serverRider.location.updatedAt,
                }
              : cachedLoc
              ? cachedLoc
              : idx >= 0
              ? merged[idx].location
              : null;

            const riderObj: Rider = {
              _id: key || (idx >= 0 ? merged[idx]._id : undefined),
              name: name || (idx >= 0 ? merged[idx].name : 'Rider'),
              role: 'rider',
              location: locData,
            };

            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...riderObj };
            } else {
              merged.push(riderObj);
            }
          });

          console.log(
            '[CAPTAIN MAP] riderCount:', merged.length,
            '| riderIdsWithLocations:',
            merged.filter((r) => r.location).map((r) => r._id).join(', ')
          );

          return merged;
        });

        // Update captain location from live response (never from fetchRide,
        // which has the persisted DB snapshot, not the real-time location).
        const captainLoc = data.captain?.location || data.captainLocation;
        if (
          captainLoc &&
          typeof captainLoc.latitude === 'number' &&
          typeof captainLoc.longitude === 'number'
        ) {
          setCaptainLocation({
            latitude: Number(captainLoc.latitude),
            longitude: Number(captainLoc.longitude),
            updatedAt: captainLoc.updatedAt,
          });
        }

        // Active SOS recovery
        if (Array.isArray(data.activeSos) && data.activeSos.length > 0) {
          const latestSos = data.activeSos[data.activeSos.length - 1];
          const lat = Number(latestSos.location?.latitude ?? latestSos.latitude);
          const lng = Number(latestSos.location?.longitude ?? latestSos.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setActiveSosEvent({
              ...latestSos,
              location: { latitude: lat, longitude: lng },
            });
          }
        }
      } catch (error) {
        console.log('RYDO: Rider locations error:', error);
      }
    };

  /* ===================================================
     FETCH RIDE
  =================================================== */

  const fetchRide =
    async () => {
      if (!rideCode) {
        setLoadingRiders(
          false
        );

        setLoadingRoute(
          false
        );

        return;
      }

      if (
        fetchInProgressRef.current
      ) {
        return;
      }

      fetchInProgressRef.current =
        true;

      const code =
        String(rideCode)
          .trim()
          .toUpperCase();

      try {
        const response =
          await fetch(
            `${API_URL}/api/rides/${encodeURIComponent(
              code
            )}`
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          console.log(
            'RYDO: Failed to get ride:',
            data.message
          );

          return;
        }

        if (
          !mountedRef.current
        ) {
          return;
        }

        const ride =
          data.ride;

        /* =============================================
           RIDE STATUS
        ============================================= */

        setRideStarted(
          Boolean(
            ride?.isStarted
          )
        );

        /* =============================================
           CAPTAIN LOCATION
        ============================================= */

        if (
          ride?.captainLocation &&
          typeof ride
            .captainLocation
            .latitude ===
            'number' &&
          typeof ride
            .captainLocation
            .longitude ===
            'number'
        ) {
          setCaptainLocation({
            latitude:
              ride
                .captainLocation
                .latitude,

            longitude:
              ride
                .captainLocation
                .longitude,

            updatedAt:
              ride
                .captainLocation
                .updatedAt,
          });
        }

        /* =============================================
           RIDERS — membership only, preserve locations
        =============================================
           fetchRide() gives us the MEMBER LIST.
           Locations come from fetchRiderLocations().
           We must NOT overwrite existing rider locations
           with null just because the ride document
           doesn't have up-to-date GPS coordinates.
        ============================================= */

        const backendRiders =
          Array.isArray(ride?.riders) ? ride.riders : [];

        setRiders(currentRiders => {
          // Build a new list that merges membership from backend
          // with last-known locations from our persistent cache.
          const merged = [...currentRiders];

          backendRiders.forEach((rider: any) => {
            const riderId = String(rider?.userId || rider?._id || '');
            const riderName = rider?.name || 'Rider';

            // Match existing rider by userId first, then by name
            const idx = merged.findIndex(
              (r) =>
                (riderId && r._id && String(r._id) === riderId) ||
                r.name.toLowerCase() === riderName.toLowerCase()
            );

            // Use last-known cached location — check both userId key and name key
            // because the rider's myMemberId may have been name-based on first connect
            const cachedLoc =
              (riderId && lastKnownRiderLocationsRef.current[riderId]) ||
              (riderName && lastKnownRiderLocationsRef.current[riderName.toLowerCase()]) ||
              undefined;

            const existingLoc = idx >= 0 ? merged[idx].location : null;

            // Priority: cached fresh location > existing state location > DB location > null
            const riderDbLoc =
              rider?.location &&
              typeof rider.location.latitude === 'number' &&
              typeof rider.location.longitude === 'number'
                ? {
                    latitude: rider.location.latitude,
                    longitude: rider.location.longitude,
                    updatedAt: rider.location.updatedAt,
                  }
                : null;

            const location = cachedLoc ?? existingLoc ?? riderDbLoc ?? null;

            // Also seed the cache if the DB has a location and cache doesn't
            if (riderId && riderDbLoc && !cachedLoc) {
              lastKnownRiderLocationsRef.current[riderId] = riderDbLoc;
            }

            const riderObj: Rider = {
              _id: riderId || (idx >= 0 ? merged[idx]._id : undefined),
              name: riderName,
              joinedAt: rider?.joinedAt,
              role: 'rider',
              location,
            };

            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...riderObj };
            } else {
              merged.push(riderObj);
            }
          });

          return merged;
        });

        /* =============================================
           ROUTE
        ============================================= */

        const backendRoute =
          ride?.route || {};

        const start =
          backendRoute.start &&
          typeof backendRoute.start
            .latitude ===
            'number' &&
          typeof backendRoute.start
            .longitude ===
            'number'
            ? {
                name:
                  backendRoute
                    .start
                    .name ||
                  'Start',

                latitude:
                  backendRoute
                    .start
                    .latitude,

                longitude:
                  backendRoute
                    .start
                    .longitude,
              }
            : null;

        const destination =
          backendRoute
            .destination &&
          typeof backendRoute
            .destination
            .latitude ===
            'number' &&
          typeof backendRoute
            .destination
            .longitude ===
            'number'
            ? {
                name:
                  backendRoute
                    .destination
                    .name ||
                  'Destination',

                latitude:
                  backendRoute
                    .destination
                    .latitude,

                longitude:
                  backendRoute
                    .destination
                    .longitude,
              }
            : null;

        const stops =
          Array.isArray(
            backendRoute.stops
          )
            ? backendRoute.stops
                .filter(
                  (stop: any) =>
                    stop &&
                    typeof stop
                      .latitude ===
                      'number' &&
                    typeof stop
                      .longitude ===
                      'number'
                )
                .map(
                  (
                    stop: any
                  ) => ({
                    name:
                      stop.name ||
                      'Stop',

                    latitude:
                      stop.latitude,

                    longitude:
                      stop.longitude,
                  })
                )
            : [];

        setRouteData({
          start,
          destination,
          stops,
        });
      } catch (error) {
        console.log(
          'RYDO: Backend connection error:',
          error
        );
      } finally {
        fetchInProgressRef.current =
          false;

        if (
          mountedRef.current
        ) {
          setLoadingRiders(
            false
          );

          setLoadingRoute(
            false
          );
        }
      }
    };

  /* ===================================================
     LOAD RIDE
  =================================================== */

  useEffect(() => {
    mountedRef.current = true;

    // Initial load
    fetchRide();
    fetchRiderLocations();

    // fetchRide: slow poll for ride membership/route changes (every 30s)
    // fetchRiderLocations: fast poll for live GPS (every 5s)
    // These are deliberately SEPARATE so fetchRide never races with
    // and overwrites freshly-fetched GPS coordinates from fetchRiderLocations.
    const rideInterval = setInterval(() => {
      fetchRide();
    }, 30000);

    const locationInterval = setInterval(() => {
      fetchRiderLocations();
    }, 5000);

    return () => {
      mountedRef.current = false;
      clearInterval(rideInterval);
      clearInterval(locationInterval);
    };
  }, [rideCode]);

  /* ===================================================
     SOCKET.IO
  =================================================== */

  useEffect(() => {
    if (!rideCode) {
      return;
    }

    const code =
      String(rideCode)
        .trim()
        .toUpperCase();

    const socket = socketService.connect({
      rideCode: code,
      userName: displayCaptain,
      role: 'captain',
    });

    socketRef.current = socket;
    communicationService.setActiveRideCode(code);
    communicationService.setActiveUser(null, displayCaptain);

    socket.on(
      'connect',
      () => {
        console.log(
          'RYDO: Captain socket connected'
        );

        socket.emit(
          'joinRide',
          {
            rideCode:
              code,

            memberId:
              `captain-${displayCaptain.toLowerCase().replace(/\s+/g, '-')}`,

            userName:
              displayCaptain,

            role:
              'captain',
          }
        );
      }
    );

    /* -------------------------------------------------
       INITIAL SNAPSHOT OF ALL ACTIVE LOCATIONS
    ------------------------------------------------- */

    socket.on(
      'locationsSnapshot',
      (snapshot: any) => {
        console.log(
          'RYDO: Captain received locationsSnapshot:',
          snapshot
        );

        if (!snapshot) return;

        if (
          snapshot.captainLocation &&
          typeof snapshot.captainLocation.latitude === 'number' &&
          typeof snapshot.captainLocation.longitude === 'number'
        ) {
          setCaptainLocation({
            latitude: snapshot.captainLocation.latitude,
            longitude: snapshot.captainLocation.longitude,
            updatedAt: snapshot.captainLocation.updatedAt,
          });
        }

        if (Array.isArray(snapshot.riders)) {
          setRiders((currentRiders) => {
            const updatedRiders = [...currentRiders];

            snapshot.riders.forEach((snapRider: any) => {
              if (
                !snapRider ||
                typeof snapRider.latitude !== 'number' ||
                typeof snapRider.longitude !== 'number'
              )
                return;

              const memberKey =
                snapRider.memberId ||
                snapRider._id ||
                snapRider.userName ||
                snapRider.name;

              const rName =
                snapRider.userName || snapRider.name || 'Rider';

              const existingIdx = updatedRiders.findIndex(
                (r) =>
                  (r._id && String(r._id) === String(memberKey)) ||
                  r.name.toLowerCase() === rName.toLowerCase()
              );

              const riderObj: Rider = {
                _id: memberKey,
                name: rName,
                location: {
                  latitude: snapRider.latitude,
                  longitude: snapRider.longitude,
                  updatedAt: snapRider.updatedAt || new Date().toISOString(),
                },
              };

              if (existingIdx >= 0) {
                updatedRiders[existingIdx] = {
                  ...updatedRiders[existingIdx],
                  ...riderObj,
                };
              } else {
                updatedRiders.push(riderObj);
              }
            });

            return updatedRiders;
          });
        }
      }
    );

    /* -------------------------------------------------
       REALTIME LOCATION BROADCASTS
    ------------------------------------------------- */

    socket.on(
      'locationUpdated',
      (payload: any) => {
        if (
          !payload
        ) {
          return;
        }

        const payloadCode =
          String(
            payload.rideCode ||
              ''
          )
            .trim()
            .toUpperCase();

        if (
          payloadCode !==
          code
        ) {
          return;
        }

        const latitude =
          Number(
            payload.latitude
          );

        const longitude =
          Number(
            payload.longitude
          );

        if (
          !Number.isFinite(
            latitude
          ) ||
          !Number.isFinite(
            longitude
          )
        ) {
          return;
        }

        /* =============================================
           RIDER
        ============================================= */

        if (payload.role === 'rider') {
          const memberKey = payload.userId || payload.memberId || payload.userName;
          const rName = payload.userName || 'Rider';

          const updatedAt =
            payload.updatedAt || payload.timestamp || new Date().toISOString();

          const newLocation = { latitude, longitude, updatedAt };

          // Cache under every possible key so any future lookup hits
          if (memberKey) {
            lastKnownRiderLocationsRef.current[String(memberKey)] = newLocation;
          }
          if (rName) {
            lastKnownRiderLocationsRef.current[rName.toLowerCase()] = newLocation;
          }

          console.log('[RYDO CAPTAIN SOCKET LOCATION RECEIVED]', {
            rideCode: code,
            userId: memberKey,
            name: rName,
            latitude,
            longitude,
          });

          setRiders((currentRiders) => {
            // Match by userId first, then by name (handles fallback myMemberId case)
            const existingIdx = currentRiders.findIndex(
              (r) =>
                (memberKey && r._id && String(r._id) === String(memberKey)) ||
                (rName && r.name && r.name.toLowerCase() === rName.toLowerCase())
            );

            const updatedRider: Rider = {
              _id: memberKey,  // normalize _id to the socket userId
              name: rName,
              role: 'rider',
              location: newLocation,
            };

            if (existingIdx >= 0) {
              const next = [...currentRiders];
              next[existingIdx] = { ...next[existingIdx], ...updatedRider };
              return next;
            }

            // Rider not yet in state — add them directly from socket
            return [...currentRiders, updatedRider];
          });

          // Live SOS location tracking
          setActiveSosEvent((currentSos) => {
            if (!currentSos) return null;
            const matches =
              (memberKey && currentSos.userId && String(currentSos.userId) === String(memberKey)) ||
              (rName && currentSos.name && currentSos.name.toLowerCase() === rName.toLowerCase());
            if (matches) {
              console.log('[SOS LIVE UPDATE] Moving SOS marker for:', rName, { latitude, longitude });
              return {
                ...currentSos,
                location: newLocation,
                latitude,
                longitude,
              };
            }
            return currentSos;
          });
        }

        /* =============================================
           CAPTAIN
        ============================================= */

        if (
          payload.role ===
          'captain'
        ) {
          setCaptainLocation({
            latitude,
            longitude,

            updatedAt:
              payload.updatedAt ||
              payload.timestamp ||
              new Date().toISOString(),
          });
        }
      }
    );

    socket.on('userLeft', (payload: any) => {
      console.log('RYDO: userLeft received on captain:', payload);
      if (!payload) return;
      const leftId = payload.memberId || payload.userId || payload.userName;
      if (leftId) {
        delete lastKnownRiderLocationsRef.current[String(leftId)];
        if (payload.userName) {
          delete lastKnownRiderLocationsRef.current[payload.userName.toLowerCase()];
        }
        setRiders((prev) =>
          prev.filter(
            (r) =>
              (!r._id || String(r._id) !== String(leftId)) &&
              (!r.name || r.name !== payload.userName)
          )
        );
      }
    });

    const handleSosEvent = (payload: any) => {
      console.log('[RYDO SOS] Received on captain:', payload);
      if (!payload) return;
      const lat = Number(payload.location?.latitude ?? payload.latitude);
      const lng = Number(payload.location?.longitude ?? payload.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const eventId = payload.eventId || payload.sosId || `${payload.userId || payload.name}_${payload.triggeredAt || 'active'}`;

      const event: SosEvent = {
        eventId,
        sosId: payload.sosId || payload.eventId || eventId,
        rideCode: payload.rideCode || rideCode || '',
        name: payload.name || payload.riderName || 'Ride Member',
        riderName: payload.riderName || payload.name,
        role: payload.role || 'rider',
        userId: payload.userId,
        bikeNumber: payload.bikeNumber,
        bloodGroup: payload.bloodGroup,
        emergencyContact: payload.emergencyContact,
        location: { latitude: lat, longitude: lng },
        latitude: lat,
        longitude: lng,
        triggeredAt: payload.triggeredAt || payload.createdAt || new Date().toISOString(),
        createdAt: payload.createdAt || payload.triggeredAt || new Date().toISOString(),
        status: payload.status || 'active',
      };

      setActiveSosEvent(event);
      setSosOverlayVisible(true);
    };

    socket.on('sosAlert', handleSosEvent);
    socket.on('sosTriggered', handleSosEvent);
    socket.on('sosResolved', (data: any) => {
      console.log('RYDO: SOS resolved on captain:', data);
      setActiveSosEvent(null);
      setSosOverlayVisible(false);
      setEmergencyRoute([]);
    });

    socket.on(
      'disconnect',
      () => {
        console.log(
          'RYDO: Captain socket disconnected'
        );
      }
    );

    socket.on(
      'connect_error',
      error => {
        console.log(
          'RYDO socket error:',
          error.message
        );
      }
    );

    return () => {
      socket.off('locationsSnapshot');
      socket.off('locationUpdated');
      socket.off('userLeft');
      socket.off('sosAlert', handleSosEvent);
      socket.off('sosTriggered', handleSosEvent);
      socket.off('sosResolved');
    };
  }, [rideCode, displayCaptain]);

  /* ===================================================
     LOCATION TRACKING
  =================================================== */

  useEffect(() => {
    let subscription:
      | Location.LocationSubscription
      | null = null;

    let cancelled =
      false;

    const startLocationTracking =
      async () => {
        try {
          const {
            status,
          } =
            await Location.requestForegroundPermissionsAsync();

          if (
            cancelled
          ) {
            return;
          }

          if (
            status !==
            'granted'
          ) {
            setLocationPermission(
              false
            );

            setLocationLoading(
              false
            );

            return;
          }

          setLocationPermission(
            true
          );

          const currentLocation =
            await Location.getCurrentPositionAsync(
              {
                accuracy:
                  Location.Accuracy.High,
              }
            );

          if (
            cancelled
          ) {
            return;
          }

          const coords =
            currentLocation.coords;

          setLocation(
            coords
          );

          setCaptainLocation({
            latitude:
              coords.latitude,

            longitude:
              coords.longitude,

            updatedAt:
              new Date().toISOString(),
          });

          if (
            coords.heading !=
              null &&
            coords.heading >= 0
          ) {
            setHeading(
              coords.heading
            );
          }

          previousLocationRef.current =
            {
              latitude:
                coords.latitude,

              longitude:
                coords.longitude,
            };

          setLocationLoading(
            false
          );

          /* ===========================================
             SEND INITIAL LOCATION
          =========================================== */

          if (
            socketRef.current &&
            socketRef.current.connected &&
            rideCode
          ) {
            const captainId = `captain-${String(displayCaptain).toLowerCase().replace(/\s+/g, '-')}`;
            socketRef.current.emit(
              'updateLocation',
              {
                rideCode:
                  String(rideCode).trim().toUpperCase(),
                userId: captainId,
                memberId: captainId,
                userName: displayCaptain,
                role: 'captain',
                latitude: coords.latitude,
                longitude: coords.longitude,
                updatedAt: new Date().toISOString(),
              }
            );
          }

          publishCaptainLocation(
            coords
          );

          /* ===========================================
             WATCH LOCATION
          =========================================== */

          subscription =
            await Location.watchPositionAsync(
              {
                accuracy:
                  Location.Accuracy.High,

                timeInterval:
                  2000,

                distanceInterval:
                  3,
              },

              newLocation => {
                if (
                  cancelled
                ) {
                  return;
                }

                const newCoords =
                  newLocation.coords;

                /* =====================================
                   HEADING
                ===================================== */

                let newHeading =
                  newCoords.heading;

                if (
                  newHeading ==
                    null ||
                  newHeading < 0
                ) {
                  const previous =
                    previousLocationRef.current;

                  if (
                    previous
                  ) {
                    const movedDistance =
                      calculateDistance(
                        previous.latitude,
                        previous.longitude,
                        newCoords.latitude,
                        newCoords.longitude
                      );

                    if (
                      movedDistance >
                      1
                    ) {
                      newHeading =
                        calculateBearing(
                          previous.latitude,
                          previous.longitude,
                          newCoords.latitude,
                          newCoords.longitude
                        );
                    }
                  }
                }

                if (
                  newHeading !=
                    null &&
                  newHeading >= 0
                ) {
                  setHeading(
                    newHeading
                  );
                }

                previousLocationRef.current =
                  {
                    latitude:
                      newCoords.latitude,

                    longitude:
                      newCoords.longitude,
                  };

                /* =====================================
                   UPDATE LOCAL STATE
                ===================================== */

                setLocation(
                  newCoords
                );

                setCaptainLocation({
                  latitude:
                    newCoords.latitude,

                  longitude:
                    newCoords.longitude,

                  updatedAt:
                    new Date().toISOString(),
                });

                /* =====================================
                   UPDATE REMAINING ROUTE
                ===================================== */

                if (
                  roadRoute.length >
                    1 &&
                  routeDistance >
                    0
                ) {
                  updateRemainingRoute(
                    newCoords
                  );
                }

                /* =====================================
                   SOCKET
                ===================================== */

                if (
                  socketRef.current &&
                  socketRef.current.connected &&
                  rideCode
                ) {
                  const captainId = `captain-${String(displayCaptain).toLowerCase().replace(/\s+/g, '-')}`;
                  socketRef.current.emit(
                    'updateLocation',
                    {
                      rideCode:
                        String(rideCode).trim().toUpperCase(),
                      userId: captainId,
                      memberId: captainId,
                      userName: displayCaptain,
                      role: 'captain',
                      latitude: newCoords.latitude,
                      longitude: newCoords.longitude,
                      updatedAt: new Date().toISOString(),
                    }
                  );
                }

                /* =====================================
                   REST BACKUP
                ===================================== */

                publishCaptainLocation(
                  newCoords
                );
              }
            );
        } catch (error) {
          console.log(
            'RYDO: Location error:',
            error
          );

          if (
            !cancelled
          ) {
            setLocationLoading(
              false
            );
          }
        }
      };

    startLocationTracking();

    return () => {
      cancelled =
        true;

      if (
        subscription
      ) {
        subscription.remove();
      }
    };
  // DO NOT include roadRoute.length or routeDistance as deps here.
  // They change when the route loads, which would restart the GPS watcher
  // and re-request permissions every time. rideCode and displayCaptain
  // are the only values that legitimately require restarting tracking.
  }, [
    rideCode,
    displayCaptain,
  ]);

  /* ===================================================
     UPDATE REMAINING WHEN LOCATION CHANGES
  =================================================== */

  useEffect(() => {
    if (
      location &&
      roadRoute.length > 0 &&
      routeDistance > 0
    ) {
      updateRemainingRoute(
        location
      );
    }
  }, [
    location?.latitude,
    location?.longitude,
    roadRoute,
    routeDistance,
  ]);

  /* ===================================================
     GET ROAD ROUTE
  =================================================== */

  const fetchRoadRoute =
    async () => {
      if (
        !routeData.start ||
        !routeData.destination
      ) {
        setRoadRoute([]);

        setRouteDistance(
          0
        );

        setRouteDuration(
          0
        );

        return;
      }

      try {
        setRouteLoading(
          true
        );

        setRouteError('');

        const currentLocPoint: RoutePoint | null = (location || captainLocation)
          ? {
              name: 'Current Location',
              latitude: (location || captainLocation)!.latitude,
              longitude: (location || captainLocation)!.longitude,
            }
          : null;

        const points: RoutePoint[] = [
          ...(currentLocPoint ? [currentLocPoint] : []),
          routeData.start,
          ...routeData.stops,
          routeData.destination,
        ];

        const coordinates =
          points
            .map(
              point =>
                `${point.longitude},${point.latitude}`
            )
            .join(';');

        const url =
          `${OSRM_URL}/${coordinates}` +
          `?overview=full&geometries=geojson`;

        const response =
          await fetch(
            url
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          data.code !==
            'Ok' ||
          !data.routes ||
          !data.routes.length
        ) {
          throw new Error(
            'Unable to calculate road route'
          );
        }

        const route =
          data.routes[0];

        const geometry =
          route.geometry;

        if (
          !geometry ||
          !Array.isArray(
            geometry.coordinates
          )
        ) {
          throw new Error(
            'Invalid route geometry'
          );
        }

        const coordinatesFromOSRM =
          geometry.coordinates.map(
            (
              coordinate: [
                number,
                number
              ]
            ) => ({
              longitude:
                coordinate[0],

              latitude:
                coordinate[1],
            })
          );

        if (
          !mountedRef.current
        ) {
          return;
        }

        const distance =
          Number(
            route.distance ||
              0
          );

        const duration =
          Number(
            route.duration ||
              0
          );

        setRoadRoute(
          coordinatesFromOSRM
        );

        setRouteDistance(
          distance
        );

        setRouteDuration(
          duration
        );

        setRemainingDistance(
          distance
        );

        setRemainingDuration(
          duration
        );

        setTimeout(
          () => {
            if (
              mountedRef.current &&
              mapRef.current &&
              coordinatesFromOSRM.length &&
              !navigationMode
            ) {
              mapRef.current.fitToCoordinates(
                coordinatesFromOSRM,
                {
                  edgePadding: {
                    top: 80,
                    right: 40,
                    bottom: 120,
                    left: 40,
                  },

                  animated:
                    true,
                }
              );
            }
          },
          500
        );
      } catch (error) {
        console.log(
          'RYDO: OSRM route error:',
          error
        );

        if (
          mountedRef.current
        ) {
          setRoadRoute([]);

          setRouteDistance(
            0
          );

          setRouteDuration(
            0
          );

          setRouteError(
            'Unable to load road route'
          );
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setRouteLoading(
            false
          );
        }
      }
    };

  /* ===================================================
     LOAD ROAD ROUTE
  =================================================== */

  useEffect(() => {
    if (
      routeData.start &&
      routeData.destination
    ) {
      fetchRoadRoute();
    } else {
      setRoadRoute([]);

      setRouteDistance(
        0
      );

      setRouteDuration(
        0
      );

      setRemainingDistance(
        0
      );

      setRemainingDuration(
        0
      );

      setRouteError('');
    }
  }, [
    routeData.start?.latitude,
    routeData.start?.longitude,
    routeData.destination
      ?.latitude,
    routeData.destination
      ?.longitude,
    JSON.stringify(
      routeData.stops.map(
        stop => ({
          name:
            stop.name,

          latitude:
            stop.latitude,

          longitude:
            stop.longitude,
        })
      )
    ),
  ]);

  /* ===================================================
     NAVIGATION CAMERA
  =================================================== */

  useEffect(() => {
    if (
      !navigationMode ||
      !location ||
      !mapReady ||
      !mapRef.current
    ) {
      return;
    }

    mapRef.current.animateCamera(
      {
        center: {
          latitude:
            location.latitude,

          longitude:
            location.longitude,
        },

        heading:
          heading >= 0
            ? heading
            : 0,

        pitch: 50,

        zoom: 17,
      },
      {
        duration: 500,
      }
    );
  }, [
    location?.latitude,
    location?.longitude,
    heading,
    navigationMode,
    mapReady,
  ]);

  /* ===================================================
     TOGGLE NAVIGATION
  =================================================== */

  const toggleNavigationMode =
    () => {
      if (
        !location
      ) {
        Alert.alert(
          'Location Required',
          'Your current location is not available yet.'
        );

        return;
      }

      const nextMode =
        !navigationMode;

      setNavigationMode(
        nextMode
      );

      if (
        nextMode &&
        mapRef.current
      ) {
        mapRef.current.animateCamera(
          {
            center: {
              latitude:
                location.latitude,

              longitude:
                location.longitude,
            },

            heading:
              heading >= 0
                ? heading
                : 0,

            pitch: 50,

            zoom: 17,
          },
          {
            duration:
              700,
          }
        );
      }

      if (
        !nextMode &&
        mapRef.current
      ) {
        mapRef.current.animateCamera(
          {
            center: {
              latitude:
                location.latitude,

              longitude:
                location.longitude,
            },

            heading: 0,

            pitch: 0,

            zoom: 14,
          },
          {
            duration:
              700,
          }
        );

        setTimeout(
          () => {
            if (
              mapRef.current &&
              roadRoute.length >
                0
            ) {
              mapRef.current.fitToCoordinates(
                roadRoute,
                {
                  edgePadding: {
                    top: 80,
                    right: 40,
                    bottom: 120,
                    left: 40,
                  },

                  animated:
                    true,
                }
              );
            }
          },
          800
        );
      }
    };

  /* ===================================================
     SHARE RIDE
  =================================================== */

  const shareRide =
    async () => {
      try {
        await Share.share({
          message:
            `Join my RYDO ride!\n\n` +
            `Ride: ${displayRideName}\n` +
            `Captain: ${displayCaptain}\n` +
            `Ride Code: ${displayRideCode}\n\n` +
            `Open RYDO and enter this code to join.`,
        });
      } catch (error) {
        console.log(
          'RYDO: Share error:',
          error
        );
      }
    };

  /* ===================================================
     START / END RIDE
  =================================================== */

  const toggleRide =
    async () => {
      const code =
        String(
          displayRideCode
        )
          .trim()
          .toUpperCase();

      /* ===============================================
         END RIDE
      =============================================== */

      if (
        rideStarted
      ) {
        try {
          const response =
            await fetch(
              `${API_URL}/api/rides/${encodeURIComponent(
                code
              )}/status`,
              {
                method:
                  'PATCH',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body: JSON.stringify({
                  isStarted:
                    false,
                }),
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            Alert.alert(
              'Error',
              data.message ||
                'Unable to end ride.'
            );

            return;
          }

          setRideStarted(
            false
          );

          setNavigationMode(
            false
          );

          fetchRide();
        } catch (error) {
          Alert.alert(
            'Connection Error',
            'Could not connect to the backend.'
          );
        }

        return;
      }

      /* ===============================================
         START RIDE
      =============================================== */

      if (
        !routeData.start ||
        !routeData.destination
      ) {
        Alert.alert(
          'Route Required',
          'Please confirm the route before starting the ride.'
        );

        return;
      }

      if (
        roadRoute.length ===
        0
      ) {
        Alert.alert(
          'Route Loading',
          'Please wait for the road route to load.'
        );

        await fetchRoadRoute();

        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/api/rides/${encodeURIComponent(
              code
            )}/status`,
            {
              method:
                'PATCH',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                isStarted:
                  true,
              }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          Alert.alert(
            'Error',
            data.message ||
              'Unable to start ride.'
          );

          return;
        }

        setRideStarted(
          true
        );

        socketRef.current?.emit('startRide', {
          rideCode: displayRideCode,
        });

        router.push({
          pathname:
            '/live-ride-map' as any,

          params: {
            rideCode:
              displayRideCode,

            rideName:
              displayRideName,

            captainName:
              displayCaptain,

            role:
              'captain',

            userName:
              displayCaptain,
          },
        });
      } catch (error) {
        console.log(
          'RYDO: Start ride error:',
          error
        );

        Alert.alert(
          'Connection Error',
          'Could not connect to the backend.'
        );
      }
    };

  /* ===================================================
     ROUTE STATUS
  =================================================== */

  const hasRoute =
    Boolean(
      routeData.start &&
        routeData.destination
    );

  /* ===================================================
     MEMBERS
  =================================================== */

  const totalMembers =
    riders.length + 1;

  const ridersWithLocation =
    riders.filter(
      rider =>
        Boolean(
          rider.location
        )
    ).length;

  const handleViewSosLocation = async (sos: SosEvent) => {
    setSosOverlayVisible(false);
    const sosLat = sos.location?.latitude ?? sos.latitude;
    const sosLng = sos.location?.longitude ?? sos.longitude;
    if (!sosLat || !sosLng) return;

    // Focus map on the emergency location
    mapRef.current?.animateToRegion(
      {
        latitude: sosLat,
        longitude: sosLng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      1000
    );

    // Calculate emergency route from current user's location to SOS location
    const startLat = (location || captainLocation)?.latitude;
    const startLng = (location || captainLocation)?.longitude;
    if (startLat && startLng) {
      try {
        const url = `${OSRM_URL}/${startLng.toFixed(5)},${startLat.toFixed(5)};${sosLng.toFixed(5)},${sosLat.toFixed(5)}?overview=full&geometries=geojson`;
        console.log('[RYDO SOS] Calculating emergency route:', url);
        const res = await fetch(url);
        const routeJson = await res.json();
        if (routeJson.routes?.[0]?.geometry?.coordinates) {
          const coords: Coordinate[] = routeJson.routes[0].geometry.coordinates.map(
            (c: number[]) => ({ latitude: c[1], longitude: c[0] })
          );
          setEmergencyRoute(coords);
          console.log('[RYDO SOS] Emergency route calculated successfully');
        }
      } catch (e) {
        console.log('RYDO SOS: Emergency route error:', e);
      }
    }
  };

  /* ===================================================
     RENDER
  =================================================== */

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
      />

      <View
        style={
          styles.container
        }
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={
            styles.header
          }
        >
          <View>
            <Text
              style={
                styles.brand
              }
            >
              RYDO
            </Text>

            <Text
              style={
                styles.captainLabel
              }
            >
              CAPTAIN MODE
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={
                styles.status
              }
            >
              <View
                style={[
                  styles.statusDot,
                  rideStarted &&
                    styles.statusDotActive,
                ]}
              />

              <Text
                style={
                  styles.statusText
                }
              >
                {rideStarted
                  ? 'LIVE'
                  : 'READY'}
              </Text>
            </View>

            <CommunicationButton
              rideCode={displayRideCode}
              role="captain"
              userName={displayCaptain}
              size={34}
            />

            <ProfileHeaderButton size={34} />
          </View>
        </View>

        {/* =================================================
            SCROLL CONTENT
        ================================================= */}

        <ScrollView
          style={
            styles.scrollView
          }

          contentContainerStyle={
            styles.scrollContent
          }

          showsVerticalScrollIndicator={
            true
          }

          nestedScrollEnabled={
            true
          }

          keyboardShouldPersistTaps="handled"

          directionalLockEnabled={
            true
          }
        >
          {/* =================================================
              CURRENT RIDE
          ================================================= */}

          <View
            style={
              styles.rideHeader
            }
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text
                style={
                  styles.sectionLabel
                }
              >
                CURRENT RIDE
              </Text>
              <SosButton
                rideCode={displayRideCode}
                role="captain"
                userName={displayCaptain}
                socket={socketRef.current}
                onSosSent={(sos) => {
                  setActiveSosEvent(sos);
                }}
              />
            </View>

            <Text
              style={
                styles.rideName
              }
            >
              {displayRideName}
            </Text>

            <View
              style={
                styles.rideMeta
              }
            >
              <Text
                style={
                  styles.metaText
                }
              >
                RIDE CODE
              </Text>

              <Text
                style={
                  styles.code
                }
              >
                {displayRideCode}
              </Text>
            </View>
          </View>

          {/* =================================================
              ROUTE
          ================================================= */}

          <View
            style={
              styles.savedRouteSection
            }
          >
            <View
              style={
                styles.savedRouteHeader
              }
            >
              <Text
                style={
                  styles.sectionLabel
                }
              >
                CURRENT ROUTE
              </Text>

              <Text
                style={
                  styles.routeStatus
                }
              >
                {loadingRoute
                  ? 'LOADING'
                  : hasRoute
                  ? 'CONFIRMED'
                  : 'NOT SET'}
              </Text>
            </View>

            {hasRoute ? (
              <View
                style={
                  styles.savedRouteBox
                }
              >
                {/* START */}

                <View
                  style={
                    styles.routePointRow
                  }
                >
                  <View
                    style={[
                      styles.routePoint,
                      styles.routeStartPoint,
                    ]}
                  />

                  <View
                    style={
                      styles.routePointContent
                    }
                  >
                    <Text
                      style={
                        styles.routePointLabel
                      }
                    >
                      START
                    </Text>

                    <Text
                      style={
                        styles.routePointName
                      }
                    >
                      {
                        routeData
                          .start
                          ?.name
                      }
                    </Text>
                  </View>
                </View>

                {/* STOPS */}

                {routeData.stops.map(
                  (
                    stop,
                    index
                  ) => (
                    <View
                      key={`dashboard-stop-${index}`}
                      style={
                        styles.routePointRow
                      }
                    >
                      <View
                        style={[
                          styles.routePoint,
                          styles.routeStopPoint,
                        ]}
                      />

                      <View
                        style={
                          styles.routePointContent
                        }
                      >
                        <Text
                          style={
                            styles.routePointLabel
                          }
                        >
                          STOP {index + 1}
                        </Text>

                        <Text
                          style={
                            styles.routePointName
                          }
                        >
                          {stop.name}
                        </Text>
                      </View>
                    </View>
                  )
                )}

                {/* DESTINATION */}

                <View
                  style={
                    styles.routePointRow
                  }
                >
                  <View
                    style={[
                      styles.routePoint,
                      styles.routeDestinationPoint,
                    ]}
                  />

                  <View
                    style={
                      styles.routePointContent
                    }
                  >
                    <Text
                      style={
                        styles.routePointLabel
                      }
                    >
                      DESTINATION
                    </Text>

                    <Text
                      style={
                        styles.routePointName
                      }
                    >
                      {
                        routeData
                          .destination
                          ?.name
                      }
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View
                style={
                  styles.routeEmptyBox
                }
              >
                <Text
                  style={
                    styles.routeEmptyTitle
                  }
                >
                  ROUTE NOT PLANNED
                </Text>

                <Text
                  style={
                    styles.routeEmptyText
                  }
                >
                  Plan your route before
                  starting the journey.
                </Text>
              </View>
            )}
          </View>

          {/* =================================================
              MAP
          ================================================= */}

          <View
            style={
              styles.mapContainer
            }
          >
            {(location || captainLocation) ? (
              <MapView
                ref={mapRef}

                style={
                  styles.realMap
                }

                showsUserLocation={
                  false
                }

                showsMyLocationButton={
                  false
                }

                showsCompass={
                  true
                }

                showsScale={
                  true
                }

                scrollEnabled={
                  true
                }

                zoomEnabled={
                  true
                }

                zoomTapEnabled={
                  true
                }

                zoomControlEnabled={
                  true
                }

                rotateEnabled={
                  true
                }

                pitchEnabled={
                  true
                }

                toolbarEnabled={
                  false
                }

                onMapReady={() =>
                  setMapReady(
                    true
                  )
                }

                initialRegion={{
                  latitude:
                    (location || captainLocation)!.latitude,

                  longitude:
                    (location || captainLocation)!.longitude,

                  latitudeDelta:
                    0.05,

                  longitudeDelta:
                    0.05,
                }}
              >
                {/* =========================================
                    ROAD ROUTE
                ========================================= */}

                {roadRoute.length >
                  1 && (
                  <Polyline
                    coordinates={
                      roadRoute
                    }

                    strokeWidth={
                      6
                    }

                    strokeColor={
                      '#1677FF'
                    }

                    lineCap="round"

                    lineJoin="round"
                  />
                )}

                {/* =========================================
                    EMERGENCY SOS ROUTE (RED)
                ========================================= */}

                {emergencyRoute.length > 1 && (
                  <Polyline
                    coordinates={emergencyRoute}
                    strokeColor="#EF4444"
                    strokeWidth={6}
                    lineCap="round"
                    lineJoin="round"
                    zIndex={40}
                  />
                )}

                {/* =========================================
                    CAPTAIN MARKER
                ========================================= */}

                <Marker
                  identifier="captain-marker"

                  coordinate={{
                    latitude:
                      (location || captainLocation)!.latitude,

                    longitude:
                      (location || captainLocation)!.longitude,
                  }}

                  rotation={
                    heading || 0
                  }

                  flat={
                    true
                  }

                  anchor={{
                    x: 0.5,
                    y: 0.5,
                  }}

                  tracksViewChanges={
                    true
                  }

                  title={
                    `${displayCaptain} • Captain`
                  }
                >
                  <View
                    style={
                      styles.captainMarker
                    }
                  >
                    <View
                      style={
                        styles.captainMarkerArrow
                      }
                    />
                  </View>
                </Marker>

                {/* =========================================
                    RIDER MARKERS
                ========================================= */}

                {(() => {
                  const ridersWithValidLoc = riders.filter(
                    (r) => r.location && Number.isFinite(Number(r.location.latitude)) && Number.isFinite(Number(r.location.longitude))
                  );
                  console.log(
                    '[CAPTAIN MAP] rendering rider markers:',
                    riders.map((r) => ({
                      userId: r._id,
                      name: r.name,
                      latitude: r.location?.latitude,
                      longitude: r.location?.longitude,
                    }))
                  );
                  console.log(
                    '[CAPTAIN MAP] total rider locations:',
                    ridersWithValidLoc.length
                  );
                  return null;
                })()}

                {riders.map(
                  (
                    rider,
                    index
                  ) => {
                    if (
                      !rider.location ||
                      !Number.isFinite(Number(rider.location.latitude)) ||
                      !Number.isFinite(Number(rider.location.longitude))
                    ) {
                      return null;
                    }

                    const isLive = isRiderLive(rider);
                    const initial = String(rider.name || 'R')
                      .charAt(0)
                      .toUpperCase();
                    const isSelected =
                      selectedRider &&
                      ((selectedRider._id && selectedRider._id === rider._id) ||
                        selectedRider.name === rider.name);

                    return (
                      <Marker
                        key={`rider-${rider._id || rider.name || index}`}

                        identifier={`rider-${rider._id || rider.name || index}`}

                        coordinate={{
                          latitude: Number(rider.location.latitude),
                          longitude: Number(rider.location.longitude),
                        }}

                        title={rider.name}

                        description={`RYDO RIDER • ${getRiderStatusLabel(rider)}`}

                        onPress={() => setSelectedRider(rider)}

                        tracksViewChanges={true}

                        zIndex={isSelected ? 50 : 25}
                      >
                        <View
                          style={
                            styles.riderMarkerWrapper
                          }
                        >
                          <View
                            style={[
                              styles.riderMarker,
                              isLive
                                ? styles.riderMarkerLive
                                : styles.riderMarkerOffline,
                              isSelected &&
                                styles.riderMarkerSelected,
                            ]}
                          >
                            <Text
                              style={
                                styles.riderMarkerText
                              }
                            >
                              {initial}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.riderMarkerBadge
                            }
                          >
                            <View
                              style={[
                                styles.riderMarkerDot,
                                isLive
                                  ? styles.riderMarkerDotLive
                                  : styles.riderMarkerDotOffline,
                              ]}
                            />
                            <Text
                              style={
                                styles.riderMarkerName
                              }
                              numberOfLines={1}
                            >
                              {rider.name}
                            </Text>
                          </View>
                        </View>
                      </Marker>
                    );
                  }
                )}

                {/* =========================================
                    ACTIVE SOS EMERGENCY MARKER
                ========================================= */}

                {activeSosEvent && (
                  <Marker
                    key={`sos-marker-${activeSosEvent.eventId || activeSosEvent.userId || 'emergency'}`}
                    coordinate={{
                      latitude: Number(activeSosEvent.location?.latitude ?? activeSosEvent.latitude),
                      longitude: Number(activeSosEvent.location?.longitude ?? activeSosEvent.longitude),
                    }}
                    title={`🚨 SOS: ${activeSosEvent.name || activeSosEvent.riderName}`}
                    description="EMERGENCY LOCATION • TAP FOR DETAILS"
                    onPress={() => setSosOverlayVisible(true)}
                    tracksViewChanges={true}
                    zIndex={100}
                  >
                    <View style={styles.sosMarkerWrapper}>
                      <View style={styles.sosMarkerOuter}>
                        <Text style={styles.sosMarkerIcon}>🚨</Text>
                      </View>
                      <View style={styles.sosMarkerBadge}>
                        <Text style={styles.sosMarkerBadgeText} numberOfLines={1}>
                          SOS • {activeSosEvent.name || activeSosEvent.riderName} ({activeSosEvent.role?.toUpperCase()})
                        </Text>
                      </View>
                    </View>
                  </Marker>
                )}

                {/* =========================================
                    DESTINATION
                ========================================= */}

                {routeData.destination && (
                  <Marker
                    identifier="destination-marker"

                    coordinate={{
                      latitude:
                        routeData
                          .destination
                          .latitude,

                      longitude:
                        routeData
                          .destination
                          .longitude,
                    }}

                    title={
                      routeData
                        .destination
                        .name
                    }
                  >
                    <View
                      style={
                        styles.destinationMarker
                      }
                    >
                      <View
                        style={
                          styles.destinationMarkerInner
                        }
                      />
                    </View>
                  </Marker>
                )}
              </MapView>
            ) : (
              <View
                style={
                  styles.locationLoading
                }
              >
                <Text
                  style={
                    styles.locationLoadingTitle
                  }
                >
                  {locationLoading
                    ? 'LOCATING...'
                    : 'LOCATION REQUIRED'}
                </Text>

                <Text
                  style={
                    styles.locationLoadingText
                  }
                >
                  {locationLoading
                    ? 'Getting your current position'
                    : locationPermission
                    ? 'Unable to get your location'
                    : 'Allow RYDO to access your location'}
                </Text>
              </View>
            )}

            {/* =========================================
                MAP HEADER
            ========================================= */}

            <View
              style={
                styles.mapHeaderOverlay
              }
            >
              <View
                style={
                  styles.mapHeaderBox
                }
              >
                <Text
                  style={
                    styles.mapLabel
                  }
                >
                  {navigationMode
                    ? 'NAVIGATION'
                    : 'RYDO ROUTE'}
                </Text>

                <Text
                  style={
                    styles.mapStatus
                  }
                >
                  {routeLoading
                    ? 'LOADING'
                    : roadRoute.length >
                      0
                    ? 'ROUTE READY'
                    : 'READY'}
                </Text>
              </View>
            </View>

            {/* =========================================
                LIVE RIDER COUNT
            ========================================= */}

            <View
              style={
                styles.liveCountBadge
              }
            >
              <View
                style={
                  styles.liveCountDot
                }
              />

              <Text
                style={
                  styles.liveCountText
                }
              >
                {ridersWithLocation}{' '}
                / {riders.length}{' '}
                RIDERS LIVE
              </Text>
            </View>

            {/* =========================================
                DISTANCE / ETA
            ========================================= */}

            {hasRoute &&
              roadRoute.length >
                0 && (
                <View
                  style={
                    styles.navigationInfo
                  }
                >
                  <View
                    style={
                      styles.navigationInfoItem
                    }
                  >
                    <Text
                      style={
                        styles.navigationInfoValue
                      }
                    >
                      {formatDistance(
                        remainingDistance
                      )}
                    </Text>

                    <Text
                      style={
                        styles.navigationInfoLabel
                      }
                    >
                      REMAINING
                    </Text>
                  </View>

                  <View
                    style={
                      styles.navigationDivider
                    }
                  />

                  <View
                    style={
                      styles.navigationInfoItem
                    }
                  >
                    <Text
                      style={
                        styles.navigationInfoValue
                      }
                    >
                      {formatDuration(
                        remainingDuration
                      )}
                    </Text>

                    <Text
                      style={
                        styles.navigationInfoLabel
                      }
                    >
                      ETA
                    </Text>
                  </View>

                  <View
                    style={
                      styles.navigationDestination
                    }
                  >
                    <Text
                      numberOfLines={
                        1
                      }

                      style={
                        styles.navigationDestinationText
                      }
                    >
                      {routeData
                        .destination
                        ?.name ||
                        'Destination'}
                    </Text>
                  </View>
                </View>
              )}

            {/* =========================================
                SELECTED RIDER INFO CARD
            ========================================= */}

            {selectedRider && (
              <View style={styles.selectedRiderCard}>
                <View style={styles.selectedRiderHeader}>
                  <View
                    style={[
                      styles.selectedRiderAvatar,
                      isRiderLive(selectedRider)
                        ? styles.selectedRiderAvatarLive
                        : styles.selectedRiderAvatarOffline,
                    ]}
                  >
                    <Text style={styles.selectedRiderAvatarText}>
                      {String(selectedRider.name || 'R')
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.selectedRiderInfo}>
                    <Text style={styles.selectedRiderName} numberOfLines={1}>
                      {selectedRider.name}
                    </Text>
                    <Text style={styles.selectedRiderRole}>
                      RYDO RIDER
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setSelectedRider(null)}
                    style={styles.selectedRiderClose}
                  >
                    <Text style={styles.selectedRiderCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.selectedRiderMetaRow}>
                  <View
                    style={[
                      styles.selectedRiderStatusDot,
                      isRiderLive(selectedRider)
                        ? styles.riderStatusDotLive
                        : styles.riderStatusDotOffline,
                    ]}
                  />
                  <Text style={styles.selectedRiderStatusText}>
                    {getRiderStatusLabel(selectedRider)}
                  </Text>

                  {selectedRider.location && (
                    <Text style={styles.selectedRiderCoordsText}>
                      {selectedRider.location.latitude.toFixed(4)}, {selectedRider.location.longitude.toFixed(4)}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* =========================================
                NAVIGATION BUTTON
            ========================================= */}

            {location && (
              <TouchableOpacity
                activeOpacity={
                  0.8
                }

                style={[
                  styles.navigationButton,

                  navigationMode &&
                    styles.navigationButtonActive,
                ]}

                onPress={
                  toggleNavigationMode
                }
              >
                <Text
                  style={[
                    styles.navigationButtonIcon,

                    navigationMode &&
                      styles.navigationButtonIconActive,
                  ]}
                >
                  {navigationMode
                    ? '✕'
                    : '➤'}
                </Text>

                <Text
                  style={[
                    styles.navigationButtonText,

                    navigationMode &&
                      styles.navigationButtonTextActive,
                  ]}
                >
                  {navigationMode
                    ? 'EXIT'
                    : 'NAVIGATE'}
                </Text>
              </TouchableOpacity>
            )}

            {/* =========================================
                ERROR
            ========================================= */}

            {routeError !==
              '' && (
              <View
                style={
                  styles.mapError
                }
              >
                <Text
                  style={
                    styles.mapErrorText
                  }
                >
                  {routeError}
                </Text>
              </View>
            )}
          </View>

          {/* =================================================
              LIVE LOCATIONS
          ================================================= */}

          <View
            style={
              styles.liveCrewSection
            }
          >
            <View
              style={
                styles.liveCrewHeader
              }
            >
              <Text
                style={
                  styles.sectionLabel
                }
              >
                LIVE LOCATIONS
              </Text>

              <Text
                style={
                  styles.liveCrewCount
                }
              >
                {ridersWithLocation}
                {' / '}
                {riders.length}
              </Text>
            </View>

            {riders.length ===
            0 ? (
              <View
                style={
                  styles.liveEmpty
                }
              >
                <Text
                  style={
                    styles.liveEmptyText
                  }
                >
                  NO RIDERS HAVE JOINED
                </Text>
              </View>
            ) : (
              riders.map(
                (
                  rider,
                  index
                ) => {
                  const isLive = isRiderLive(rider);
                  const isSelected =
                    selectedRider &&
                    ((selectedRider._id && selectedRider._id === rider._id) ||
                      selectedRider.name === rider.name);

                  return (
                    <TouchableOpacity
                      key={
                        rider._id ||
                        `${rider.name}-${index}`
                      }
                      activeOpacity={0.7}
                      onPress={() => setSelectedRider(rider)}
                      style={[
                        styles.liveRiderRow,
                        isSelected && styles.liveRiderRowSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.liveRiderDot,
                          isLive
                            ? styles.riderMarkerDotLive
                            : styles.riderMarkerDotOffline,
                        ]}
                      />

                      <View
                        style={
                          styles.liveRiderInfo
                        }
                      >
                        <Text
                          style={
                            styles.liveRiderName
                          }
                        >
                          {rider.name}
                        </Text>

                        <Text
                          style={[
                            styles.liveRiderStatus,
                            isLive && styles.liveRiderStatusActive,
                          ]}
                        >
                          {getRiderStatusLabel(rider)}
                        </Text>
                      </View>

                      {rider.location && (
                        <Text
                          style={
                            styles.liveRiderCoords
                          }
                        >
                          {rider.location.latitude.toFixed(
                            4
                          )}

                          {'\n'}

                          {rider.location.longitude.toFixed(
                            4
                          )}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                }
              )
            )}
          </View>

          {/* =================================================
              CREW
          ================================================= */}

          <View
            style={
              styles.crewSection
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                CREW
              </Text>

              <Text
                style={
                  styles.memberCount
                }
              >
                {totalMembers}{' '}
                {totalMembers ===
                1
                  ? 'MEMBER'
                  : 'MEMBERS'}
              </Text>
            </View>

            {/* CAPTAIN */}

            <View
              style={
                styles.member
              }
            >
              <View
                style={
                  styles.memberNumber
                }
              >
                <Text
                  style={
                    styles.number
                  }
                >
                  01
                </Text>
              </View>

              <View
                style={
                  styles.memberInfo
                }
              >
                <Text
                  style={
                    styles.memberName
                  }
                >
                  {displayCaptain}
                </Text>

                <Text
                  style={
                    styles.memberRole
                  }
                >
                  CAPTAIN • YOU
                </Text>
              </View>

              <View
                style={
                  styles.memberStatus
                }
              >
                <View
                  style={
                    styles.memberDot
                  }
                />

                <Text
                  style={
                    styles.online
                  }
                >
                  ONLINE
                </Text>
              </View>
            </View>

            {/* RIDERS */}

            {riders.map(
              (
                rider,
                index
              ) => (
                <View
                  key={
                    rider._id ||
                    `${rider.name}-${index}`
                  }

                  style={
                    styles.member
                  }
                >
                  <View
                    style={
                      styles.memberNumber
                    }
                  >
                    <Text
                      style={
                        styles.number
                      }
                    >
                      {String(
                        index + 2
                      ).padStart(
                        2,
                        '0'
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.memberInfo
                    }
                  >
                    <Text
                      style={
                        styles.memberName
                      }
                    >
                      {rider.name}
                    </Text>

                    <Text
                      style={
                        styles.memberRole
                      }
                    >
                      RIDER
                    </Text>
                  </View>

                  <View
                    style={
                      styles.memberStatus
                    }
                  >
                  <View
                    style={[
                      styles.memberDot,
                      !isRiderLive(rider) &&
                        styles.memberDotOffline,
                    ]}
                  />

                  <Text
                    style={
                      styles.online
                    }
                  >
                    {isRiderLive(rider)
                      ? 'LIVE'
                      : rider.location
                      ? getRiderStatusLabel(rider)
                      : 'OFFLINE'}
                  </Text>
                </View>
                </View>
              )
            )}

            {!loadingRiders &&
              riders.length ===
                0 && (
                <View
                  style={
                    styles.emptyCrew
                  }
                >
                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    WAITING FOR YOUR CREW
                  </Text>

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    Share the ride code
                    to invite riders.
                  </Text>
                </View>
              )}

            {loadingRiders && (
              <View
                style={
                  styles.emptyCrew
                }
              >
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  LOADING CREW
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Checking for riders...
                </Text>
              </View>
            )}
          </View>

          {/* =================================================
              ROUTE PLANNING
          ================================================= */}

          <View
            style={
              styles.routeSection
            }
          >
            <Text
              style={
                styles.sectionLabel
              }
            >
              JOURNEY PLANNING
            </Text>

            <TouchableOpacity
              activeOpacity={
                0.8
              }

              style={
                styles.routeButton
              }

              onPress={() => {
                router.push({
                  pathname:
                    '/route-planner',

                  params: {
                    rideName:
                      displayRideName,

                    captainName:
                      displayCaptain,

                    rideCode:
                      displayRideCode,
                  },
                });
              }}
            >
              <View>
                <Text
                  style={
                    styles.routeButtonTitle
                  }
                >
                  PLAN YOUR ROUTE
                </Text>

                <Text
                  style={
                    styles.routeButtonSubtitle
                  }
                >
                  Set destination and
                  add stops
                </Text>
              </View>

              <Text
                style={
                  styles.routeButtonArrow
                }
              >
                →
              </Text>
            </TouchableOpacity>
          </View>

          {/* =================================================
              RIDE CONTROL
          ================================================= */}

          <View
            style={
              styles.controlSection
            }
          >
            <Text
              style={
                styles.sectionLabel
              }
            >
              RIDE CONTROL
            </Text>

            <TouchableOpacity
              activeOpacity={
                0.8
              }

              style={[
                styles.startButton,

                rideStarted &&
                  styles.stopButton,
              ]}

              onPress={
                toggleRide
              }
            >
              <Text
                style={[
                  styles.startButtonText,

                  rideStarted &&
                    styles.stopButtonText,
                ]}
              >
                {rideStarted
                  ? 'END RIDE'
                  : 'START RIDE'}
              </Text>

              <Text
                style={[
                  styles.startArrow,

                  rideStarted &&
                    styles.stopButtonText,
                ]}
              >
                →
              </Text>
            </TouchableOpacity>

            {rideStarted && (
              <SosButton
                rideCode={displayRideCode}
                role="captain"
                userName={displayCaptain}
                socket={socketRef.current}
                onSosSent={(sos) => {
                  setActiveSosEvent(sos);
                }}
                style={{ marginTop: 14 }}
              />
            )}
          </View>

          {/* =================================================
              SHARE
          ================================================= */}

          <TouchableOpacity
            activeOpacity={
              0.75
            }

            style={
              styles.shareButton
            }

            onPress={
              shareRide
            }
          >
            <Text
              style={
                styles.shareText
              }
            >
              SHARE RIDE CODE
            </Text>

            <Text
              style={
                styles.shareArrow
              }
            >
              ↗
            </Text>
          </TouchableOpacity>

          {/* =================================================
              MANAGEMENT
          ================================================= */}

          <View
            style={
              styles.managementSection
            }
          >
            <Text
              style={
                styles.sectionLabel
              }
            >
              CREW MANAGEMENT
            </Text>

            <TouchableOpacity
              activeOpacity={
                0.75
              }

              style={
                styles.managementButton
              }

              onPress={() => {
                console.log(
                  'CREW MEMBERS:',
                  riders
                );
              }}
            >
              <Text
                style={
                  styles.managementText
                }
              >
                VIEW CREW MEMBERS
              </Text>

              <Text
                style={
                  styles.managementArrow
                }
              >
                →
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={
                0.75
              }

              style={
                styles.managementButton
              }

              onPress={() => {
                console.log(
                  'RIDE SETTINGS'
                );
              }}
            >
              <Text
                style={
                  styles.managementText
                }
              >
                RIDE SETTINGS
              </Text>

              <Text
                style={
                  styles.managementArrow
                }
              >
                →
              </Text>
            </TouchableOpacity>
          </View>

          {/* =================================================
              BOTTOM
          ================================================= */}

          <View
            style={
              styles.bottom
            }
          >
            <View
              style={
                styles.bottomLine
              }
            />

            <Text
              style={
                styles.bottomText
              }
            >
              RYDO • RIDE DIFFERENT
            </Text>
          </View>
        </ScrollView>

        <SosEmergencyOverlay
          visible={sosOverlayVisible}
          sosEvent={activeSosEvent}
          currentLocation={location || captainLocation}
          onViewLocation={handleViewSosLocation}
          onDismiss={() => setSosOverlayVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
}

/* =====================================================
   STYLES
===================================================== */

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        '#000000',
    },

    container: {
      flex: 1,
      backgroundColor:
        '#000000',
    },

    scrollView: {
      flex: 1,
    },

    scrollContent: {
      paddingHorizontal:
        22,

      paddingTop: 5,

      /*
        Extra bottom space fixes
        the bottom of the dashboard
        being hidden.
      */
      paddingBottom: 110,

      flexGrow: 1,
    },

    /* =================================================
       HEADER
    ================================================= */

    header: {
      height: 70,

      paddingHorizontal:
        22,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    brand: {
      color:
        '#FFFFFF',

      fontSize: 18,

      fontWeight:
        '900',

      letterSpacing: 5,
    },

    captainLabel: {
      color:
        '#555555',

      fontSize: 8,

      fontWeight:
        '700',

      letterSpacing: 2,

      marginTop: 3,
    },

    status: {
      flexDirection:
        'row',

      alignItems:
        'center',

      borderWidth: 1,

      borderColor:
        '#292929',

      paddingHorizontal:
        10,

      paddingVertical:
        7,
    },

    statusDot: {
      width: 6,
      height: 6,

      borderRadius: 3,

      backgroundColor:
        '#555555',

      marginRight: 7,
    },

    statusDotActive: {
      backgroundColor:
        '#1677FF',
    },

    statusText: {
      color:
        '#AAAAAA',

      fontSize: 8,

      fontWeight:
        '800',

      letterSpacing: 1.5,
    },

    /* =================================================
       RIDE
    ================================================= */

    rideHeader: {
      marginTop: 22,
    },

    sectionLabel: {
      color:
        '#555555',

      fontSize: 9,

      fontWeight:
        '700',

      letterSpacing: 2,
    },

    rideName: {
      color:
        '#FFFFFF',

      fontSize: 31,

      fontWeight:
        '800',

      letterSpacing: -1,

      marginTop: 8,
    },

    rideMeta: {
      flexDirection:
        'row',

      alignItems:
        'center',

      marginTop: 10,
    },

    metaText: {
      color:
        '#555555',

      fontSize: 8,

      fontWeight:
        '700',

      letterSpacing: 1.5,

      marginRight: 10,
    },

    code: {
      color:
        '#FFFFFF',

      fontSize: 11,

      fontWeight:
        '800',

      letterSpacing: 2,
    },

    /* =================================================
       ROUTE
    ================================================= */

    savedRouteSection: {
      marginTop: 28,
    },

    savedRouteHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom: 12,
    },

    routeStatus: {
      color:
        '#777777',

      fontSize: 8,

      fontWeight:
        '700',

      letterSpacing: 1.5,
    },

    savedRouteBox: {
      borderWidth: 1,

      borderColor:
        '#252525',

      paddingHorizontal:
        16,

      paddingVertical:
        8,

      backgroundColor:
        '#050505',
    },

    routePointRow: {
      minHeight: 62,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#181818',
    },

    routePoint: {
      width: 9,
      height: 9,

      borderRadius: 5,

      marginRight: 15,
    },

    routeStartPoint: {
      backgroundColor:
        '#FFFFFF',
    },

    routeStopPoint: {
      width: 7,
      height: 7,

      borderRadius: 4,

      backgroundColor:
        '#777777',

      marginLeft: 1,

      marginRight: 16,
    },

    routeDestinationPoint: {
      width: 11,
      height: 11,

      borderRadius: 6,

      backgroundColor:
        '#1677FF',

      marginLeft: -1,

      marginRight: 14,
    },

    routePointContent: {
      flex: 1,
    },

    routePointLabel: {
      color:
        '#555555',

      fontSize: 7,

      fontWeight:
        '700',

      letterSpacing: 1.5,

      marginBottom: 4,
    },

    routePointName: {
      color:
        '#FFFFFF',

      fontSize: 13,

      fontWeight:
        '700',
    },

    routeEmptyBox: {
      borderWidth: 1,

      borderColor:
        '#252525',

      paddingHorizontal:
        16,

      paddingVertical:
        18,

      backgroundColor:
        '#050505',
    },

    routeEmptyTitle: {
      color:
        '#777777',

      fontSize: 10,

      fontWeight:
        '700',

      letterSpacing: 1.5,
    },

    routeEmptyText: {
      color:
        '#444444',

      fontSize: 11,

      marginTop: 5,

      lineHeight: 16,
    },

    /* =================================================
       MAP
    ================================================= */

    mapContainer: {
      height: 390,

      borderWidth: 1,

      borderColor:
        '#252525',

      marginTop: 25,

      overflow:
        'hidden',

      position:
        'relative',

      backgroundColor:
        '#050505',
    },

    realMap: {
      width:
        '100%',

      height:
        '100%',
    },

    /* =================================================
       SOS EMERGENCY MARKER
    ================================================= */

    sosMarkerWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    sosMarkerOuter: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#DC2626',
      borderWidth: 3,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#EF4444',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.8,
      shadowRadius: 10,
      elevation: 12,
    },

    sosMarkerIcon: {
      fontSize: 20,
    },

    sosMarkerBadge: {
      backgroundColor: '#DC2626',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginTop: 4,
      borderWidth: 1,
      borderColor: '#FFFFFF',
      maxWidth: 160,
    },

    sosMarkerBadgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    /* =================================================
       CAPTAIN MARKER
    ================================================= */

    captainMarker: {
      width: 46,
      height: 46,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    captainMarkerArrow: {
      width: 0,
      height: 0,

      borderLeftWidth:
        12,

      borderRightWidth:
        12,

      borderBottomWidth:
        32,

      borderLeftColor:
        'transparent',

      borderRightColor:
        'transparent',

      borderBottomColor:
        '#1677FF',

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.6,

      shadowRadius: 5,

      elevation: 8,
    },

    /* =================================================
       RIDER MARKER
    ================================================= */

    riderMarkerWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    riderMarker: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#1677FF',
      borderWidth: 2.5,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.6,
      shadowRadius: 5,
      elevation: 8,
    },

    riderMarkerLive: {
      backgroundColor: '#1677FF',
      borderColor: '#22C55E',
      borderWidth: 2.5,
    },

    riderMarkerOffline: {
      backgroundColor: '#444444',
      borderColor: '#888888',
      borderWidth: 2,
    },

    riderMarkerSelected: {
      borderColor: '#FACC15',
      borderWidth: 3,
      transform: [{ scale: 1.15 }],
    },

    riderMarkerText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
    },

    riderMarkerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.85)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 3,
      borderWidth: 0.5,
      borderColor: '#333333',
      maxWidth: 90,
    },

    riderMarkerDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      marginRight: 4,
    },

    riderMarkerDotLive: {
      backgroundColor: '#22C55E',
    },

    riderMarkerDotOffline: {
      backgroundColor: '#777777',
    },

    riderMarkerName: {
      color: '#FFFFFF',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.5,
    },

    /* =================================================
       SELECTED RIDER FLOATING CARD
    ================================================= */

    selectedRiderCard: {
      position: 'absolute',
      bottom: 85,
      left: 14,
      right: 14,
      backgroundColor: '#0D0D0D',
      borderWidth: 1.5,
      borderColor: '#1677FF',
      borderRadius: 8,
      padding: 12,
      zIndex: 35,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.7,
      shadowRadius: 8,
      elevation: 12,
    },

    selectedRiderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    selectedRiderAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#1677FF',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },

    selectedRiderAvatarLive: {
      backgroundColor: '#1677FF',
      borderWidth: 2,
      borderColor: '#22C55E',
    },

    selectedRiderAvatarOffline: {
      backgroundColor: '#333333',
      borderWidth: 1.5,
      borderColor: '#666666',
    },

    selectedRiderAvatarText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
    },

    selectedRiderInfo: {
      flex: 1,
    },

    selectedRiderName: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.5,
    },

    selectedRiderRole: {
      color: '#1677FF',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginTop: 2,
    },

    selectedRiderClose: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#1A1A1A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    selectedRiderCloseText: {
      color: '#AAAAAA',
      fontSize: 12,
      fontWeight: '700',
    },

    selectedRiderMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#1A1A1A',
    },

    selectedRiderStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      marginRight: 6,
    },

    selectedRiderStatusText: {
      color: '#CCCCCC',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.8,
      flex: 1,
    },

    selectedRiderCoordsText: {
      color: '#666666',
      fontSize: 8,
      fontWeight: '600',
    },

    liveRiderRowSelected: {
      backgroundColor: 'rgba(22,119,255,0.12)',
      borderLeftWidth: 3,
      borderLeftColor: '#1677FF',
    },

    liveRiderStatusActive: {
      color: '#22C55E',
      fontWeight: '800',
    },

    riderStatusDotLive: {
      backgroundColor: '#22C55E',
    },

    riderStatusDotOffline: {
      backgroundColor: '#666666',
    },

    /* =================================================
       DESTINATION
    ================================================= */

    destinationMarker: {
      width: 30,
      height: 30,

      borderRadius: 15,

      backgroundColor:
        '#FFFFFF',

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth: 2,

      borderColor:
        '#1677FF',

      elevation: 5,
    },

    destinationMarkerInner: {
      width: 12,
      height: 12,

      borderRadius: 6,

      backgroundColor:
        '#1677FF',
    },

    /* =================================================
       MAP HEADER
    ================================================= */

    mapHeaderOverlay: {
      position:
        'absolute',

      top: 14,

      left: 14,

      right: 14,

      zIndex: 20,

      pointerEvents:
        'none',
    },

    mapHeaderBox: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',
    },

    mapLabel: {
      color:
        '#FFFFFF',

      fontSize: 8,

      fontWeight:
        '700',

      letterSpacing: 1.5,

      backgroundColor:
        'rgba(0,0,0,0.82)',

      paddingHorizontal: 9,

      paddingVertical: 6,
    },

    mapStatus: {
      color:
        '#FFFFFF',

      fontSize: 8,

      fontWeight:
        '700',

      letterSpacing: 1,

      backgroundColor:
        'rgba(22,119,255,0.9)',

      paddingHorizontal: 9,

      paddingVertical: 6,
    },

    /* =================================================
       LIVE COUNT
    ================================================= */

    liveCountBadge: {
      position:
        'absolute',

      top: 57,

      left: 14,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        'rgba(0,0,0,0.82)',

      paddingHorizontal: 9,

      paddingVertical: 6,

      zIndex: 20,

      pointerEvents:
        'none',
    },

    liveCountDot: {
      width: 6,
      height: 6,

      borderRadius: 3,

      backgroundColor:
        '#1677FF',

      marginRight: 6,
    },

    liveCountText: {
      color:
        '#FFFFFF',

      fontSize: 7,

      fontWeight:
        '800',

      letterSpacing: 1,
    },

    /* =================================================
       NAVIGATION INFO
    ================================================= */

    navigationInfo: {
      position:
        'absolute',

      left: 12,

      right: 12,

      bottom: 12,

      minHeight: 74,

      backgroundColor:
        'rgba(0,0,0,0.90)',

      borderWidth: 1,

      borderColor:
        '#333333',

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        14,

      zIndex: 20,

      pointerEvents:
        'none',
    },

    navigationInfoItem: {
      width: 70,
    },

    navigationInfoValue: {
      color:
        '#FFFFFF',

      fontSize: 17,

      fontWeight:
        '800',
    },

    navigationInfoLabel: {
      color:
        '#777777',

      fontSize: 7,

      fontWeight:
        '700',

      letterSpacing: 1.3,

      marginTop: 3,
    },

    navigationDivider: {
      width: 1,

      height: 35,

      backgroundColor:
        '#333333',

      marginHorizontal: 10,
    },

    navigationDestination: {
      flex: 1,

      marginLeft: 12,

      paddingLeft: 12,

      borderLeftWidth:
        1,

      borderLeftColor:
        '#333333',
    },

    navigationDestinationText: {
      color:
        '#AAAAAA',

      fontSize: 9,

      fontWeight:
        '700',

      letterSpacing: 0.8,
    },

    /* =================================================
       NAVIGATION BUTTON
    ================================================= */

    navigationButton: {
      position:
        'absolute',

      top: 95,

      right: 14,

      width: 62,

      height: 62,

      borderRadius: 31,

      backgroundColor:
        'rgba(0,0,0,0.90)',

      borderWidth: 2,

      borderColor:
        '#1677FF',

      alignItems:
        'center',

      justifyContent:
        'center',

      zIndex: 30,

      elevation: 10,
    },

    navigationButtonActive: {
      backgroundColor:
        '#1677FF',

      borderColor:
        '#FFFFFF',
    },

    navigationButtonIcon: {
      color:
        '#1677FF',

      fontSize: 20,

      fontWeight:
        '900',
    },

    navigationButtonIconActive: {
      color:
        '#FFFFFF',
    },

    navigationButtonText: {
      color:
        '#FFFFFF',

      fontSize: 6,

      fontWeight:
        '800',

      letterSpacing:
        0.8,

      marginTop: 2,
    },

    navigationButtonTextActive: {
      color:
        '#FFFFFF',
    },

    /* =================================================
       MAP ERROR
    ================================================= */

    mapError: {
      position:
        'absolute',

      top: 160,

      left: 12,

      right: 12,

      backgroundColor:
        'rgba(0,0,0,0.90)',

      padding: 10,

      zIndex: 30,

      pointerEvents:
        'none',
    },

    mapErrorText: {
      color:
        '#FFFFFF',

      fontSize: 9,

      textAlign:
        'center',
    },

    locationLoading: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#050505',
    },

    locationLoadingTitle: {
      color:
        '#FFFFFF',

      fontSize: 10,

      fontWeight:
        '800',

      letterSpacing:
        1.5,

      textAlign:
        'center',
    },

    locationLoadingText: {
      color:
        '#555555',

      fontSize: 10,

      marginTop: 7,

      textAlign:
        'center',

      paddingHorizontal:
        20,
    },

    /* =================================================
       LIVE LOCATIONS
    ================================================= */

    liveCrewSection: {
      marginTop: 20,

      borderWidth: 1,

      borderColor:
        '#252525',

      backgroundColor:
        '#050505',
    },

    liveCrewHeader: {
      minHeight: 48,

      paddingHorizontal:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderBottomWidth: 1,

      borderBottomColor:
        '#202020',
    },

    liveCrewCount: {
      color:
        '#1677FF',

      fontSize: 9,

      fontWeight:
        '800',

      letterSpacing: 1,
    },

    liveRiderRow: {
      minHeight: 62,

      paddingHorizontal:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth: 1,

      borderBottomColor:
        '#181818',
    },

    liveRiderDot: {
      width: 8,
      height: 8,

      borderRadius: 4,

      backgroundColor:
        '#1677FF',

      marginRight: 12,
    },

    liveRiderDotOffline: {
      backgroundColor:
        '#444444',
    },

    liveRiderInfo: {
      flex: 1,
    },

    liveRiderName: {
      color:
        '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '700',
    },

    liveRiderStatus: {
      color:
        '#555555',

      fontSize: 7,

      fontWeight:
        '700',

      letterSpacing: 1,

      marginTop: 4,
    },

    liveRiderCoords: {
      color:
        '#666666',

      fontSize: 7,

      textAlign:
        'right',

      lineHeight: 12,
    },

    liveEmpty: {
      padding: 18,
    },

    liveEmptyText: {
      color:
        '#555555',

      fontSize: 8,

      fontWeight:
        '700',

      letterSpacing: 1.2,
    },

    /* =================================================
       CREW
    ================================================= */

    crewSection: {
      marginTop: 28,
    },

    sectionHeader: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      marginBottom: 13,
    },

    sectionTitle: {
      color:
        '#FFFFFF',

      fontSize: 14,

      fontWeight:
        '800',

      letterSpacing: 1,
    },

    memberCount: {
      color:
        '#555555',

      fontSize: 8,

      fontWeight:
        '700',

      letterSpacing: 1,
    },

    member: {
      minHeight: 65,

      borderTopWidth: 1,

      borderBottomWidth: 1,

      borderColor:
        '#242424',

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    memberNumber: {
      width: 35,
    },

    number: {
      color:
        '#555555',

      fontSize: 9,

      fontWeight:
        '700',
    },

    memberInfo: {
      flex: 1,
    },

    memberName: {
      color:
        '#FFFFFF',

      fontSize: 13,

      fontWeight:
        '700',
    },

    memberRole: {
      color:
        '#555555',

      fontSize: 8,

      fontWeight:
        '700',

      letterSpacing: 1,

      marginTop: 3,
    },

    memberStatus: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    memberDot: {
      width: 5,
      height: 5,

      borderRadius: 3,

      backgroundColor:
        '#1677FF',

      marginRight: 6,
    },

    memberDotOffline: {
      backgroundColor:
        '#444444',
    },

    online: {
      color:
        '#666666',

      fontSize: 7,

      fontWeight:
        '700',

      letterSpacing: 1,
    },

    emptyCrew: {
      paddingVertical:
        20,

      borderBottomWidth: 1,

      borderColor:
        '#242424',
    },

    emptyTitle: {
      color:
        '#777777',

      fontSize: 10,

      fontWeight:
        '700',

      letterSpacing: 1.5,
    },

    emptyText: {
      color:
        '#444444',

      fontSize: 11,

      marginTop: 5,
    },

    /* =================================================
       ROUTE PLANNING
    ================================================= */

    routeSection: {
      marginTop: 28,
    },

    routeButton: {
      marginTop: 12,

      borderWidth: 1,

      borderColor:
        '#242424',

      backgroundColor:
        '#111111',

      minHeight: 62,

      paddingHorizontal:
        16,

      paddingVertical:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    routeButtonTitle: {
      color:
        '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '800',

      letterSpacing:
        1.4,
    },

    routeButtonSubtitle: {
      color:
        '#666666',

      fontSize: 9,

      fontWeight:
        '600',

      letterSpacing:
        0.5,

      marginTop: 3,
    },

    routeButtonArrow: {
      color:
        '#FFFFFF',

      fontSize: 22,
    },

    /* =================================================
       CONTROL
    ================================================= */

    controlSection: {
      marginTop: 28,
    },

    startButton: {
      height: 58,

      backgroundColor:
        '#FFFFFF',

      marginTop: 12,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    stopButton: {
      backgroundColor:
        '#111111',

      borderWidth: 1,

      borderColor:
        '#FFFFFF',
    },

    startButtonText: {
      color:
        '#000000',

      fontSize: 14,

      fontWeight:
        '800',

      letterSpacing:
        1.5,
    },

    stopButtonText: {
      color:
        '#FFFFFF',
    },

    startArrow: {
      color:
        '#000000',

      fontSize: 23,

      marginLeft: 17,
    },

    /* =================================================
       SHARE
    ================================================= */

    shareButton: {
      height: 52,

      borderWidth: 1,

      borderColor:
        '#292929',

      marginTop: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    shareText: {
      color:
        '#888888',

      fontSize: 10,

      fontWeight:
        '700',

      letterSpacing:
        1.5,
    },

    shareArrow: {
      color:
        '#FFFFFF',

      fontSize: 19,

      marginLeft: 14,
    },

    /* =================================================
       MANAGEMENT
    ================================================= */

    managementSection: {
      marginTop: 30,
    },

    managementButton: {
      height: 52,

      borderTopWidth: 1,

      borderBottomWidth: 1,

      borderColor:
        '#242424',

      marginTop: 10,

      paddingHorizontal:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    managementText: {
      color:
        '#AAAAAA',

      fontSize: 10,

      fontWeight:
        '700',

      letterSpacing:
        1.3,
    },

    managementArrow: {
      color:
        '#FFFFFF',

      fontSize: 20,
    },

    /* =================================================
       BOTTOM
    ================================================= */

    bottom: {
      alignItems:
        'center',

      paddingTop: 35,

      paddingBottom: 10,
    },

    bottomLine: {
      width: 30,

      height: 1,

      backgroundColor:
        '#FFFFFF',

      marginBottom: 10,
    },

    bottomText: {
      color:
        '#555555',

      fontSize: 8,

      fontWeight:
        '700',

      letterSpacing: 2,
    },
  });