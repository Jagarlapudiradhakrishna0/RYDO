import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import RydoMap from '@/components/RydoMap';
import * as Location from 'expo-location';

import { io as SocketIO } from 'socket.io-client';

import { API_URL, SOCKET_URL } from '@/constants/network';
import { getCurrentUser } from '@/constants/auth';
import ProfileHeaderButton from '@/components/ProfileHeaderButton';
import CommunicationButton from '@/components/CommunicationButton';
import { communicationService } from '@/services/communicationService';
import { socketService } from '@/services/socketService';
import { SosButton } from '@/components/SosButton';
import { SosEmergencyOverlay } from '@/components/SosEmergencyOverlay';
import { SosEvent } from '@/services/sosService';

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

type LatLng = Coordinate;

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Rider = {
  _id?: string;
  name: string;
  joinedAt?: string;
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

type LiveMember = {
  memberId: string;
  userName: string;
  role: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
};

/* =====================================================
   COMPONENT
===================================================== */

export default function LiveRideMap() {

  /* ===================================================
     PARAMS
  =================================================== */

  const {
    rideCode,
    rideName,
    captainName,
    role,
    userName,
    riderName,
    startParam,
    destinationParam,
    stopsParam,
    initialRouteParam,
  } = useLocalSearchParams<{
    rideCode?: string;
    rideName?: string;
    captainName?: string;
    role?: string;
    userName?: string;
    riderName?: string;
    startParam?: string;
    destinationParam?: string;
    stopsParam?: string;
    initialRouteParam?: string;
  }>();


  /* ===================================================
     DERIVED
  =================================================== */

  /* userName can come as either userName or riderName */
  const myName =
    String(
      userName ||
      riderName ||
      ''
    ).trim();

  const myRole =
    String(role || 'captain')
      .toLowerCase()
      .trim();

  const isRider =
    myRole === 'rider';

  const displayRideName =
    rideName || 'RYDO RIDE';

  const displayCaptain =
    isRider
      ? (captainName || 'Captain')
      : (myName || 'Captain');

  const displayRideCode =
    rideCode || '------';

  /* memberId used to identify this user in socket */
  const myMemberId =
    `${myRole}-${myName
      .toLowerCase()
      .replace(/\s+/g, '-')}`;


  /* ===================================================
     MAP
  =================================================== */

  const mapRef =
    useRef<any>(null);

  const [mapReady, setMapReady] =
    useState(false);

  // SOS Emergency States
  const [activeSosEvent, setActiveSosEvent] = useState<SosEvent | null>(null);
  const [sosOverlayVisible, setSosOverlayVisible] = useState<boolean>(false);
  const [emergencyRoute, setEmergencyRoute] = useState<Coordinate[]>([]);


  /* ===================================================
     LOCATION
  =================================================== */

  const [location, setLocation] =
    useState<Location.LocationObjectCoords | null>(
      null
    );

  const [locationPermission, setLocationPermission] =
    useState(false);

  const [locationLoading, setLocationLoading] =
    useState(true);

  const locationSubscription =
    useRef<Location.LocationSubscription | null>(
      null
    );


  /* ===================================================
     NAVIGATION MODE
  =================================================== */

  const [navigationMode, setNavigationMode] =
    useState(false);


  /* ===================================================
     HEADING
  =================================================== */

  const [heading, setHeading] =
    useState(0);


  /* ===================================================
     INITIAL ROUTE PARSING FROM PARAMS
  =================================================== */

  const initialRouteData: RouteData = useMemo(() => {
    let start: RoutePoint | null = null;
    let destination: RoutePoint | null = null;
    let stops: RoutePoint[] = [];

    try {
      if (startParam) {
        const p = JSON.parse(startParam);
        if (p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))) {
          start = { name: p.name || 'Start', latitude: Number(p.latitude), longitude: Number(p.longitude) };
        }
      }
    } catch {}

    try {
      if (destinationParam) {
        const p = JSON.parse(destinationParam);
        if (p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))) {
          destination = { name: p.name || 'Destination', latitude: Number(p.latitude), longitude: Number(p.longitude) };
        }
      }
    } catch {}

    try {
      if (stopsParam) {
        const p = JSON.parse(stopsParam);
        if (Array.isArray(p)) {
          stops = p
            .filter((s: any) => s && Number.isFinite(Number(s.latitude)) && Number.isFinite(Number(s.longitude)))
            .map((s: any) => ({ name: s.name || 'Stop', latitude: Number(s.latitude), longitude: Number(s.longitude) }));
        }
      }
    } catch {}

    return { start, destination, stops };
  }, [startParam, destinationParam, stopsParam]);

  const initialParsedRoute: LatLng[] = useMemo(() => {
    try {
      if (initialRouteParam) {
        const parsed = JSON.parse(initialRouteParam);
        if (Array.isArray(parsed) && parsed.length > 1) {
          return parsed
            .map((c: any) => ({
              latitude: Number(c.latitude),
              longitude: Number(c.longitude),
            }))
            .filter((c: any) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
        }
      }
    } catch {}
    return [];
  }, [initialRouteParam]);

  /* ===================================================
     ROUTE
  =================================================== */

  const [routeData, setRouteData] =
    useState<RouteData>(initialRouteData);

  const [roadRoute, setRoadRoute] =
    useState<LatLng[]>(initialParsedRoute);

  const roadRouteRef = useRef(roadRoute);
  roadRouteRef.current = roadRoute;

  const routeDataRef = useRef(routeData);
  routeDataRef.current = routeData;

  const [routeLoading, setRouteLoading] =
    useState(true);

  const mapInitialRegion: Region = useMemo(() => {
    if (location) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    if (routeData.start) {
      return {
        latitude: routeData.start.latitude,
        longitude: routeData.start.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    return {
      latitude: 17.9689,
      longitude: 79.5941,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [location, routeData.start]);


  /* ===================================================
     DISTANCE / ETA
  =================================================== */

  const [distanceKm, setDistanceKm] =
    useState<number | null>(null);

  const [durationMinutes, setDurationMinutes] =
    useState<number | null>(null);


  /* ===================================================
     RIDERS (from backend)
  =================================================== */

  const [riders, setRiders] =
    useState<Rider[]>([]);


  /* ===================================================
     LIVE MEMBERS (from socket)

     Map of memberId → LiveMember
     Stores live GPS of captain and other riders
  =================================================== */

  const [liveMembers, setLiveMembers] =
    useState<Map<string, LiveMember>>(
      new Map()
    );

  const liveCaptainMember: LiveMember | null =
    (() => {
      for (const [, member] of liveMembers) {
        if (member.role === 'captain') {
          return member;
        }
      }

      return null;
    })();

  const liveOtherRiders: LiveMember[] =
    Array.from(liveMembers.values()).filter(
      (member) =>
        member.role === 'rider' &&
        member.memberId !== myMemberId
    );


  /* ===================================================
     CONTROL
  =================================================== */

  const mountedRef =
    useRef(true);

  const routeRequestRunning =
    useRef(false);

  const socketRef =
    useRef<ReturnType<typeof SocketIO> | null>(null);

  /* last location sent via socket — for deduplication */
  const lastSentLocation =
    useRef<{ lat: number; lng: number } | null>(null);


  /* ===================================================
     SOCKET.IO — CONNECT
  =================================================== */

  useEffect(() => {
    if (!rideCode) {
      return;
    }

    const code =
      String(rideCode)
        .trim()
        .toUpperCase();

    console.log(
      'RYDO: Connecting socket for live map...',
      SOCKET_URL
    );

    const socket = socketService.connect({
      rideCode: code,
      userId: myMemberId,
      userName: myName || 'User',
      role: isRider ? 'rider' : 'captain',
    });

    socketRef.current = socket;
    communicationService.setActiveRideCode(code);
    communicationService.setActiveUser(myMemberId, myName);

    /* -------------------------------------------------
       JOIN RIDE ROOM
    ------------------------------------------------- */

    socket.on('connect', () => {

      console.log(
        'RYDO: Socket connected:',
        socket.id
      );

      socket.emit('joinRide', {
        rideCode: code,

        memberId:
          myMemberId,

        userName:
          myName || 'User',

        role:
          myRole,
      });
    });


    /* -------------------------------------------------
       RIDE JOINED CONFIRMATION
    ------------------------------------------------- */

    socket.on('rideJoined', (data: any) => {
      console.log(
        'RYDO: Ride joined via socket:',
        data
      );
    });

    /* -------------------------------------------------
       INITIAL SNAPSHOT OF ALL ACTIVE LOCATIONS
    ------------------------------------------------- */

    socket.on('locationsSnapshot', (snapshot: any) => {
      if (!mountedRef.current || !snapshot) return;

      console.log('RYDO: Live map received locationsSnapshot:', snapshot);

      setLiveMembers((prev) => {
        const next = new Map(prev);

        if (snapshot.captainLocation && Number.isFinite(Number(snapshot.captainLocation.latitude))) {
          const capLat = Number(snapshot.captainLocation.latitude);
          const capLng = Number(snapshot.captainLocation.longitude);
          const capMemberId = String(snapshot.captainLocation.memberId || 'captain').trim();

          if (capMemberId !== myMemberId) {
            next.set(capMemberId, {
              memberId: capMemberId,
              userName: snapshot.captainLocation.userName || 'Captain',
              role: 'captain',
              latitude: capLat,
              longitude: capLng,
              updatedAt: snapshot.captainLocation.updatedAt || new Date().toISOString(),
            });
          }
        }

        if (Array.isArray(snapshot.riders)) {
          snapshot.riders.forEach((r: any) => {
            if (!r || !Number.isFinite(Number(r.latitude)) || !Number.isFinite(Number(r.longitude))) return;
            const rMemberId = String(r.memberId || r._id || '').trim();
            if (!rMemberId || rMemberId === myMemberId) return;

            next.set(rMemberId, {
              memberId: rMemberId,
              userName: r.userName || r.name || 'Rider',
              role: 'rider',
              latitude: Number(r.latitude),
              longitude: Number(r.longitude),
              updatedAt: r.updatedAt || new Date().toISOString(),
            });
          });
        }

        return next;
      });
    });


    /* -------------------------------------------------
       RECEIVE LIVE LOCATION UPDATES
    ------------------------------------------------- */

    socket.on(
      'locationUpdated',
      (data: any) => {

        if (!mountedRef.current) {
          return;
        }

        const receivedMemberId =
          String(data.memberId || '').trim();

        const receivedRole =
          String(data.role || '').toLowerCase();

        const lat =
          Number(data.latitude);

        const lng =
          Number(data.longitude);

        if (
          !receivedMemberId ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          return;
        }

        /* Skip own location update */
        if (
          receivedMemberId === myMemberId
        ) {
          return;
        }

        /* Skip same-role non-captain updates when we are captain */
        /* (Captains skip other captains) */
        if (
          !isRider &&
          receivedRole !== 'rider'
        ) {
          return;
        }

        const member: LiveMember = {
          memberId:
            receivedMemberId,

          userName:
            String(data.userName || ''),

          role:
            receivedRole,

          latitude: lat,

          longitude: lng,

          updatedAt:
            data.updatedAt ||
            new Date().toISOString(),
        };

        setLiveMembers(
          (prev) => {
            const next =
              new Map(prev);

            next.set(
              receivedMemberId,
              member
            );

            return next;
          }
        );
      }
    );


    /* -------------------------------------------------
       USER LEFT / DISCONNECTED
    ------------------------------------------------- */

    socket.on('userLeft', (data: any) => {
      if (!mountedRef.current) {
        return;
      }

      const leftMemberId =
        String(data.memberId || '').trim();

      if (leftMemberId) {
        setLiveMembers(
          (prev) => {
            const next = new Map(prev);
            next.delete(leftMemberId);
            return next;
          }
        );
      }
    });

    socket.on(
      'userDisconnected',
      (data: any) => {
        if (!mountedRef.current) {
          return;
        }

        const leftMemberId =
          String(data.memberId || '').trim();

        if (leftMemberId) {
          setLiveMembers(
            (prev) => {
              const next = new Map(prev);
              next.delete(leftMemberId);
              return next;
            }
          );
        }
      }
    );


    /* -------------------------------------------------
       ERROR
    ------------------------------------------------- */

    socket.on('socketError', (err: any) => {
      console.log(
        'RYDO: Socket error:',
        err
      );
    });

    socket.on(
      'connect_error',
      (err: any) => {
        console.log(
          'RYDO: Socket connect error:',
          err.message
        );
      }
    );

    const handleSosEvent = (payload: any) => {
      console.log('[RYDO SOS] Received on live-ride-map:', payload);
      if (!payload) return;
      const lat = Number(payload.location?.latitude ?? payload.latitude);
      const lng = Number(payload.location?.longitude ?? payload.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const eventId = payload.eventId || payload.sosId || `${payload.userId || payload.name}_${payload.triggeredAt || 'active'}`;

      const event: SosEvent = {
        eventId,
        sosId: payload.sosId || payload.eventId || eventId,
        rideCode: payload.rideCode || (rideCode as string) || '',
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
      console.log('RYDO: SOS resolved on live-ride-map:', data);
      setActiveSosEvent(null);
      setSosOverlayVisible(false);
      setEmergencyRoute([]);
    });

    const handleRouteUpdated = (data: any) => {
      console.log('[RYDO ROUTE] Live map received route update event:', data);
      const newRoute = data.route || data.ride?.route;
      if (newRoute) {
        const dLat = Number(newRoute.destination?.latitude);
        const dLng = Number(newRoute.destination?.longitude);
        const sLat = Number(newRoute.start?.latitude);
        const sLng = Number(newRoute.start?.longitude);
        setRouteData({
          start: newRoute.start && Number.isFinite(sLat) && Number.isFinite(sLng) ? { name: newRoute.start.name || 'Start', latitude: sLat, longitude: sLng } : null,
          destination: newRoute.destination && Number.isFinite(dLat) && Number.isFinite(dLng) ? { name: newRoute.destination.name || 'Destination', latitude: dLat, longitude: dLng } : null,
          stops: Array.isArray(newRoute.stops)
            ? newRoute.stops
                .filter((s: any) => s && Number.isFinite(Number(s.latitude)) && Number.isFinite(Number(s.longitude)))
                .map((s: any) => ({ name: s.name || 'Stop', latitude: Number(s.latitude), longitude: Number(s.longitude) }))
            : [],
        });
        if (Array.isArray(newRoute.coordinates) && newRoute.coordinates.length > 1) {
          const parsed = newRoute.coordinates
            .filter((c: any) => Number.isFinite(Number(c?.latitude)) && Number.isFinite(Number(c?.longitude)))
            .map((c: any) => ({ latitude: Number(c.latitude), longitude: Number(c.longitude) }));
          if (parsed.length > 1) {
            setRoadRoute(parsed);
            setRouteLoading(false);
          }
        }
      }
    };
    socket.on('routeUpdated', handleRouteUpdated);
    socket.on('route:updated', handleRouteUpdated);

    socket.on('disconnect', (reason: string) => {
      console.log(
        'RYDO: Socket disconnected:',
        reason
      );
    });


    /* -------------------------------------------------
       CLEANUP
    ------------------------------------------------- */

    return () => {
      socket.off('locationsSnapshot');
      socket.off('locationUpdated');
      socket.off('userLeft');
      socket.off('userDisconnected');
      socket.off('socketError');
      socket.off('connect_error');
      socket.off('sosAlert', handleSosEvent);
      socket.off('sosTriggered', handleSosEvent);
      socket.off('sosResolved');
    };

  }, [rideCode]);


  /* ===================================================
     SOCKET.IO — BROADCAST OWN LOCATION
  =================================================== */

  useEffect(() => {

    if (!location || !rideCode) {
      return;
    }

    const socket = socketRef.current;

    if (!socket || !socket.connected) {
      return;
    }

    const lat = location.latitude;
    const lng = location.longitude;

    /* Avoid sending duplicate coordinates */
    const last = lastSentLocation.current;

    if (
      last &&
      Math.abs(last.lat - lat) < 0.00001 &&
      Math.abs(last.lng - lng) < 0.00001
    ) {
      return;
    }

    lastSentLocation.current = {
      lat,
      lng,
    };

    const code =
      String(rideCode)
        .trim()
        .toUpperCase();

    socket.emit('updateLocation', {
      rideCode: code,

      memberId:
        myMemberId,

      userName:
        myName || 'User',

      role:
        myRole,

      latitude: lat,

      longitude: lng,

      updatedAt:
        new Date().toISOString(),
    });

  }, [
    location?.latitude,
    location?.longitude,
    rideCode,
  ]);


  /* ===================================================
     FETCH RIDE
  =================================================== */

  const fetchRide = useCallback(async () => {
    if (!rideCode) {
      return;
    }

    const code = String(rideCode)
      .trim()
      .toUpperCase();

    try {
      const response = await fetch(
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
          'RYDO: Unable to load ride'
        );

        return;
      }

      if (!mountedRef.current) {
        return;
      }

      const ride =
        data.ride;


      /* ---------------------------------------------
         RIDERS
      --------------------------------------------- */

      const backendRiders =
        Array.isArray(ride?.riders)
          ? ride.riders
          : [];

      setRiders(
        backendRiders.map(
          (rider: any) => ({
            _id: rider?._id,
            name:
              rider?.name ||
              'Rider',
            joinedAt:
              rider?.joinedAt,
          })
        )
      );


      /* ---------------------------------------------
         ROUTE
      --------------------------------------------- */

      const backendRoute =
        ride?.route || {};

      const startLat = Number(backendRoute.start?.latitude);
      const startLng = Number(backendRoute.start?.longitude);
      const start =
        backendRoute.start && Number.isFinite(startLat) && Number.isFinite(startLng)
          ? {
              name: backendRoute.start.name || 'Start',
              latitude: startLat,
              longitude: startLng,
            }
          : null;

      const destLat = Number(backendRoute.destination?.latitude);
      const destLng = Number(backendRoute.destination?.longitude);
      const destination =
        backendRoute.destination && Number.isFinite(destLat) && Number.isFinite(destLng)
          ? {
              name: backendRoute.destination.name || 'Destination',
              latitude: destLat,
              longitude: destLng,
            }
          : null;

      const stops = Array.isArray(backendRoute.stops)
        ? backendRoute.stops
            .filter((stop: any) => {
              const sLat = Number(stop?.latitude);
              const sLng = Number(stop?.longitude);
              return stop && Number.isFinite(sLat) && Number.isFinite(sLng);
            })
            .map((stop: any) => ({
              name: stop.name || 'Stop',
              latitude: Number(stop.latitude),
              longitude: Number(stop.longitude),
            }))
        : [];

      setRouteData((prev) => ({
        start: start || prev.start,
        destination: destination || prev.destination,
        stops: stops.length > 0 ? stops : prev.stops,
      }));

      if (Array.isArray(backendRoute.coordinates) && backendRoute.coordinates.length > 1) {
        const parsedCoords: LatLng[] = backendRoute.coordinates
          .filter((c: any) => Number.isFinite(Number(c?.latitude)) && Number.isFinite(Number(c?.longitude)))
          .map((c: any) => ({ latitude: Number(c.latitude), longitude: Number(c.longitude) }));
        if (parsedCoords.length > 1 && roadRouteRef.current.length === 0) {
          setRoadRoute(parsedCoords);
          setRouteLoading(false);
        }
      }

      if (ride?.captainLocation && Number.isFinite(Number(ride.captainLocation.latitude)) && Number.isFinite(Number(ride.captainLocation.longitude))) {
        setLiveMembers((prev) => {
          const next = new Map(prev);
          next.set('captain-main', {
            memberId: 'captain-main',
            userName: displayCaptain || 'Captain',
            role: 'captain',
            latitude: Number(ride.captainLocation.latitude),
            longitude: Number(ride.captainLocation.longitude),
            updatedAt: new Date().toISOString(),
          });
          return next;
        });
      }

      if (backendRoute.distanceMeters && Number(backendRoute.distanceMeters) > 0) {
        setDistanceKm(Number(backendRoute.distanceMeters) / 1000);
      }

      if (backendRoute.durationSeconds && Number(backendRoute.durationSeconds) > 0) {
        setDurationMinutes(Math.max(1, Math.round(Number(backendRoute.durationSeconds) / 60)));
      }

    } catch (error) {
      console.log(
        'RYDO: Live ride fetch error:',
        error
      );
    }
  }, [rideCode]);


  /* ===================================================
     CALCULATE DISTANCE (HAVERSINE)
  =================================================== */

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const earthRadius = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
  };

  /* ===================================================
     UPDATE LIVE REMAINING ROUTE & DISTANCE FROM CURRENT LIVE LOCATION
  =================================================== */

  const updateLiveRemainingDistance = useCallback(
    (currentCoords: { latitude: number; longitude: number; speed?: number | null }) => {
      const currentRouteData = routeDataRef.current;
      const currentRoadRoute = roadRouteRef.current;
      if (!currentCoords || !currentRouteData.destination) return;

      if (currentRoadRoute.length > 1) {
        let nearestIdx = 0;
        let minD = Infinity;
        for (let i = 0; i < currentRoadRoute.length; i++) {
          const d = calculateDistance(
            currentCoords.latitude,
            currentCoords.longitude,
            currentRoadRoute[i].latitude,
            currentRoadRoute[i].longitude
          );
          if (d < minD) {
            minD = d;
            nearestIdx = i;
          }
        }

        let remainingKm = calculateDistance(
          currentCoords.latitude,
          currentCoords.longitude,
          currentRoadRoute[nearestIdx].latitude,
          currentRoadRoute[nearestIdx].longitude
        );

        for (let i = nearestIdx; i < currentRoadRoute.length - 1; i++) {
          remainingKm += calculateDistance(
            currentRoadRoute[i].latitude,
            currentRoadRoute[i].longitude,
            currentRoadRoute[i + 1].latitude,
            currentRoadRoute[i + 1].longitude
          );
        }

        setDistanceKm(remainingKm);
        const currentSpeedKmh =
          currentCoords.speed && currentCoords.speed > 1.4
            ? currentCoords.speed * 3.6
            : 40;
        const etaMinutes = Math.max(1, Math.round((remainingKm / currentSpeedKmh) * 60));
        setDurationMinutes(etaMinutes);
        setRouteLoading(false);
      } else {
        let directKm =
          calculateDistance(
            currentCoords.latitude,
            currentCoords.longitude,
            currentRouteData.destination.latitude,
            currentRouteData.destination.longitude
          ) * 1.25;

        if (currentRouteData.stops && currentRouteData.stops.length > 0) {
          let lastLat = currentCoords.latitude;
          let lastLon = currentCoords.longitude;
          let totalStopKm = 0;
          for (const stop of currentRouteData.stops) {
            totalStopKm += calculateDistance(lastLat, lastLon, stop.latitude, stop.longitude) * 1.25;
            lastLat = stop.latitude;
            lastLon = stop.longitude;
          }
          totalStopKm += calculateDistance(lastLat, lastLon, currentRouteData.destination.latitude, currentRouteData.destination.longitude) * 1.25;
          directKm = totalStopKm;
        }

        setDistanceKm(directKm);
        const etaMinutes = Math.max(1, Math.round((directKm / 40) * 60));
        setDurationMinutes(etaMinutes);
      }
    },
    []
  );

  /* ===================================================
     LOCATION TRACKING
  =================================================== */

  useEffect(() => {
    mountedRef.current = true;

    const startTracking =
      async () => {
        try {
          const {
            status,
          } =
            await Location.requestForegroundPermissionsAsync();

          if (!mountedRef.current) {
            return;
          }

          if (
            status !== 'granted'
          ) {
            setLocationPermission(false);
            setLocationLoading(false);

            Alert.alert(
              'Location Required',
              'Please allow RYDO to access your location for live navigation.'
            );

            return;
          }

          setLocationPermission(true);

          const current =
            await Location.getCurrentPositionAsync(
              {
                accuracy:
                  Location.Accuracy.Highest,
              }
            );

          if (!mountedRef.current) {
            return;
          }

          setLocation(
            current.coords
          );

          updateLiveRemainingDistance(current.coords);

          if (
            typeof current.coords.heading ===
            'number' &&
            current.coords.heading >= 0
          ) {
            setHeading(
              current.coords.heading
            );
          }

          setLocationLoading(false);

          locationSubscription.current =
            await Location.watchPositionAsync(
              {
                accuracy:
                  Location.Accuracy.BestForNavigation,

                timeInterval: 2000,

                distanceInterval: 5,
              },

              (
                newLocation
              ) => {
                if (
                  !mountedRef.current
                ) {
                  return;
                }

                const coords =
                  newLocation.coords;

                setLocation(coords);
                updateLiveRemainingDistance(coords);

                if (
                  typeof coords.heading ===
                    'number' &&
                  coords.heading >= 0
                ) {
                  setHeading(
                    coords.heading
                  );
                }
              }
            );

        } catch (error) {
          console.log(
            'RYDO: Location error:',
            error
          );

          if (
            mountedRef.current
          ) {
            setLocationLoading(false);
          }
        }
      };

    startTracking();

    return () => {
      mountedRef.current = false;

      if (
        locationSubscription.current
      ) {
        locationSubscription.current.remove();

        locationSubscription.current =
          null;
      }
    };
  }, []);


  /* ===================================================
     FETCH RIDE — POLL EVERY 5s
  =================================================== */

  useEffect(() => {
    fetchRide();

    const interval =
      setInterval(
        () => {
          fetchRide();
        },
        5000
      );

    return () => {
      clearInterval(interval);
    };
  }, [fetchRide]);


  /* ===================================================
     FETCH ROAD ROUTE

     Route for rider:  Current → Start → Stops → Dest
     Route for captain: Current → Stops → Dest
  =================================================== */

  const fetchRoadRoute =
    useCallback(async () => {
      const targetDest =
        routeData.destination ||
        (liveCaptainMember ? { latitude: liveCaptainMember.latitude, longitude: liveCaptainMember.longitude, name: 'Captain' } : null) ||
        routeData.start;

      if (!targetDest) {
        return;
      }

      if (!location) {
        return;
      }

      if (routeRequestRunning.current) {
        return;
      }

      routeRequestRunning.current = true;

      try {
        if (roadRoute.length === 0) {
          setRouteLoading(true);
        }

        /* Calculate points from current live location forward to target */
        const points: RoutePoint[] = [
          {
            name: 'Current Location',
            latitude: location.latitude,
            longitude: location.longitude,
          },
        ];

        /* Include start point if rider is still approaching start location and start is not the target */
        if (routeData.start && targetDest !== routeData.start) {
          const distToStart = calculateDistance(location.latitude, location.longitude, routeData.start.latitude, routeData.start.longitude);
          const distToDest = calculateDistance(location.latitude, location.longitude, targetDest.latitude, targetDest.longitude);
          const startToDest = calculateDistance(routeData.start.latitude, routeData.start.longitude, targetDest.latitude, targetDest.longitude);
          if (distToStart > 0.05 && distToDest >= startToDest * 0.85) {
            points.push(routeData.start);
          }
        }

        /* Intermediate stops */
        (routeData.stops || []).forEach((stop) => {
          if (stop && Number.isFinite(Number(stop.latitude)) && Number.isFinite(Number(stop.longitude))) {
            points.push(stop);
          }
        });

        /* Target Destination or Captain */
        points.push(targetDest);

        const validPoints = points.filter(
          (point) => point && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))
        );

        if (validPoints.length < 2) {
          return;
        }

        const coordinates = validPoints
          .map((point) => `${Number(point.longitude).toFixed(5)},${Number(point.latitude).toFixed(5)}`)
          .join(';');

        const url = `${OSRM_URL}/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=false`;

        console.log(
          'RYDO: Requesting road route in live map:',
          url,
          isRider ? '(Rider)' : '(Captain)'
        );

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok || data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          throw new Error('OSRM routing failed');
        }

        const route = data.routes[0];
        const geometry = route.geometry;

        if (!geometry || !Array.isArray(geometry.coordinates)) {
          throw new Error('Invalid route geometry');
        }

        const routeCoordinates: LatLng[] = geometry.coordinates.map(
          (coordinate: [number, number]) => ({
            longitude: coordinate[0],
            latitude: coordinate[1],
          })
        );

        if (!mountedRef.current) {
          return;
        }

        setRoadRoute(routeCoordinates);
        updateLiveRemainingDistance(location);
      } catch (error) {
        console.log('RYDO: OSRM error in live map:', error);
        // Straight-line fallback so the route polyline is NEVER blank on screen
        const target =
          routeData.destination ||
          (liveCaptainMember ? { latitude: liveCaptainMember.latitude, longitude: liveCaptainMember.longitude, name: 'Captain' } : null) ||
          routeData.start;

        if (location && target && mountedRef.current) {
          const fallbackCoords: LatLng[] = [
            { latitude: location.latitude, longitude: location.longitude },
            ...(routeData.stops || []).map((s) => ({ latitude: Number(s.latitude), longitude: Number(s.longitude) })),
            { latitude: Number(target.latitude), longitude: Number(target.longitude) },
          ];
          setRoadRoute(fallbackCoords);
        }
      } finally {
        routeRequestRunning.current = false;
        if (mountedRef.current) {
          setRouteLoading(false);
        }
      }
    }, [
      routeData.start?.latitude,
      routeData.start?.longitude,
      routeData.destination?.latitude,
      routeData.destination?.longitude,
      JSON.stringify(routeData.stops),
      liveCaptainMember?.latitude,
      liveCaptainMember?.longitude,
      isRider,
      location?.latitude,
      location?.longitude,
      roadRoute.length,
      updateLiveRemainingDistance,
    ]);

  /* ===================================================
     LOAD ROUTE — when target is available and roadRoute not yet loaded
  =================================================== */

  useEffect(() => {
    const hasTarget = Boolean(routeData.destination || liveCaptainMember || routeData.start);
    if (hasTarget && roadRoute.length === 0 && location) {
      fetchRoadRoute();
    }
  }, [
    routeData.destination?.latitude,
    routeData.destination?.longitude,
    routeData.start?.latitude,
    routeData.start?.longitude,
    liveCaptainMember?.latitude,
    liveCaptainMember?.longitude,
    location?.latitude,
    location?.longitude,
    roadRoute.length,
    fetchRoadRoute,
  ]);


  /* ===================================================
     NAVIGATION CAMERA
  =================================================== */

  useEffect(() => {
    if (
      !navigationMode ||
      !mapReady ||
      !mapRef.current ||
      !location
    ) {
      return;
    }

    const camera = {
      center: {
        latitude:
          location.latitude,

        longitude:
          location.longitude,
      },

      zoom: 17,

      heading:
        heading >= 0
          ? heading
          : 0,

      pitch: 45,
    };

    try {
      mapRef.current.animateCamera(
        camera,
        {
          duration: 700,
        }
      );
    } catch (error) {
      console.log(
        'RYDO: Camera error:',
        error
      );
    }
  }, [
    location?.latitude,
    location?.longitude,
    heading,
    navigationMode,
    mapReady,
  ]);


  /* ===================================================
     INITIAL MAP FIT
  =================================================== */

  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      roadRoute.length < 2 ||
      navigationMode
    ) {
      return;
    }

    setTimeout(() => {
      if (
        mountedRef.current &&
        mapRef.current
      ) {
        mapRef.current.fitToCoordinates(
          roadRoute,
          {
            edgePadding: {
              top: 60,
              right: 40,
              bottom: 100,
              left: 40,
            },

            animated: true,
          }
        );
      }
    }, 300);
  }, [
    roadRoute,
    mapReady,
    navigationMode,
  ]);


  /* ===================================================
     RECENTER — center on own location
  =================================================== */

  const handleRecenter =
    () => {
      if (!location) {
        Alert.alert(
          'Location Required',
          'Waiting for your current location.'
        );

        return;
      }

      if (!mapRef.current) {
        return;
      }

      try {
        mapRef.current.animateCamera(
          {
            center: {
              latitude:
                location.latitude,

              longitude:
                location.longitude,
            },

            zoom: 16,
          },
          {
            duration: 500,
          }
        );
      } catch (error) {
        console.log(
          'RYDO: Recenter error:',
          error
        );
      }
    };


  /* ===================================================
     NAVIGATE BUTTON (follow mode)
  =================================================== */

  const toggleNavigation =
    () => {
      if (!location) {
        Alert.alert(
          'Location Required',
          'Waiting for your current location.'
        );

        return;
      }

      const newMode =
        !navigationMode;

      setNavigationMode(
        newMode
      );

      if (
        newMode &&
        mapRef.current
      ) {
        try {
          mapRef.current.animateCamera(
            {
              center: {
                latitude:
                  location.latitude,

                longitude:
                  location.longitude,
              },

              zoom: 17,

              heading:
                heading >= 0
                  ? heading
                  : 0,

              pitch: 45,
            },
            {
              duration: 600,
            }
          );
        } catch (error) {
          console.log(
            'RYDO: Navigation camera error:',
            error
          );
        }
      }
    };


  /* ===================================================
     STOP NAVIGATION
  =================================================== */

  const stopNavigation =
    () => {
      setNavigationMode(
        false
      );

      if (
        mapRef.current
      ) {
        try {
          mapRef.current.animateCamera(
            {
              pitch: 0,
            },
            {
              duration: 500,
            }
          );
        } catch (error) {
          console.log(
            'RYDO: Stop navigation error:',
            error
          );
        }
      }
    };


  /* ===================================================
     BACK
  =================================================== */

  const handleBack =
    () => {
      if (
        navigationMode
      ) {
        stopNavigation();
        return;
      }

      router.back();
    };

  const handleViewSosLocation = async (sos: SosEvent) => {
    setSosOverlayVisible(false);
    const sosLat = sos.location?.latitude ?? sos.latitude;
    const sosLng = sos.location?.longitude ?? sos.longitude;
    if (!sosLat || !sosLng) return;

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
    const startLat = location?.latitude;
    const startLng = location?.longitude;
    if (startLat && startLng) {
      try {
        const url = `${OSRM_URL}/${startLng.toFixed(5)},${startLat.toFixed(5)};${sosLng.toFixed(5)},${sosLat.toFixed(5)}?overview=full&geometries=geojson`;
        console.log('[RYDO SOS] Calculating emergency route on live-ride-map:', url);
        const res = await fetch(url);
        const routeJson = await res.json();
        if (routeJson.routes?.[0]?.geometry?.coordinates) {
          const coords: Coordinate[] = routeJson.routes[0].geometry.coordinates.map(
            (c: number[]) => ({ latitude: c[1], longitude: c[0] })
          );
          setEmergencyRoute(coords);
          console.log('[RYDO SOS] Emergency route calculated successfully on live-ride-map');
        }
      } catch (e) {
        console.log('RYDO SOS: Emergency route error:', e);
      }
    }
  };


  /* ===================================================
     SOS HANDLER
  =================================================== */

  const handleSOS =
    () => {
      Alert.alert(
        'SOS EMERGENCY',

        'Do you want to activate an emergency alert for your RYDO crew?',

        [
          {
            text: 'CANCEL',
            style: 'cancel',
          },

          {
            text: 'ACTIVATE SOS',
            style: 'destructive',

            onPress:
              async () => {

                try {

                  const code =
                    String(
                      rideCode || ''
                    )
                      .toUpperCase()
                      .trim();


                  if (!code) {
                    Alert.alert(
                      'SOS Error',
                      'Ride code is missing.'
                    );

                    return;
                  }


                  const lat =
                    location?.latitude ?? null;

                  const lng =
                    location?.longitude ?? null;


                  const response =
                    await fetch(
                      `${API_URL}/api/rides/${encodeURIComponent(
                        code
                      )}/sos`,
                      {
                        method: 'POST',

                        headers: {
                          'Content-Type':
                            'application/json',
                        },

                        body:
                          JSON.stringify({
                            riderName:
                              myName || 'Unknown',

                            userId:
                              getCurrentUser()?._id || null,

                            latitude:
                              lat,

                            longitude:
                              lng,
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
                      'SOS Error',

                      data.message ||
                        'Failed to send SOS.'
                    );

                    return;
                  }

                  Alert.alert(
                    'SOS SENT',
                    'Emergency alert sent to your RYDO crew. Help is on the way.'
                  );

                } catch (error) {

                  console.log(
                    'RYDO SOS ERROR:',
                    error
                  );

                  Alert.alert(
                    'SOS Failed',
                    'Could not send emergency alert. Check your connection and try again.'
                  );
                }
              },
          },
        ]
      );
    };




  /* ===================================================
     DISTANCE TEXT
  =================================================== */

  const distanceText =
    distanceKm !== null
      ? distanceKm >= 100
        ? distanceKm.toFixed(0)
        : distanceKm.toFixed(1)
      : '--';


  /* ===================================================
     ETA TEXT
  =================================================== */

  const etaText =
    durationMinutes !== null
      ? formatDuration(
          durationMinutes
        )
      : '--';


  /* ===================================================
     UNIQUE RIDERS & TOTAL MEMBERS
  =================================================== */

  const uniqueRiders = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof riders = [];
    const capName = (displayCaptain || '').trim().toLowerCase();
    for (const r of riders) {
      const key = (r.name || '').trim().toLowerCase();
      if (!key || seen.has(key) || key === capName) continue;
      seen.add(key);
      result.push(r);
    }
    return result;
  }, [riders, displayCaptain]);

  const totalMembers =
    uniqueRiders.length + 1;


  /* ===================================================
     RENDER
  =================================================== */

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
      />

      <View
        style={styles.container}
      >

        {/* =========================================
            HEADER
        ========================================= */}

        <View
          style={styles.header}
        >

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.headerBackBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.headerBackText}>←</Text>
            </TouchableOpacity>

            <View>
              <Text
                style={styles.brand}
              >
                RYDO
              </Text>

              <Text
                style={styles.modeText}
              >
                {isRider
                  ? 'RIDER NAVIGATION'
                  : 'CAPTAIN MODE'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={styles.liveBadge}
            >
              <View
                style={
                  styles.liveDot
                }
              />

              <Text
                style={
                  styles.liveText
                }
              >
                LIVE
              </Text>
            </View>

            <CommunicationButton
              rideCode={displayRideCode}
              role={isRider ? 'rider' : 'captain'}
              userName={myName}
              size={34}
            />

            <ProfileHeaderButton size={34} />
          </View>

        </View>

        {/* =========================================
            MAP
        ========================================= */}

        <View
          style={styles.mapContainer}
        >

          <RydoMap
            ref={mapRef}
            style={styles.map}
            initialRegion={mapInitialRegion}
            roadRoute={roadRoute}
            emergencyRoute={emergencyRoute}
            riderLocation={
              location
                ? {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    name: myName || 'You',
                  }
                : null
            }
            captainLocation={
              liveCaptainMember
                ? {
                    latitude: liveCaptainMember.latitude,
                    longitude: liveCaptainMember.longitude,
                    name: liveCaptainMember.userName,
                  }
                : null
            }
            liveRiders={liveOtherRiders.map((r) => ({
              id: r.memberId,
              name: r.userName,
              latitude: r.latitude,
              longitude: r.longitude,
              isLive: true,
            }))}
            startLocation={routeData.start ? { latitude: routeData.start.latitude, longitude: routeData.start.longitude, name: routeData.start.name } : null}
            stops={routeData.stops?.map((s) => ({ latitude: s.latitude, longitude: s.longitude, name: s.name })) || []}
            destinationLocation={routeData.destination ? { latitude: routeData.destination.latitude, longitude: routeData.destination.longitude, name: routeData.destination.name } : null}
            activeSosEvent={
              activeSosEvent
                ? {
                    latitude: Number(activeSosEvent.location?.latitude ?? activeSosEvent.latitude),
                    longitude: Number(activeSosEvent.location?.longitude ?? activeSosEvent.longitude),
                    name: activeSosEvent.name || activeSosEvent.riderName,
                    role: activeSosEvent.role,
                  }
                : null
            }
            onSosPress={() => setSosOverlayVisible(true)}
            onMapReady={() => setMapReady(true)}
          />

          {/* =========================================
              MAP TOP LEFT LABEL
          ========================================= */}

          <View
            style={
              styles.mapTopLeft
            }
          >
            <Text
              style={
                styles.mapLabel
              }
            >
              {isRider
                ? 'RYDO NAVIGATION'
                : 'RYDO ROUTE'}
            </Text>

            <Text
              style={
                styles.mapSubLabel
              }
            >
              {routeLoading
                ? 'CALCULATING'
                : roadRoute.length >
                  0
                ? 'LIVE ROUTE'
                : 'WAITING'}
            </Text>
          </View>

          {/* =========================================
              RECENTER BUTTON
          ========================================= */}

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.recenterButton}
            onPress={handleRecenter}
          >
            <Text
              style={
                styles.recenterText
              }
            >
              ◎
            </Text>
          </TouchableOpacity>

          {/* =========================================
              FOLLOW / NAVIGATE BUTTON
          ========================================= */}

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.navigateButton,
              navigationMode &&
                styles.navigateButtonActive,
            ]}
            onPress={
              toggleNavigation
            }
          >

            <View
              style={
                styles.navigateArrow
              }
            />

            <Text
              style={
                styles.navigateText
              }
            >
              {navigationMode
                ? 'FOLLOW'
                : 'NAVIGATE'}
            </Text>

          </TouchableOpacity>

          {/* =========================================
              DISTANCE / ETA CARD
          ========================================= */}

          <View
            style={
              styles.infoCard
            }
          >

            <View
              style={
                styles.infoItem
              }
            >
              <Text
                style={
                  styles.infoValue
                }
              >
                {distanceText}
              </Text>

              <Text
                style={
                  styles.infoUnit
                }
              >
                km
              </Text>

              <Text
                style={
                  styles.infoLabel
                }
              >
                REMAINING
              </Text>
            </View>

            <View
              style={
                styles.infoDivider
              }
            />

            <View
              style={
                styles.infoItem
              }
            >
              <Text
                style={
                  styles.infoValue
                }
              >
                {etaText}
              </Text>

              <Text
                style={
                  styles.infoLabel
                }
              >
                ETA
              </Text>
            </View>

          </View>

        </View>

        {/* =========================================
            RIDE INFO + SOS (scrollable bottom section)
        ========================================= */}

        <ScrollView
          style={styles.bottomScroll}
          contentContainerStyle={
            styles.bottomScrollContent
          }
          showsVerticalScrollIndicator={false}
        >

          {/* RIDE NAME / CODE */}
          <View style={styles.rideInfo}>

            <View>
              <Text
                style={
                  styles.rideSmallLabel
                }
              >
                RIDE
              </Text>

              <Text
                style={
                  styles.rideTitle
                }
              >
                {displayRideName}
              </Text>
            </View>

            <View
              style={
                styles.codeContainer
              }
            >
              <Text
                style={
                  styles.codeLabel
                }
              >
                CODE
              </Text>

              <Text
                style={
                  styles.codeText
                }
              >
                {displayRideCode}
              </Text>
            </View>

          </View>


          {/* ROUTE SUMMARY */}

          {(routeData.start ||
            routeData.destination) && (
            <View
              style={styles.routeSummary}
            >

              {routeData.start && (
                <View
                  style={
                    styles.routePoint
                  }
                >
                  <View
                    style={
                      styles.routeDotStart
                    }
                  />

                  <View
                    style={
                      styles.routePointText
                    }
                  >
                    <Text
                      style={
                        styles.routeSmall
                      }
                    >
                      START
                    </Text>

                    <Text
                      style={
                        styles.routePlace
                      }
                      numberOfLines={1}
                    >
                      {routeData.start.name}
                    </Text>
                  </View>
                </View>
              )}

              {routeData.destination && (
                <View
                  style={
                    styles.routePoint
                  }
                >
                  <View
                    style={
                      styles.routeDotDest
                    }
                  />

                  <View
                    style={
                      styles.routePointText
                    }
                  >
                    <Text
                      style={
                        styles.routeSmall
                      }
                    >
                      DESTINATION
                    </Text>

                    <Text
                      style={
                        styles.routePlace
                      }
                      numberOfLines={1}
                    >
                      {routeData.destination.name}
                    </Text>
                  </View>
                </View>
              )}

            </View>
          )}


          {/* CREW */}

          <View style={styles.crewSection}>

            <View
              style={
                styles.crewHeader
              }
            >

              <Text
                style={
                  styles.crewTitle
                }
              >
                CREW
              </Text>

              <Text
                style={
                  styles.crewCount
                }
              >
                {totalMembers}{' '}
                {totalMembers === 1
                  ? 'MEMBER'
                  : 'MEMBERS'}
              </Text>

            </View>

            {/* CAPTAIN */}

            <View
              style={styles.member}
            >

              <View
                style={
                  styles.memberNumber
                }
              >
                <Text
                  style={
                    styles.memberNumberText
                  }
                >
                  01
                </Text>
              </View>

              <View
                style={
                  styles.memberAvatar
                }
              >
                <Text
                  style={
                    styles.memberAvatarText
                  }
                >
                  {displayCaptain
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View
                style={
                  styles.memberDetails
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
                  {isRider
                    ? 'CAPTAIN'
                    : 'CAPTAIN • YOU'}
                </Text>
              </View>

              <View
                style={
                  styles.onlineContainer
                }
              >
                <View
                  style={[
                    styles.onlineDot,
                    liveCaptainMember &&
                      styles.onlineDotGreen,
                  ]}
                />

                <Text
                  style={
                    styles.onlineText
                  }
                >
                  {liveCaptainMember
                    ? 'LIVE'
                    : 'ONLINE'}
                </Text>
              </View>

            </View>


            {/* RIDERS */}

            {uniqueRiders.map(
              (
                rider,
                index
              ) => {
                const isMe =
                  isRider &&
                  rider.name.toLowerCase() ===
                  myName.toLowerCase();

                const riderMemberId =
                  `rider-${rider.name
                    .toLowerCase()
                    .replace(/\s+/g, '-')}`;

                const isLive =
                  liveMembers.has(riderMemberId);

                return (
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
                          styles.memberNumberText
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
                        styles.memberAvatar
                      }
                    >
                      <Text
                        style={
                          styles.memberAvatarText
                        }
                      >
                        {rider.name
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.memberDetails
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
                        {isMe
                          ? 'YOU • RIDER'
                          : 'RIDER'}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.onlineContainer
                      }
                    >
                      <View
                        style={[
                          styles.onlineDot,
                          (isMe || isLive) &&
                            styles.onlineDotBlue,
                        ]}
                      />

                      <Text
                        style={
                          styles.onlineText
                        }
                      >
                        {isMe
                          ? 'YOU'
                          : isLive
                          ? 'LIVE'
                          : 'ONLINE'}
                      </Text>
                    </View>

                  </View>
                );
              }
            )}

            {uniqueRiders.length === 0 && (
              <View
                style={
                  styles.noRiders
                }
              >
                <Text
                  style={
                    styles.noRidersText
                  }
                >
                  NO RIDERS JOINED
                </Text>
              </View>
            )}

          </View>


          {/* ===============================================
              SOS EMERGENCY BUTTON (for Captain & Riders)
          =============================================== */}
          <SosButton
            rideCode={displayRideCode}
            role={isRider ? 'rider' : 'captain'}
            userName={myName || (isRider ? 'Rider' : displayCaptain)}
            userId={myMemberId}
            socket={socketRef.current}
            onSosSent={(sos) => {
              setActiveSosEvent(sos);
            }}
            style={{ marginHorizontal: 22, marginTop: 20 }}
          />


          {/* GPS STATUS */}

          <View
            style={styles.gpsStatus}
          >
            <View
              style={[
                styles.gpsDot,
                location &&
                  styles.gpsDotLive,
              ]}
            />

            <Text
              style={styles.gpsText}
            >
              {locationLoading
                ? 'GETTING GPS...'
                : !locationPermission
                ? 'GPS PERMISSION REQUIRED'
                : location
                ? 'YOUR GPS IS LIVE'
                : 'ACQUIRING GPS'}
            </Text>
          </View>

          {/* =========================================
              BACK BUTTON
          ========================================= */}

          <TouchableOpacity
            activeOpacity={0.8}
            style={
              styles.backButton
            }
            onPress={
              handleBack
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              ← BACK
            </Text>
          </TouchableOpacity>

        </ScrollView>

        <SosEmergencyOverlay
          visible={sosOverlayVisible}
          sosEvent={activeSosEvent}
          currentLocation={location ? { latitude: location.latitude, longitude: location.longitude } : null}
          onViewLocation={handleViewSosLocation}
          onDismiss={() => setSosOverlayVisible(false)}
        />

      </View>
    </SafeAreaView>
  );
}


/* =====================================================
   FORMAT DURATION
===================================================== */

function formatDuration(
  totalMinutes: number
) {
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
}


/* =====================================================
   STYLES
===================================================== */

const styles =
  StyleSheet.create({

    /* ===============================================
       MAIN
    =============================================== */

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


    /* ===============================================
       HEADER
    =============================================== */

    header: {
      height: 60,
      paddingHorizontal: 22,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      borderBottomWidth: 1,
      borderBottomColor:
        '#181818',
    },

    headerBackBtn: {
      paddingRight: 12,
      paddingVertical: 4,
      justifyContent: 'center',
    },

    headerBackText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
    },

    brand: {
      color:
        '#FFFFFF',
      fontSize: 16,
      fontWeight:
        '900',
      letterSpacing: 5,
    },

    modeText: {
      color:
        '#555555',
      fontSize: 7,
      fontWeight:
        '700',
      letterSpacing: 2,
      marginTop: 3,
    },

    liveBadge: {
      height: 28,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor:
        '#292929',
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        '#1677FF',
      marginRight: 7,
    },

    liveText: {
      color:
        '#AAAAAA',
      fontSize: 7,
      fontWeight:
        '800',
      letterSpacing: 1.5,
    },


    /* ===============================================
       MAP
    =============================================== */

    mapContainer: {
      height: 350,
      marginHorizontal: 0,
      position:
        'relative',
      overflow:
        'hidden',
      backgroundColor:
        '#080808',
    },

    map: {
      width:
        '100%',
      height:
        '100%',
    },

    loadingMap: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#080808',
    },

    loadingTitle: {
      color:
        '#FFFFFF',
      fontSize: 11,
      fontWeight:
        '800',
      letterSpacing: 2,
    },

    loadingText: {
      color:
        '#555555',
      fontSize: 10,
      marginTop: 7,
    },


    /* ===============================================
       MAP LABEL
    =============================================== */

    mapTopLeft: {
      position:
        'absolute',
      top: 12,
      left: 12,
      backgroundColor:
        'rgba(0,0,0,0.76)',
      paddingHorizontal: 9,
      paddingVertical: 7,
    },

    mapLabel: {
      color:
        '#FFFFFF',
      fontSize: 7,
      fontWeight:
        '800',
      letterSpacing: 1.5,
    },

    mapSubLabel: {
      color:
        '#1677FF',
      fontSize: 6,
      fontWeight:
        '700',
      letterSpacing: 1,
      marginTop: 3,
    },


    /* ===============================================
       RECENTER BUTTON
    =============================================== */

    recenterButton: {
      position:
        'absolute',
      top: 12,
      right: 90,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        'rgba(0,0,0,0.80)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.25)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    recenterText: {
      color:
        '#FFFFFF',
      fontSize: 20,
      lineHeight: 24,
    },


    /* ===============================================
       NAVIGATION BUTTON
    =============================================== */

    navigateButton: {
      position:
        'absolute',
      top: 12,
      right: 14,
      width: 66,
      height: 66,
      borderRadius: 33,
      backgroundColor:
        '#080808',
      borderWidth: 2,
      borderColor:
        '#1677FF',
      alignItems:
        'center',
      justifyContent:
        'center',
      elevation: 8,
    },

    navigateButtonActive: {
      backgroundColor:
        '#1677FF',
      borderColor:
        '#FFFFFF',
    },

    navigateArrow: {
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderBottomWidth: 24,
      borderLeftColor:
        'transparent',
      borderRightColor:
        'transparent',
      borderBottomColor:
        '#1677FF',
      marginBottom: 1,
    },

    navigateText: {
      position:
        'absolute',
      bottom: 8,
      color:
        '#FFFFFF',
      fontSize: 6,
      fontWeight:
        '900',
      letterSpacing: 0.8,
    },


    /* ===============================================
       MOVING LOCATION ARROW (own marker)
    =============================================== */

    currentLocationOuter: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        'rgba(22,119,255,0.20)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    currentLocationInner: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor:
        '#050505',
      borderWidth: 2,
      borderColor:
        '#1677FF',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    navigationArrow: {
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderBottomWidth: 14,
      borderLeftColor:
        'transparent',
      borderRightColor:
        'transparent',
      borderBottomColor:
        '#1677FF',
    },


    /* ===============================================
       CAPTAIN LIVE MARKER (green)
    =============================================== */

    captainLiveMarker: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        'rgba(0,200,80,0.18)',
      borderWidth: 3,
      borderColor:
        '#00C850',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    captainLiveText: {
      color:
        '#00C850',
      fontSize: 14,
      fontWeight:
        '900',
    },


    /* ===============================================
       OTHER RIDER LIVE MARKER (amber/yellow)
    =============================================== */

    riderLiveMarker: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor:
        'rgba(255,180,0,0.18)',
      borderWidth: 2,
      borderColor:
        '#FFB400',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    riderLiveText: {
      color:
        '#FFB400',
      fontSize: 12,
      fontWeight:
        '900',
    },


    /* ===============================================
       START MARKER
    =============================================== */

    startMarker: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    startMarkerText: {
      color:
        '#000000',
      fontSize: 11,
      fontWeight:
        '900',
    },


    /* ===============================================
       STOP MARKER
    =============================================== */

    stopMarker: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor:
        '#1677FF',
      borderWidth: 2,
      borderColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    stopMarkerText: {
      color:
        '#FFFFFF',
      fontSize: 9,
      fontWeight:
        '900',
    },


    /* ===============================================
       DESTINATION MARKER
    =============================================== */

    destinationMarker: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 3,
      borderColor:
        '#1677FF',
      backgroundColor:
        '#000000',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    destinationInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        '#1677FF',
    },


    /* ===============================================
       DISTANCE / ETA
    =============================================== */

    infoCard: {
      position:
        'absolute',
      left: 14,
      right: 14,
      bottom: 14,
      height: 72,
      backgroundColor:
        'rgba(0,0,0,0.88)',
      flexDirection:
        'row',
      alignItems:
        'center',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.12)',
    },

    infoItem: {
      flex: 1,
      paddingHorizontal:
        16,
    },

    infoValue: {
      color:
        '#FFFFFF',
      fontSize: 19,
      fontWeight:
        '800',
      letterSpacing:
        -0.5,
    },

    infoUnit: {
      color:
        '#FFFFFF',
      fontSize: 11,
      fontWeight:
        '700',
      marginTop: -2,
    },

    infoLabel: {
      color:
        '#666666',
      fontSize: 6,
      fontWeight:
        '800',
      letterSpacing: 1.5,
      marginTop: 3,
    },

    infoDivider: {
      width: 1,
      height: 38,
      backgroundColor:
        '#333333',
    },


    /* ===============================================
       BOTTOM SCROLL
    =============================================== */

    bottomScroll: {
      flex: 1,
    },

    bottomScrollContent: {
      paddingBottom: 80,
    },


    /* ===============================================
       RIDE INFO
    =============================================== */

    rideInfo: {
      marginHorizontal:
        22,
      marginTop: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1C1C1C',
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
    },

    rideSmallLabel: {
      color:
        '#555555',
      fontSize: 7,
      fontWeight:
        '700',
      letterSpacing: 1.5,
    },

    rideTitle: {
      color:
        '#FFFFFF',
      fontSize: 18,
      fontWeight:
        '800',
      marginTop: 4,
    },

    codeContainer: {
      alignItems:
        'flex-end',
    },

    codeLabel: {
      color:
        '#555555',
      fontSize: 7,
      fontWeight:
        '700',
      letterSpacing: 1.5,
    },

    codeText: {
      color:
        '#FFFFFF',
      fontSize: 10,
      fontWeight:
        '800',
      letterSpacing: 2,
      marginTop: 4,
    },


    /* ===============================================
       ROUTE SUMMARY
    =============================================== */

    routeSummary: {
      marginHorizontal: 22,
      marginTop: 14,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1C1C1C',
    },

    routePoint: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
    },

    routeDotStart: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        '#FFFFFF',
      marginRight: 12,
    },

    routeDotDest: {
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 2,
      borderColor:
        '#1677FF',
      backgroundColor:
        '#000000',
      marginRight: 12,
    },

    routePointText: {
      flex: 1,
    },

    routeSmall: {
      color: '#555555',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 1.3,
    },

    routePlace: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
      marginTop: 3,
    },


    /* ===============================================
       CREW
    =============================================== */

    crewSection: {
      marginHorizontal:
        22,
      marginTop: 14,
    },

    crewHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 8,
    },

    crewTitle: {
      color:
        '#FFFFFF',
      fontSize: 13,
      fontWeight:
        '800',
      letterSpacing: 1.5,
    },

    crewCount: {
      color:
        '#555555',
      fontSize: 7,
      fontWeight:
        '700',
      letterSpacing: 1.2,
    },

    member: {
      minHeight: 62,
      borderTopWidth: 1,
      borderTopColor:
        '#1C1C1C',
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    memberNumber: {
      width: 30,
    },

    memberNumberText: {
      color:
        '#555555',
      fontSize: 8,
      fontWeight:
        '700',
    },

    memberAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor:
        '#191919',
      borderWidth: 1,
      borderColor:
        '#2A2A2A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    memberAvatarText: {
      color:
        '#FFFFFF',
      fontSize: 11,
      fontWeight:
        '800',
    },

    memberDetails: {
      flex: 1,
      marginLeft: 10,
    },

    memberName: {
      color:
        '#FFFFFF',
      fontSize: 12,
      fontWeight:
        '700',
    },

    memberRole: {
      color:
        '#555555',
      fontSize: 7,
      fontWeight:
        '700',
      letterSpacing: 1,
      marginTop: 2,
    },

    onlineContainer: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        '#555555',
      marginRight: 6,
    },

    onlineDotGreen: {
      backgroundColor:
        '#00C850',
    },

    onlineDotBlue: {
      backgroundColor:
        '#1677FF',
    },

    onlineText: {
      color:
        '#666666',
      fontSize: 6,
      fontWeight:
        '800',
      letterSpacing: 1,
    },

    noRiders: {
      paddingVertical: 18,
      borderTopWidth: 1,
      borderTopColor:
        '#1C1C1C',
    },

    noRidersText: {
      color:
        '#555555',
      fontSize: 9,
      fontWeight:
        '700',
      letterSpacing: 1.5,
    },


    /* ===============================================
       SOS BUTTON
    =============================================== */

    sosButton: {
      marginHorizontal: 22,
      marginTop: 20,
      height: 64,
      backgroundColor:
        'rgba(220,30,30,0.12)',
      borderWidth: 2,
      borderColor:
        'rgba(220,30,30,0.70)',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
    },

    sosIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        '#DC1E1E',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },

    sosIconText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 20,
    },

    sosButtonText: {
      color: '#FF4444',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    sosButtonSub: {
      color: '#884444',
      fontSize: 7,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: 2,
    },


    /* ===============================================
       GPS STATUS
    =============================================== */

    gpsStatus: {
      marginHorizontal: 22,
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },

    gpsDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#555555',
      marginRight: 8,
    },

    gpsDotLive: {
      backgroundColor: '#1677FF',
    },

    gpsText: {
      color: '#666666',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 1,
    },


    /* ===============================================
       BACK BUTTON
    =============================================== */

    backButton: {
      marginTop: 20,
      marginBottom: 36,
      marginHorizontal: 22,
      alignSelf: 'flex-start',
      backgroundColor:
        'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor:
        '#292929',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 4,
    },

    backButtonText: {
      color:
        '#AAAAAA',
      fontSize: 9,
      fontWeight:
        '800',
      letterSpacing: 1.2,
    },

    /* ===============================================
       SOS MAP MARKER
    =============================================== */

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

  });