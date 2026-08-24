import React, {
  useCallback,
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
  Alert,
  ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import MapView, {
  Marker,
  Polyline,
  LatLng,
  PROVIDER_GOOGLE,
} from 'react-native-maps';

import * as Location from 'expo-location';

import { io as SocketIO } from 'socket.io-client';

import { API_URL, SOCKET_URL } from '@/constants/network';
import { getCurrentUser } from '@/constants/auth';
import ProfileHeaderButton from '@/components/ProfileHeaderButton';

/* =====================================================
   OSRM
===================================================== */

const OSRM_URL =
  'https://router.project-osrm.org/route/v1/driving';

/* =====================================================
   TYPES
===================================================== */

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
  } = useLocalSearchParams<{
    rideCode?: string;
    rideName?: string;
    captainName?: string;
    role?: string;
    userName?: string;
    riderName?: string;
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
    useRef<MapView | null>(null);

  const [mapReady, setMapReady] =
    useState(false);


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
     ROUTE
  =================================================== */

  const [routeData, setRouteData] =
    useState<RouteData>({
      start: null,
      destination: null,
      stops: [],
    });

  const [roadRoute, setRoadRoute] =
    useState<LatLng[]>([]);

  const [routeLoading, setRouteLoading] =
    useState(true);


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

    const socket =
      SocketIO(SOCKET_URL, {
        transports: [
          'websocket',
          'polling',
        ],

        reconnectionAttempts: 5,

        timeout: 15000,
      });

    socketRef.current = socket;


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
      console.log(
        'RYDO: Cleaning up socket...'
      );

      socket.emit('leaveRide');
      socket.disconnect();
      socketRef.current = null;
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

      const start =
        backendRoute.start &&
        typeof backendRoute.start.latitude ===
          'number' &&
        typeof backendRoute.start.longitude ===
          'number'
          ? {
              name:
                backendRoute.start.name ||
                'Start',

              latitude:
                backendRoute.start.latitude,

              longitude:
                backendRoute.start.longitude,
            }
          : null;

      const destination =
        backendRoute.destination &&
        typeof backendRoute.destination.latitude ===
          'number' &&
        typeof backendRoute.destination.longitude ===
          'number'
          ? {
              name:
                backendRoute.destination.name ||
                'Destination',

              latitude:
                backendRoute.destination.latitude,

              longitude:
                backendRoute.destination.longitude,
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
                  typeof stop.latitude ===
                    'number' &&
                  typeof stop.longitude ===
                    'number'
              )
              .map(
                (stop: any) => ({
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
        'RYDO: Live ride fetch error:',
        error
      );
    }
  }, [rideCode]);


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
      if (
        !routeData.destination
      ) {
        setRoadRoute([]);
        return;
      }

      if (
        !location
      ) {
        return;
      }

      if (
        routeRequestRunning.current
      ) {
        return;
      }

      routeRequestRunning.current =
        true;

      try {
        setRouteLoading(true);

        /*
          Rider route:
            Rider Current Location
              → Start Point (if exists)
              → Any Stops
              → Destination

          Captain route:
            Captain Current Location
              → Any Stops
              → Destination
        */

        const points: RoutePoint[] = [
          {
            name: 'Current Location',

            latitude:
              location.latitude,

            longitude:
              location.longitude,
          },
        ];

        /* Add Start Point for riders */
        if (
          isRider &&
          routeData.start
        ) {
          points.push(routeData.start);
        }

        /* Intermediate stops */
        points.push(...routeData.stops);

        /* Destination */
        points.push(routeData.destination!);

        const coordinates =
          points
            .map(
              (point) =>
                `${point.longitude},${point.latitude}`
            )
            .join(';');

        const url =
          `${OSRM_URL}/${coordinates}` +
          `?overview=full&geometries=geojson`;

        console.log(
          'RYDO: Requesting road route',
          isRider ? '(Rider: includes Start Point)' : '(Captain)'
        );

        const response =
          await fetch(url);

        const data =
          await response.json();

        if (
          !response.ok ||
          data.code !== 'Ok' ||
          !data.routes ||
          data.routes.length === 0
        ) {
          throw new Error(
            'Unable to calculate route'
          );
        }

        const route =
          data.routes[0];


        /* ---------------------------------------------
           DISTANCE
        --------------------------------------------- */

        const distanceMeters =
          Number(
            route.distance || 0
          );

        const distance =
          distanceMeters / 1000;


        /* ---------------------------------------------
           DURATION
        --------------------------------------------- */

        const durationSeconds =
          Number(
            route.duration || 0
          );

        const minutes =
          Math.max(
            1,
            Math.round(
              durationSeconds / 60
            )
          );


        /* ---------------------------------------------
           GEOMETRY
        --------------------------------------------- */

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

        const routeCoordinates =
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

        setRoadRoute(
          routeCoordinates
        );

        setDistanceKm(
          distance
        );

        setDurationMinutes(
          minutes
        );

        console.log(
          'RYDO: Live route:',
          distance.toFixed(1),
          'km',
          minutes,
          'min'
        );

      } catch (error) {
        console.log(
          'RYDO: OSRM error:',
          error
        );
      } finally {
        routeRequestRunning.current =
          false;

        if (
          mountedRef.current
        ) {
          setRouteLoading(false);
        }
      }
    }, [
      location?.latitude,
      location?.longitude,
      routeData.start?.latitude,
      routeData.start?.longitude,
      routeData.destination?.latitude,
      routeData.destination?.longitude,
      JSON.stringify(
        routeData.stops
      ),
      isRider,
    ]);


  /* ===================================================
     LOAD ROUTE — when destination becomes available
  =================================================== */

  useEffect(() => {
    if (
      location &&
      routeData.destination
    ) {
      fetchRoadRoute();
    }
  }, [
    routeData.destination?.latitude,
    routeData.destination?.longitude,
    routeData.start?.latitude,
    routeData.start?.longitude,
  ]);


  /* ===================================================
     UPDATE ROUTE WHILE MOVING
  =================================================== */

  useEffect(() => {
    if (
      !navigationMode
    ) {
      return;
    }

    if (
      !location ||
      !routeData.destination
    ) {
      return;
    }

    const interval =
      setInterval(
        () => {
          fetchRoadRoute();
        },
        10000
      );

    return () => {
      clearInterval(interval);
    };
  }, [
    navigationMode,
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
     COMPUTED: Live Captain & Other Riders
  =================================================== */

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
     TOTAL MEMBERS
  =================================================== */

  const totalMembers =
    riders.length + 1;


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

            <ProfileHeaderButton size={34} />
          </View>

        </View>

        {/* =========================================
            MAP
        ========================================= */}

        <View
          style={styles.mapContainer}
        >

          {location ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              onMapReady={() =>
                setMapReady(true)
              }

              initialRegion={{
                latitude:
                  location.latitude,

                longitude:
                  location.longitude,

                latitudeDelta:
                  0.08,

                longitudeDelta:
                  0.08,
              }}

              showsUserLocation={false}

              showsMyLocationButton={
                false
              }

              showsCompass={
                !navigationMode
              }

              rotateEnabled={true}

              pitchEnabled={true}

              zoomEnabled={true}

              scrollEnabled={
                !navigationMode
              }

              toolbarEnabled={false}

              mapPadding={{
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            >

              {/* =====================================
                  BLUE ROAD ROUTE
              ===================================== */}

              {roadRoute.length >
                1 && (
                <Polyline
                  coordinates={
                    roadRoute
                  }

                  strokeWidth={6}

                  strokeColor="#1677FF"

                  lineCap="round"

                  lineJoin="round"

                  zIndex={5}
                />
              )}

              {/* =====================================
                  OWN LOCATION (Blue — Rider or Captain)
              ===================================== */}

              <Marker
                coordinate={{
                  latitude:
                    location.latitude,

                  longitude:
                    location.longitude,
                }}

                title={
                  isRider
                    ? `You (${myName || 'Rider'})`
                    : `Captain: ${myName || 'Captain'}`
                }

                description="Your live location"

                anchor={{
                  x: 0.5,
                  y: 0.5,
                }}

                flat={true}

                rotation={
                  navigationMode
                    ? heading
                    : 0
                }

                zIndex={20}
              >
                <View
                  style={
                    styles.currentLocationOuter
                  }
                >
                  <View
                    style={
                      styles.currentLocationInner
                    }
                  >
                    <View
                      style={
                        styles.navigationArrow
                      }
                    />
                  </View>
                </View>
              </Marker>

              {/* =====================================
                  CAPTAIN LIVE MARKER (green)
                  Shown on rider's map
              ===================================== */}

              {isRider &&
                liveCaptainMember && (
                  <Marker
                    coordinate={{
                      latitude:
                        liveCaptainMember.latitude,

                      longitude:
                        liveCaptainMember.longitude,
                    }}

                    title={`Captain: ${liveCaptainMember.userName}`}

                    description="Captain live location"

                    anchor={{
                      x: 0.5,
                      y: 0.5,
                    }}

                    zIndex={25}
                  >
                    <View
                      style={
                        styles.captainLiveMarker
                      }
                    >
                      <Text
                        style={
                          styles.captainLiveText
                        }
                      >
                        C
                      </Text>
                    </View>
                  </Marker>
                )}

              {/* =====================================
                  OTHER RIDERS LIVE MARKERS (yellow)
                  Shown on both captain map and rider map
              ===================================== */}

              {liveOtherRiders.map(
                (member) => (
                  <Marker
                    key={member.memberId}

                    coordinate={{
                      latitude:
                        member.latitude,

                      longitude:
                        member.longitude,
                    }}

                    title={member.userName}

                    description="Rider live location"

                    anchor={{
                      x: 0.5,
                      y: 0.5,
                    }}

                    zIndex={15}
                  >
                    <View
                      style={
                        styles.riderLiveMarker
                      }
                    >
                      <Text
                        style={
                          styles.riderLiveText
                        }
                      >
                        R
                      </Text>
                    </View>
                  </Marker>
                )
              )}

              {/* =====================================
                  START MARKER (white S)
              ===================================== */}

              {routeData.start && (
                <Marker
                  coordinate={{
                    latitude:
                      routeData
                        .start
                        .latitude,

                    longitude:
                      routeData
                        .start
                        .longitude,
                  }}

                  title="START"

                  description={
                    routeData.start.name
                  }

                  zIndex={10}
                >
                  <View
                    style={
                      styles.startMarker
                    }
                  >
                    <Text
                      style={
                        styles.startMarkerText
                      }
                    >
                      S
                    </Text>
                  </View>
                </Marker>
              )}

              {/* =====================================
                  STOPS
              ===================================== */}

              {routeData.stops.map(
                (stop, index) => (
                  <Marker
                    key={`stop-${index}`}

                    coordinate={{
                      latitude:
                        stop.latitude,

                      longitude:
                        stop.longitude,
                    }}

                    title={`STOP ${index + 1}`}

                    description={
                      stop.name
                    }

                    zIndex={10}
                  >
                    <View
                      style={
                        styles.stopMarker
                      }
                    >
                      <Text
                        style={
                          styles.stopMarkerText
                        }
                      >
                        {index + 1}
                      </Text>
                    </View>
                  </Marker>
                )
              )}

              {/* =====================================
                  DESTINATION
              ===================================== */}

              {routeData.destination && (
                <Marker
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

                  title="DESTINATION"

                  description={
                    routeData
                      .destination
                      .name
                  }

                  zIndex={12}
                >
                  <View
                    style={
                      styles.destinationMarker
                    }
                  >
                    <View
                      style={
                        styles.destinationInner
                      }
                    />
                  </View>
                </Marker>
              )}

            </MapView>
          ) : (
            <View
              style={
                styles.loadingMap
              }
            >
              <Text
                style={
                  styles.loadingTitle
                }
              >
                LOCATING
              </Text>

              <Text
                style={
                  styles.loadingText
                }
              >
                Getting your current
                location...
              </Text>
            </View>
          )}

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

            {riders.map(
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

            {riders.length === 0 && (
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


          {/* SOS BUTTON (prominent, for riders) */}

          {isRider && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.sosButton}
              onPress={handleSOS}
            >
              <View
                style={styles.sosIcon}
              >
                <Text
                  style={
                    styles.sosIconText
                  }
                >
                  !
                </Text>
              </View>

              <View>
                <Text
                  style={
                    styles.sosButtonText
                  }
                >
                  SOS EMERGENCY
                </Text>

                <Text
                  style={
                    styles.sosButtonSub
                  }
                >
                  TAP TO SEND ALERT TO CREW
                </Text>
              </View>
            </TouchableOpacity>
          )}


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

        </ScrollView>


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
      position:
        'absolute',
      bottom: 18,
      left: 22,
      backgroundColor:
        'rgba(0,0,0,0.82)',
      borderWidth: 1,
      borderColor:
        '#292929',
      paddingHorizontal: 14,
      paddingVertical: 9,
    },

    backButtonText: {
      color:
        '#AAAAAA',
      fontSize: 8,
      fontWeight:
        '800',
      letterSpacing: 1.2,
    },

  });