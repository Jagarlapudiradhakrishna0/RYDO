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
  Alert,
  StatusBar,
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

import {
  io,
  Socket,
} from 'socket.io-client';

import {
  API_URL,
  SOCKET_URL,
} from '@/constants/network';


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


type CaptainLocation = {
  latitude: number;
  longitude: number;
  updatedAt?: string;
};


type LiveMemberLocation = {
  memberId: string;
  name: string;
  role: 'captain' | 'rider';
  latitude: number;
  longitude: number;
  updatedAt?: string;
};


type SocketLocationPayload = {
  socketId?: string;
  memberId: string;
  rideCode: string;
  userName: string;
  role: 'captain' | 'rider';
  latitude: number;
  longitude: number;
  updatedAt?: string;
};


/* =====================================================
   LIVE RIDE MAP
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
  } =
    useLocalSearchParams<{
      rideCode?: string;
      rideName?: string;
      captainName?: string;
      role?: string;
      userName?: string;
    }>();


  /* ===================================================
     DISPLAY VALUES
     =================================================== */

  const displayRideCode =
    String(
      rideCode || '------'
    )
      .trim()
      .toUpperCase();


  const displayRideName =
    String(
      rideName || 'RYDO RIDE'
    );


  const displayCaptain =
    String(
      captainName || 'Captain'
    );


  const normalizedRole =
    String(
      role || 'captain'
    )
      .toLowerCase()
      .trim();


  const isCaptain =
    normalizedRole !== 'rider';


  const currentUserName =
    isCaptain
      ? displayCaptain
      : String(
          userName || 'Rider'
        ).trim();


  /* ===================================================
     MEMBER ID

     Same format as backend.
     =================================================== */

  const memberIdRef =
    useRef<string>('');


  if (!memberIdRef.current) {

    const cleanName =
      currentUserName
        .trim()
        .toLowerCase()
        .replace(
          /\s+/g,
          '-'
        );

    memberIdRef.current =
      `${
        isCaptain
          ? 'captain'
          : 'rider'
      }-${cleanName}`;

  }


  /* ===================================================
     LOCATION
     =================================================== */

  const [
    location,
    setLocation,
  ] =
    useState<
      Location.LocationObjectCoords | null
    >(null);


  const [
    locationLoading,
    setLocationLoading,
  ] =
    useState(true);


  const [
    locationPermission,
    setLocationPermission,
  ] =
    useState(false);


  /* ===================================================
     CAPTAIN LOCATION
     =================================================== */

  const [
    captainLocation,
    setCaptainLocation,
  ] =
    useState<
      CaptainLocation | null
    >(null);


  /* ===================================================
     ALL LIVE MEMBER LOCATIONS
     =================================================== */

  const [
    liveMemberLocations,
    setLiveMemberLocations,
  ] =
    useState<
      Record<
        string,
        LiveMemberLocation
      >
    >({});


  /* ===================================================
     SOCKET
     =================================================== */

  const socketRef =
    useRef<
      Socket | null
    >(null);


  const [
    socketConnected,
    setSocketConnected,
  ] =
    useState(false);


  /* ===================================================
     ROUTE
     =================================================== */

  const [
    routeData,
    setRouteData,
  ] =
    useState<RouteData>({
      start: null,
      destination: null,
      stops: [],
    });


  const [
    roadRoute,
    setRoadRoute,
  ] =
    useState<LatLng[]>([]);


  const [
    routeLoading,
    setRouteLoading,
  ] =
    useState(true);


  /* ===================================================
     CREW
     =================================================== */

  const [
    riders,
    setRiders,
  ] =
    useState<Rider[]>([]);


  const [
    crewLoading,
    setCrewLoading,
  ] =
    useState(true);


  /* ===================================================
     MAP
     =================================================== */

  const mapRef =
    useRef<MapView | null>(null);


  const [
    mapReady,
    setMapReady,
  ] =
    useState(false);


  /* ===================================================
     CONTROL
     =================================================== */

  const mountedRef =
    useRef(true);


  const fetchingRide =
    useRef(false);


  /* ===================================================
     SOCKET LOCATION TIMER
     =================================================== */

  const lastSocketLocationTime =
    useRef(0);


  /* ===================================================
     GET RIDE
     =================================================== */

  const fetchRide =
    async () => {

      if (
        !displayRideCode ||
        displayRideCode === '------'
      ) {
        return;
      }


      if (
        fetchingRide.current
      ) {
        return;
      }


      fetchingRide.current =
        true;


      try {

        const code =
          String(
            displayRideCode
          )
            .trim()
            .toUpperCase();


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
            'RYDO: Unable to get live ride'
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
           CAPTAIN LOCATION
           ============================================= */

        const backendCaptainLocation =
          ride?.captainLocation;


        if (
          backendCaptainLocation &&
          typeof backendCaptainLocation.latitude ===
            'number' &&
          typeof backendCaptainLocation.longitude ===
            'number'
        ) {

          setCaptainLocation({

            latitude:
              backendCaptainLocation.latitude,

            longitude:
              backendCaptainLocation.longitude,

            updatedAt:
              backendCaptainLocation.updatedAt,

          });

        } else {

          setCaptainLocation(null);

        }


        /* =============================================
           RIDERS
           ============================================= */

        const backendRiders =
          Array.isArray(
            ride?.riders
          )
            ? ride.riders
            : [];


        setRiders(
          backendRiders.map(
            (
              rider: any
            ) => ({

              _id:
                rider?._id,

              name:
                rider?.name ||
                'Rider',

              joinedAt:
                rider?.joinedAt,

            })
          )
        );


        setCrewLoading(false);


        /* =============================================
           ROUTE
           ============================================= */

        const backendRoute =
          ride?.route || {};


        /* =============================================
           START
           ============================================= */

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


        /* =============================================
           DESTINATION
           ============================================= */

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


        /* =============================================
           STOPS
           ============================================= */

        const stops =
          Array.isArray(
            backendRoute.stops
          )
            ? backendRoute.stops
                .filter(
                  (
                    stop: any
                  ) =>
                    stop &&
                    typeof stop.latitude ===
                      'number' &&
                    typeof stop.longitude ===
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
          'RYDO: Live ride fetch error:',
          error
        );

      } finally {

        fetchingRide.current =
          false;

      }

    };


  /* ===================================================
     LOAD RIDE
     =================================================== */

  useEffect(() => {

    mountedRef.current =
      true;


    fetchRide();


    const interval =
      setInterval(
        fetchRide,
        5000
      );


    return () => {

      mountedRef.current =
        false;

      clearInterval(
        interval
      );

    };

  }, [displayRideCode]);


  /* ===================================================
     SOCKET.IO CONNECTION
     =================================================== */

  useEffect(() => {

    if (
      !displayRideCode ||
      displayRideCode === '------'
    ) {
      return;
    }


    if (!SOCKET_URL) {

      console.log(
        'RYDO: SOCKET_URL is not configured'
      );

      return;
    }


    console.log(
      '================================'
    );

    console.log(
      'RYDO: CONNECTING SOCKET.IO'
    );

    console.log(
      'Socket URL:',
      SOCKET_URL
    );

    console.log(
      'Ride Code:',
      displayRideCode
    );

    console.log(
      'Member ID:',
      memberIdRef.current
    );

    console.log(
      'User:',
      currentUserName
    );

    console.log(
      'Role:',
      isCaptain
        ? 'captain'
        : 'rider'
    );

    console.log(
      '================================'
    );


    const socket =
      io(
        SOCKET_URL,
        {

          transports: [
            'websocket',
          ],

          autoConnect:
            false,

          reconnection:
            true,

          reconnectionAttempts:
            Infinity,

          reconnectionDelay:
            1000,

          timeout:
            10000,

        }
      );


    socketRef.current =
      socket;


    /* =============================================
       CONNECT
       ============================================= */

    socket.on(
      'connect',
      () => {

        console.log(
          'RYDO: Socket.IO connected'
        );

        console.log(
          'Socket ID:',
          socket.id
        );


        if (
          mountedRef.current
        ) {

          setSocketConnected(
            true
          );

        }


        /* =========================================
           JOIN RIDE
           ========================================= */

        socket.emit(
          'joinRide',
          {

            rideCode:
              displayRideCode,

            memberId:
              memberIdRef.current,

            userName:
              currentUserName,

            role:
              isCaptain
                ? 'captain'
                : 'rider',

          }
        );


        console.log(
          'RYDO: JOIN RIDE SENT'
        );


        socket.emit(
          'getSocketInfo'
        );

      }
    );


    /* =============================================
       RIDE JOINED
       ============================================= */

    socket.on(
      'rideJoined',
      (
        payload: any
      ) => {

        console.log(
          'RYDO: Ride joined successfully:',
          payload
        );

      }
    );


    /* =============================================
       SOCKET INFO
       ============================================= */

    socket.on(
      'socketInfo',
      (
        payload: any
      ) => {

        console.log(
          'RYDO: Socket info:',
          payload
        );

      }
    );


    /* =============================================
       SOCKET ERROR
       ============================================= */

    socket.on(
      'socketError',
      (
        payload: any
      ) => {

        console.log(
          'RYDO: Socket error:',
          payload
        );

      }
    );


    /* =============================================
       DISCONNECTED
       ============================================= */

    socket.on(
      'disconnect',
      (
        reason
      ) => {

        console.log(
          'RYDO: Socket.IO disconnected:',
          reason
        );


        if (
          mountedRef.current
        ) {

          setSocketConnected(
            false
          );

        }

      }
    );


    /* =============================================
       CONNECT ERROR
       ============================================= */

    socket.on(
      'connect_error',
      (
        error
      ) => {

        console.log(
          'RYDO: Socket.IO connection error:',
          error.message
        );


        if (
          mountedRef.current
        ) {

          setSocketConnected(
            false
          );

        }

      }
    );


    /* =============================================
       RECEIVE LIVE LOCATION
       ============================================= */

    socket.on(
      'locationUpdated',
      (
        payload:
          SocketLocationPayload
      ) => {

        console.log(
          'RYDO: LIVE LOCATION RECEIVED:',
          payload
        );


        if (!payload) {
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

          console.log(
            'RYDO: Invalid location received'
          );

          return;
        }


        /* =========================================
           ROLE
           ========================================= */

        const roleValue =
          payload.role ===
          'captain'
            ? 'captain'
            : 'rider';


        /* =========================================
           MEMBER ID
           ========================================= */

        const memberId =
          String(
            payload.memberId ||
            `${roleValue}-${String(
              payload.userName ||
              'member'
            )
              .trim()
              .toLowerCase()
              .replace(
                /\s+/g,
                '-'
              )}`
          );


        /* =========================================
           LOCATION OBJECT
           ========================================= */

        const memberLocation:
          LiveMemberLocation =
          {

            memberId,

            name:
              payload.userName ||
              (
                roleValue ===
                'captain'
                  ? displayCaptain
                  : 'Rider'
              ),

            role:
              roleValue,

            latitude,

            longitude,

            updatedAt:
              payload.updatedAt ||
              new Date().toISOString(),

          };


        if (
          !mountedRef.current
        ) {
          return;
        }


        /* =========================================
           UPDATE ALL MEMBERS
           ========================================= */

        setLiveMemberLocations(
          (
            previous
          ) => ({

            ...previous,

            [memberId]:
              memberLocation,

          })
        );


        /* =========================================
           UPDATE CAPTAIN LOCATION
           ========================================= */

        if (
          roleValue ===
          'captain'
        ) {

          setCaptainLocation({

            latitude,

            longitude,

            updatedAt:
              payload.updatedAt ||
              new Date().toISOString(),

          });

        }

      }
    );


    /* =============================================
       USER JOINED
       ============================================= */

    socket.on(
      'userJoined',
      (
        member: any
      ) => {

        console.log(
          'RYDO: MEMBER JOINED:',
          member
        );


        fetchRide();

      }
    );


    /* =============================================
       USER LEFT
       ============================================= */

    socket.on(
      'userLeft',
      (
        member: any
      ) => {

        console.log(
          'RYDO: MEMBER LEFT:',
          member
        );


        const memberId =
          member?.memberId ||
          (
            member?.userName
              ? `${
                  member?.role ===
                  'captain'
                    ? 'captain'
                    : 'rider'
                }-${String(
                  member.userName
                )
                  .trim()
                  .toLowerCase()
                  .replace(
                    /\s+/g,
                    '-'
                  )}`
              : null
          );


        if (
          memberId &&
          mountedRef.current
        ) {

          setLiveMemberLocations(
            (
              previous
            ) => {

              const updated = {
                ...previous,
              };


              delete updated[
                memberId
              ];


              return updated;

            }
          );

        }


        fetchRide();

      }
    );


    /* =============================================
       USER DISCONNECTED
       ============================================= */

    socket.on(
      'userDisconnected',
      (
        member: any
      ) => {

        console.log(
          'RYDO: MEMBER DISCONNECTED:',
          member
        );


        const memberId =
          member?.memberId ||
          (
            member?.userName
              ? `${
                  member?.role ===
                  'captain'
                    ? 'captain'
                    : 'rider'
                }-${String(
                  member.userName
                )
                  .trim()
                  .toLowerCase()
                  .replace(
                    /\s+/g,
                    '-'
                  )}`
              : null
          );


        if (
          memberId &&
          mountedRef.current
        ) {

          setLiveMemberLocations(
            (
              previous
            ) => {

              const updated = {
                ...previous,
              };


              delete updated[
                memberId
              ];


              return updated;

            }
          );

        }

      }
    );


    /* =============================================
       CONNECT SOCKET
       ============================================= */

    socket.connect();


    /* =============================================
       CLEANUP
       ============================================= */

    return () => {

      console.log(
        'RYDO: Disconnecting Socket.IO'
      );


      if (
        socket.connected
      ) {

        socket.emit(
          'leaveRide'
        );

      }


      socket.removeAllListeners();


      socket.disconnect();


      if (
        socketRef.current ===
        socket
      ) {

        socketRef.current =
          null;

      }


      if (
        mountedRef.current
      ) {

        setSocketConnected(
          false
        );

      }

    };

  }, [
    displayRideCode,
    isCaptain,
    displayCaptain,
    currentUserName,
  ]);


  /* ===================================================
     SEND LOCATION THROUGH SOCKET
     =================================================== */

  const sendLocationThroughSocket =
    (
      coords:
        Location.LocationObjectCoords
    ) => {

      const socket =
        socketRef.current;


      if (!socket) {

        console.log(
          'RYDO: Socket unavailable'
        );

        return;

      }


      if (!socket.connected) {

        console.log(
          'RYDO: Socket not connected'
        );

        return;

      }


      const now =
        Date.now();


      /*
         Send at most once every
         1.5 seconds.
      */

      if (
        now -
          lastSocketLocationTime.current <
        1500
      ) {

        return;

      }


      lastSocketLocationTime.current =
        now;


      const payload:
        SocketLocationPayload =
        {

          rideCode:
            displayRideCode,

          memberId:
            memberIdRef.current,

          userName:
            currentUserName,

          role:
            isCaptain
              ? 'captain'
              : 'rider',

          latitude:
            coords.latitude,

          longitude:
            coords.longitude,

          updatedAt:
            new Date().toISOString(),

        };


      console.log(
        'RYDO: SENDING LIVE LOCATION:',
        payload
      );


      socket.emit(
        'updateLocation',
        payload
      );

    };


  /* ===================================================
     UPDATE CAPTAIN LOCATION THROUGH REST
     =================================================== */

  const updateCaptainLocationREST =
    async (
      coords:
        Location.LocationObjectCoords
    ) => {

      if (!isCaptain) {
        return;
      }


      try {

        const response =
          await fetch(
            `${API_URL}/api/rides/${encodeURIComponent(
              displayRideCode
            )}/captain-location`,
            {

              method:
                'PATCH',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({

                  latitude:
                    coords.latitude,

                  longitude:
                    coords.longitude,

                }),

            }
          );


        if (!response.ok) {

          let data:
            any = null;


          try {

            data =
              await response.json();

          } catch {
            // Ignore JSON parsing error
          }


          console.log(
            'RYDO: Captain REST location update failed:',
            data?.message
          );

        }

      } catch (error) {

        console.log(
          'RYDO: Captain REST location error:',
          error
        );

      }

    };


  /* ===================================================
     LOCATION TRACKING
     =================================================== */

  useEffect(() => {

    let subscription:
      Location.LocationSubscription |
      null = null;


    let cancelled =
      false;


    const startTracking =
      async () => {

        try {

          /* =========================================
             REQUEST PERMISSION
             ========================================= */

          const {
            status,
          } =
            await Location
              .requestForegroundPermissionsAsync();


          if (cancelled) {
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


          /* =========================================
             GET CURRENT LOCATION
             ========================================= */

          const current =
            await Location
              .getCurrentPositionAsync(
                {

                  accuracy:
                    Location.Accuracy.High,

                }
              );


          if (cancelled) {
            return;
          }


          setLocation(
            current.coords
          );


          setLocationLoading(
            false
          );


          /* =========================================
             INITIAL SOCKET LOCATION
             ========================================= */

          sendLocationThroughSocket(
            current.coords
          );


          /* =========================================
             CAPTAIN INITIAL REST LOCATION
             ========================================= */

          if (isCaptain) {

            await updateCaptainLocationREST(
              current.coords
            );

          }


          /* =========================================
             WATCH LOCATION
             ========================================= */

          subscription =
            await Location
              .watchPositionAsync(
                {

                  accuracy:
                    Location.Accuracy.High,

                  timeInterval:
                    3000,

                  distanceInterval:
                    5,

                },

                async (
                  newLocation
                ) => {

                  if (cancelled) {
                    return;
                  }


                  const coords =
                    newLocation.coords;


                  setLocation(
                    coords
                  );


                  /* ==============================
                     EVERYONE → SOCKET
                     ============================== */

                  sendLocationThroughSocket(
                    coords
                  );


                  /* ==============================
                     CAPTAIN → REST FALLBACK
                     ============================== */

                  if (isCaptain) {

                    await updateCaptainLocationREST(
                      coords
                    );

                  }

                }
              );

        } catch (error) {

          console.log(
            'RYDO: Location error:',
            error
          );


          if (!cancelled) {

            setLocationLoading(
              false
            );

          }

        }

      };


    startTracking();


    return () => {

      cancelled =
        true;


      if (subscription) {

        subscription.remove();

      }

    };

  }, [
    displayRideCode,
    isCaptain,
    currentUserName,
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

        setRouteLoading(
          false
        );

        return;

      }


      try {

        setRouteLoading(
          true
        );


        const points:
          RoutePoint[] =
          [

            routeData.start,

            ...routeData.stops,

            routeData.destination,

          ];


        const coordinates =
          points
            .map(
              (
                point
              ) =>
                `${point.longitude},${point.latitude}`
            )
            .join(';');


        const url =
          `${OSRM_URL}/${coordinates}` +
          `?overview=full&geometries=geojson`;


        const response =
          await fetch(url);


        const data =
          await response.json();


        if (
          !response.ok ||
          data.code !== 'Ok' ||
          !data.routes ||
          !data.routes.length
        ) {

          throw new Error(
            'Unable to calculate route'
          );

        }


        const geometry =
          data.routes[0].geometry;


        if (
          !geometry ||
          !Array.isArray(
            geometry.coordinates
          )
        ) {

          throw new Error(
            'Invalid route'
          );

        }


        const coordinatesFromOSRM =
          geometry.coordinates.map(
            (
              coordinate:
                [number, number]
            ) => ({

              longitude:
                coordinate[0],

              latitude:
                coordinate[1],

            })
          );


        if (
          mountedRef.current
        ) {

          setRoadRoute(
            coordinatesFromOSRM
          );

        }

      } catch (error) {

        console.log(
          'RYDO: OSRM error:',
          error
        );


        setRoadRoute([]);

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
     ROUTE EFFECT
     =================================================== */

  useEffect(() => {

    if (
      routeData.start &&
      routeData.destination
    ) {

      fetchRoadRoute();

    } else {

      setRoadRoute([]);

      setRouteLoading(
        false
      );

    }

  }, [
    routeData.start?.latitude,
    routeData.start?.longitude,
    routeData.destination?.latitude,
    routeData.destination?.longitude,
    JSON.stringify(
      routeData.stops
    ),
  ]);


  /* ===================================================
     FIT MAP
     =================================================== */

  useEffect(() => {

    if (
      !mapReady ||
      !mapRef.current ||
      roadRoute.length === 0
    ) {

      return;

    }


    setTimeout(
      () => {

        if (
          mountedRef.current &&
          mapRef.current
        ) {

          mapRef.current.fitToCoordinates(
            roadRoute,
            {

              edgePadding: {

                top: 120,

                right: 80,

                bottom: 190,

                left: 80,

              },

              animated:
                true,

            }
          );

        }

      },
      500
    );

  }, [
    mapReady,
    roadRoute,
  ]);


  /* ===================================================
     SOS
     =================================================== */

  const handleSOS =
    () => {

      Alert.alert(
        'SOS',
        'SOS system will be connected to all crew members in the next step.',
        [

          {
            text:
              'CANCEL',

            style:
              'cancel',
          },

          {
            text:
              'OK',
          },

        ]
      );

    };


  /* ===================================================
     BACK
     =================================================== */

  const handleBack =
    () => {

      Alert.alert(
        'Leave Live Ride?',
        'Return to the previous screen?',
        [

          {
            text:
              'CANCEL',

            style:
              'cancel',
          },

          {

            text:
              'RETURN',

            onPress:
              () =>
                router.back(),

          },

        ]
      );

    };


  /* ===================================================
     TOTAL MEMBERS
     =================================================== */

  const totalMembers =
    riders.length + 1;


  /* ===================================================
     MAP INITIAL COORDINATES
     =================================================== */

  const mapLatitude =
    captainLocation?.latitude ??
    location?.latitude ??
    routeData.start?.latitude ??
    17.9689;


  const mapLongitude =
    captainLocation?.longitude ??
    location?.longitude ??
    routeData.start?.longitude ??
    79.5941;


  /* ===================================================
     LIVE MARKER LIST
     =================================================== */

  const liveMarkers =
    Object.values(
      liveMemberLocations
    );


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


        {/* =================================================
            MAP
            ================================================= */}

        {location ||
        captainLocation ||
        routeData.start ? (

          <MapView
            ref={mapRef}
            style={styles.map}

            showsUserLocation={
              false
            }

            showsMyLocationButton={
              false
            }

            showsCompass={
              true
            }

            rotateEnabled={
              true
            }

            zoomEnabled={
              true
            }

            scrollEnabled={
              true
            }

            pitchEnabled={
              true
            }

            onMapReady={() =>
              setMapReady(true)
            }

            initialRegion={{

              latitude:
                mapLatitude,

              longitude:
                mapLongitude,

              latitudeDelta:
                0.05,

              longitudeDelta:
                0.05,

            }}

          >


            {/* ===========================================
                LIVE MEMBER MARKERS
                =========================================== */}

            {liveMarkers.map(
              (
                member
              ) => (

                <Marker
                  key={
                    `live-member-${member.memberId}`
                  }

                  coordinate={{

                    latitude:
                      member.latitude,

                    longitude:
                      member.longitude,

                  }}

                  title={
                    member.name
                  }

                  description={
                    member.role ===
                    'captain'
                      ? 'Captain • Live Location'
                      : 'Rider • Live Location'
                  }

                  tracksViewChanges={
                    false
                  }

                >

                  <View
                    style={
                      styles.liveMarker
                    }
                  >

                    <View
                      style={
                        styles.liveMarkerInner
                      }
                    >

                      <Text
                        style={
                          styles.liveMarkerText
                        }
                      >
                        {member.name
                          .charAt(0)
                          .toUpperCase()}
                      </Text>

                    </View>

                  </View>

                </Marker>

              )
            )}


            {/* ===========================================
                CAPTAIN FALLBACK
                =========================================== */}

            {liveMarkers.filter(
              (
                member
              ) =>
                member.role ===
                'captain'
            ).length === 0 &&

              isCaptain &&
              location && (

                <Marker
                  coordinate={{

                    latitude:
                      location.latitude,

                    longitude:
                      location.longitude,

                  }}

                  title={
                    displayCaptain
                  }

                  description="Captain • Live Location"

                />

              )}


            {/* ===========================================
                CAPTAIN FALLBACK FOR RIDER
                =========================================== */}

            {liveMarkers.filter(
              (
                member
              ) =>
                member.role ===
                'captain'
            ).length === 0 &&

              !isCaptain &&
              captainLocation && (

                <Marker
                  coordinate={{

                    latitude:
                      captainLocation.latitude,

                    longitude:
                      captainLocation.longitude,

                  }}

                  title={
                    displayCaptain
                  }

                  description="Captain • Live Location"

                />

              )}


            {/* ===========================================
                START
                =========================================== */}

            {routeData.start && (

              <Marker
                coordinate={{

                  latitude:
                    routeData.start
                      .latitude,

                  longitude:
                    routeData.start
                      .longitude,

                }}

                title="START"

                description={
                  routeData.start.name
                }

              />

            )}


            {/* ===========================================
                STOPS
                =========================================== */}

            {routeData.stops.map(
              (
                stop,
                index
              ) => (

                <Marker
                  key={
                    `live-stop-${index}`
                  }

                  coordinate={{

                    latitude:
                      stop.latitude,

                    longitude:
                      stop.longitude,

                  }}

                  title={
                    `STOP ${
                      index + 1
                    }`
                  }

                  description={
                    stop.name
                  }

                />

              )
            )}


            {/* ===========================================
                DESTINATION
                =========================================== */}

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

              />

            )}


            {/* ===========================================
                ROAD ROUTE
                =========================================== */}

            {roadRoute.length > 1 && (

              <Polyline
                coordinates={
                  roadRoute
                }

                strokeWidth={
                  6
                }

                strokeColor="#FFFFFF"

                lineCap="round"

                lineJoin="round"

              />

            )}

          </MapView>

        ) : (

          <View
            style={
              styles.loadingScreen
            }
          >

            <Text
              style={
                styles.loadingTitle
              }
            >
              {locationLoading
                ? 'LOCATING...'
                : 'LOADING MAP...'}
            </Text>


            <Text
              style={
                styles.loadingText
              }
            >
              {locationLoading
                ? 'Getting your live position'
                : locationPermission
                ? 'Waiting for ride location'
                : 'Location access is not available'}
            </Text>

          </View>

        )}


        {/* =================================================
            TOP HEADER
            ================================================= */}

        <View
          style={styles.topOverlay}
        >

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.backButton}
            onPress={handleBack}
          >

            <Text
              style={styles.backArrow}
            >
              ‹
            </Text>

          </TouchableOpacity>


          <View
            style={styles.liveBadge}
          >

            <View
              style={styles.liveDot}
            />


            <Text
              style={styles.liveText}
            >
              {socketConnected
                ? 'LIVE'
                : 'CONNECTING'}
            </Text>

          </View>

        </View>


        {/* =================================================
            RIDE INFO
            ================================================= */}

        <View
          style={styles.rideInfo}
        >

          <Text
            style={styles.rideInfoLabel}
          >
            RYDO • LIVE RIDE
          </Text>


          <Text
            style={styles.rideInfoName}
            numberOfLines={1}
          >
            {displayRideName}
          </Text>


          <Text
            style={styles.rideInfoCode}
          >
            CODE • {displayRideCode}
          </Text>

        </View>


        {/* =================================================
            ROUTE STATUS
            ================================================= */}

        <View
          style={styles.routeBadge}
        >

          <View
            style={
              styles.routeStatusDot
            }
          />


          <Text
            style={
              styles.routeBadgeText
            }
          >
            {routeLoading
              ? 'CALCULATING ROUTE'
              : roadRoute.length > 0
              ? 'ROUTE ACTIVE'
              : 'ROUTE UNAVAILABLE'}
          </Text>

        </View>


        {/* =================================================
            CREW PANEL
            ================================================= */}

        <View
          style={styles.crewPanel}
        >

          <View
            style={styles.crewHeader}
          >

            <View>

              <Text
                style={
                  styles.crewLabel
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


            <View
              style={
                styles.crewLiveIndicator
              }
            >

              <View
                style={
                  styles.smallLiveDot
                }
              />


              <Text
                style={
                  styles.crewLiveText
                }
              >
                {socketConnected
                  ? 'LIVE'
                  : 'OFFLINE'}
              </Text>

            </View>

          </View>


          {/* ===========================================
              CAPTAIN
              =========================================== */}

          <View
            style={styles.crewMember}
          >

            <View
              style={
                styles.memberAvatar
              }
            >

              <Text
                style={
                  styles.avatarText
                }
              >
                C
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
                {isCaptain
                  ? 'CAPTAIN • YOU'
                  : 'CAPTAIN'}
              </Text>

            </View>


            <View
              style={
                styles.memberOnline
              }
            >

              <View
                style={
                  styles.onlineDot
                }
              />

            </View>

          </View>


          {/* ===========================================
              RIDERS
              =========================================== */}

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
                  styles.crewMember
                }
              >

                <View
                  style={
                    styles.memberAvatar
                  }
                >

                  <Text
                    style={
                      styles.avatarText
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
                    numberOfLines={1}
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
                    styles.memberOnline
                  }
                >

                  <View
                    style={
                      styles.onlineDot
                    }
                  />

                </View>

              </View>

            )
          )}


          {/* ===========================================
              EMPTY CREW
              =========================================== */}

          {!crewLoading &&
            riders.length === 0 && (

              <View
                style={
                  styles.emptyCrew
                }
              >

                <Text
                  style={
                    styles.emptyCrewText
                  }
                >
                  NO RIDERS YET
                </Text>

              </View>

            )}

        </View>


        {/* =================================================
            LIVE MEMBER COUNT
            ================================================= */}

        <View
          style={
            styles.liveLocationBadge
          }
        >

          <View
            style={
              styles.liveLocationDot
            }
          />


          <Text
            style={
              styles.liveLocationText
            }
          >
            {liveMarkers.length}{' '}
            LIVE LOCATION
            {liveMarkers.length === 1
              ? ''
              : 'S'}
          </Text>

        </View>


        {/* =================================================
            SOS
            ================================================= */}

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
                styles.sosTitle
              }
            >
              SOS
            </Text>


            <Text
              style={
                styles.sosSubtitle
              }
            >
              EMERGENCY
            </Text>

          </View>

        </TouchableOpacity>


        {/* =================================================
            BOTTOM ROUTE INFO
            ================================================= */}

        <View
          style={
            styles.bottomRoutePanel
          }
        >

          <View
            style={
              styles.bottomRoutePoint
            }
          >

            <View
              style={
                styles.startDot
              }
            />


            <View>

              <Text
                style={
                  styles.bottomLabel
                }
              >
                START
              </Text>


              <Text
                style={
                  styles.bottomName
                }
                numberOfLines={1}
              >
                {routeData.start?.name ||
                  'Not set'}
              </Text>

            </View>

          </View>


          <View
            style={
              styles.routeDivider
            }
          />


          <View
            style={
              styles.bottomRoutePoint
            }
          >

            <View
              style={
                styles.destinationDot
              }
            />


            <View>

              <Text
                style={
                  styles.bottomLabel
                }
              >
                DESTINATION
              </Text>


              <Text
                style={
                  styles.bottomName
                }
                numberOfLines={1}
              >
                {routeData.destination
                  ?.name ||
                  'Not set'}
              </Text>

            </View>

          </View>

        </View>

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
      backgroundColor: '#000000',
    },


    container: {
      flex: 1,
      backgroundColor: '#000000',
    },


    map: {
      ...StyleSheet.absoluteFillObject,
    },


    /* ================================================
       LOADING
       ================================================ */

    loadingScreen: {
      flex: 1,
      backgroundColor: '#050505',
      alignItems: 'center',
      justifyContent: 'center',
    },


    loadingTitle: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 2,
    },


    loadingText: {
      color: '#666666',
      fontSize: 10,
      marginTop: 8,
      textAlign: 'center',
    },


    /* ================================================
       LIVE MEMBER MARKER
       ================================================ */

    liveMarker: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        'rgba(255,255,255,0.25)',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },


    liveMarkerInner: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#FFFFFF',
    },


    liveMarkerText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },


    /* ================================================
       TOP
       ================================================ */

    topOverlay: {
      position: 'absolute',
      top: 12,
      left: 16,
      right: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },


    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        'rgba(0,0,0,0.75)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },


    backArrow: {
      color: '#FFFFFF',
      fontSize: 32,
      fontWeight: '300',
      marginTop: -4,
    },


    liveBadge: {
      height: 36,
      paddingHorizontal: 13,
      borderRadius: 18,
      backgroundColor:
        'rgba(0,0,0,0.75)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.15)',
      flexDirection: 'row',
      alignItems: 'center',
    },


    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#FFFFFF',
      marginRight: 7,
    },


    liveText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.5,
    },


    /* ================================================
       RIDE INFO
       ================================================ */

    rideInfo: {
      position: 'absolute',
      top: 68,
      left: 16,
      right: 16,
      backgroundColor:
        'rgba(0,0,0,0.72)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.12)',
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 4,
    },


    rideInfoLabel: {
      color: '#777777',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 1.5,
    },


    rideInfoName: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
      marginTop: 3,
    },


    rideInfoCode: {
      color: '#777777',
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: 3,
    },


    /* ================================================
       ROUTE BADGE
       ================================================ */

    routeBadge: {
      position: 'absolute',
      top: 165,
      left: 16,
      backgroundColor:
        'rgba(0,0,0,0.72)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.12)',
      paddingHorizontal: 10,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 3,
    },


    routeStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FFFFFF',
      marginRight: 7,
    },


    routeBadgeText: {
      color: '#FFFFFF',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 1.2,
    },


    /* ================================================
       CREW GLASS PANEL
       ================================================ */

    crewPanel: {
      position: 'absolute',
      top: 215,
      right: 12,
      width: 185,
      backgroundColor:
        'rgba(0,0,0,0.65)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.16)',
      borderRadius: 8,
      paddingHorizontal: 11,
      paddingVertical: 11,
    },


    crewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 9,
      borderBottomWidth: 1,
      borderBottomColor:
        'rgba(255,255,255,0.10)',
    },


    crewLabel: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.5,
    },


    crewCount: {
      color: '#666666',
      fontSize: 7,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: 2,
    },


    crewLiveIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    smallLiveDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: '#FFFFFF',
      marginRight: 5,
    },


    crewLiveText: {
      color: '#999999',
      fontSize: 6,
      fontWeight: '800',
      letterSpacing: 1,
    },


    crewMember: {
      minHeight: 45,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor:
        'rgba(255,255,255,0.07)',
    },


    memberAvatar: {
      width: 27,
      height: 27,
      borderRadius: 14,
      backgroundColor:
        'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.20)',
      alignItems: 'center',
      justifyContent: 'center',
    },


    avatarText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
    },


    memberDetails: {
      flex: 1,
      marginLeft: 8,
    },


    memberName: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },


    memberRole: {
      color: '#666666',
      fontSize: 6,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginTop: 2,
    },


    memberOnline: {
      width: 12,
      alignItems: 'center',
    },


    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FFFFFF',
    },


    emptyCrew: {
      paddingVertical: 12,
    },


    emptyCrewText: {
      color: '#555555',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 1,
    },


    /* ================================================
       LIVE LOCATION BADGE
       ================================================ */

    liveLocationBadge: {
      position: 'absolute',
      top: 390,
      right: 12,
      backgroundColor:
        'rgba(0,0,0,0.72)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.16)',
      borderRadius: 12,
      paddingHorizontal: 9,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
    },


    liveLocationDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FFFFFF',
      marginRight: 6,
    },


    liveLocationText: {
      color: '#FFFFFF',
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 0.8,
    },


    /* ================================================
       SOS
       ================================================ */

    sosButton: {
      position: 'absolute',
      bottom: 105,
      left: 16,
      right: 16,
      height: 62,
      borderRadius: 7,
      backgroundColor:
        'rgba(0,0,0,0.88)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.30)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },


    sosIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },


    sosIconText: {
      color: '#000000',
      fontSize: 18,
      fontWeight: '900',
    },


    sosTitle: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 2,
    },


    sosSubtitle: {
      color: '#777777',
      fontSize: 6,
      fontWeight: '800',
      letterSpacing: 1.5,
      marginTop: 2,
    },


    /* ================================================
       BOTTOM ROUTE
       ================================================ */

    bottomRoutePanel: {
      position: 'absolute',
      bottom: 16,
      left: 16,
      right: 16,
      minHeight: 76,
      backgroundColor:
        'rgba(0,0,0,0.86)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.15)',
      borderRadius: 6,
      paddingHorizontal: 13,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
    },


    bottomRoutePoint: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },


    startDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: '#FFFFFF',
      marginRight: 9,
    },


    destinationDot: {
      width: 10,
      height: 10,
      borderRadius: 2,
      backgroundColor: '#FFFFFF',
      marginRight: 9,
    },


    routeDivider: {
      width: 1,
      height: 32,
      backgroundColor:
        'rgba(255,255,255,0.15)',
      marginHorizontal: 10,
    },


    bottomLabel: {
      color: '#666666',
      fontSize: 6,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginBottom: 3,
    },


    bottomName: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '700',
      maxWidth: 110,
    },

  });