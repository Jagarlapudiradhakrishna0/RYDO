import React, {
  useEffect,
  useMemo,
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
  Alert,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import * as Location from 'expo-location';

import { API_URL } from '@/constants/network';
import { getCurrentUser } from '@/constants/auth';

import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';


/* =====================================================
   OSRM
===================================================== */

const OSRM_URL =
  'https://router.project-osrm.org/route/v1/driving';


/* =====================================================
   TYPES
===================================================== */

type LocationData = {
  name: string;
  latitude: number;
  longitude: number;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Rider = {
  _id?: string;
  name: string;
  joinedAt?: string;
  role?: string;

  latitude?: number;
  longitude?: number;

  location?: {
    latitude?: number;
    longitude?: number;
  };

  currentLocation?: {
    latitude?: number;
    longitude?: number;
  };

  riderLocation?: {
    latitude?: number;
    longitude?: number;
  };
};

type RouteData = {
  start: LocationData | null;
  destination: LocationData | null;
  stops: LocationData[];
};

type Ride = {
  _id?: string;

  rideCode: string;
  rideName: string;
  captainName: string;

  status?: 'ready' | 'live' | 'ended';

  members?: Rider[];
  riders?: Rider[];

  isStarted?: boolean;

  route?: RouteData;

  captainLocation?: Coordinate;

  riderLocation?: Coordinate;
};


/* =====================================================
   LIVE LOCATION RESPONSE
===================================================== */

type LiveLocationsResponse = {
  success?: boolean;

  captainLocation?: Coordinate | null;

  riders?: Rider[];

  members?: Rider[];
};


/* =====================================================
   COMPONENT
===================================================== */

export default function RiderDashboard() {

  const {
    rideCode,
    riderName,
  } =
    useLocalSearchParams<{
      rideCode?: string;
      riderName?: string;
    }>();


  /* ===================================================
     STATE
  =================================================== */

  const [
    ride,
    setRide,
  ] =
    useState<Ride | null>(null);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    backendError,
    setBackendError,
  ] =
    useState(false);


  const [
    locationLoading,
    setLocationLoading,
  ] =
    useState(true);


  const [
    locationPermissionDenied,
    setLocationPermissionDenied,
  ] =
    useState(false);


  /* ===================================================
     RIDER GPS
  =================================================== */

  const [
    riderLocation,
    setRiderLocation,
  ] =
    useState<Coordinate | null>(null);


  /* ===================================================
     CAPTAIN GPS
  =================================================== */

  const [
    captainLocation,
    setCaptainLocation,
  ] =
    useState<Coordinate | null>(null);


  /* ===================================================
     LIVE RIDERS
  =================================================== */

  const [
    liveRiders,
    setLiveRiders,
  ] =
    useState<Rider[]>([]);


  /* ===================================================
     ROAD ROUTE
  =================================================== */

  const [
    roadRoute,
    setRoadRoute,
  ] =
    useState<Coordinate[]>([]);


  const [
    routeLoading,
    setRouteLoading,
  ] =
    useState(false);


  const [
    routeError,
    setRouteError,
  ] =
    useState(false);


  const mapRef =
    useRef<MapView | null>(null);


  /* ===================================================
     DISPLAY
  =================================================== */

  const displayCode =
    ride?.rideCode ||
    String(rideCode || '------')
      .toUpperCase();


  const displayName =
    String(riderName || 'RIDER');


  const displayRideName =
    ride?.rideName ||
    'RYDO RIDE';


  const displayCaptain =
    ride?.captainName ||
    'CAPTAIN';


  /* ===================================================
     ROUTE
  =================================================== */

  const route: RouteData =
    ride?.route ||
    {
      start: null,
      destination: null,
      stops: [],
    };


  /* ===================================================
     STATUS
  =================================================== */

  const rideStarted =
    Boolean(
      ride?.isStarted ||
      ride?.status === 'live'
    );


  const rideEnded =
    ride?.status === 'ended';


  /* ===================================================
     RIDERS
  =================================================== */

  const riders: Rider[] =
    liveRiders.length > 0
      ? liveRiders
      : (
          ride?.riders ||
          (
            ride?.members
              ? ride.members.filter(
                  member =>
                    member.role === 'rider'
                )
              : []
          )
        );


  const totalMembers =
    riders.length + 1;


  /* ===================================================
     INITIAL MAP
  =================================================== */

  const mapInitialRegion: Region =
    useMemo(() => {

      if (riderLocation) {
        return {
          latitude:
            riderLocation.latitude,

          longitude:
            riderLocation.longitude,

          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        };
      }


      if (captainLocation) {
        return {
          latitude:
            captainLocation.latitude,

          longitude:
            captainLocation.longitude,

          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        };
      }


      if (route.start) {
        return {
          latitude:
            route.start.latitude,

          longitude:
            route.start.longitude,

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

    }, [
      riderLocation,
      captainLocation,
      route.start,
    ]);


  /* ===================================================
     MEMBER LOCATION
  =================================================== */

  const getMemberLocation =
    (
      member: Rider
    ): Coordinate | null => {

      if (
        typeof member.latitude === 'number' &&
        typeof member.longitude === 'number'
      ) {
        return {
          latitude:
            member.latitude,

          longitude:
            member.longitude,
        };
      }


      if (
        typeof member.location?.latitude === 'number' &&
        typeof member.location?.longitude === 'number'
      ) {
        return {
          latitude:
            member.location.latitude,

          longitude:
            member.location.longitude,
        };
      }


      if (
        typeof member.currentLocation?.latitude === 'number' &&
        typeof member.currentLocation?.longitude === 'number'
      ) {
        return {
          latitude:
            member.currentLocation.latitude,

          longitude:
            member.currentLocation.longitude,
        };
      }


      if (
        typeof member.riderLocation?.latitude === 'number' &&
        typeof member.riderLocation?.longitude === 'number'
      ) {
        return {
          latitude:
            member.riderLocation.latitude,

          longitude:
            member.riderLocation.longitude,
        };
      }


      return null;
    };


  /* ===================================================
     LIVE GPS
  =================================================== */

  useEffect(() => {

    let subscription:
      Location.LocationSubscription | null =
      null;

    let cancelled = false;


    const startTracking =
      async () => {

        try {

          const {
            status,
          } =
            await Location.requestForegroundPermissionsAsync();


          if (
            cancelled ||
            status !== 'granted'
          ) {

            setLocationPermissionDenied(
              status !== 'granted'
            );

            setLocationLoading(false);

            return;
          }


          setLocationPermissionDenied(false);


          console.log(
            'RYDO: LIVE GPS STARTED'
          );


          /* -----------------------------------------
             FIRST LOCATION
          ----------------------------------------- */

          try {

            const current =
              await Location.getCurrentPositionAsync(
                {
                  accuracy:
                    Location.Accuracy.Highest,
                }
              );


            if (!cancelled) {

              setRiderLocation({
                latitude:
                  current.coords.latitude,

                longitude:
                  current.coords.longitude,
              });

              setLocationLoading(false);
            }

          } catch (error) {

            console.log(
              'RYDO INITIAL GPS ERROR:',
              error
            );
          }


          /* -----------------------------------------
             CONTINUOUS GPS
          ----------------------------------------- */

          subscription =
            await Location.watchPositionAsync(
              {

                accuracy:
                  Location.Accuracy.Highest,

                timeInterval: 2000,

                distanceInterval: 3,

              },

              location => {

                if (cancelled) {
                  return;
                }


                const {
                  latitude,
                  longitude,
                } =
                  location.coords;


                console.log(
                  'RYDO RIDER GPS:',
                  latitude,
                  longitude
                );


                setRiderLocation({
                  latitude,
                  longitude,
                });


                setLocationLoading(false);
              }
            );

        } catch (error) {

          console.log(
            'RYDO GPS ERROR:',
            error
          );

          setLocationLoading(false);
        }
      };


    startTracking();


    return () => {

      cancelled = true;

      if (subscription) {
        subscription.remove();
      }
    };

  }, []);


  /* ===================================================
     FETCH RIDE
  =================================================== */

  const fetchRide =
    async () => {

      if (!rideCode) {

        setLoading(false);

        return;
      }


      try {

        const code =
          String(rideCode)
            .toUpperCase()
            .trim();


        const response =
          await fetch(
            `${API_URL}/api/rides/${encodeURIComponent(
              code
            )}`
          );


        const data =
          await response.json();


        console.log(
          'RYDO RIDE:',
          data
        );


        if (
          !response.ok ||
          !data.success
        ) {

          setBackendError(true);

          return;
        }


        const fetchedRide =
          data.ride as Ride;


        setRide(
          fetchedRide
        );


        /* -----------------------------------------
           CAPTAIN LOCATION FROM RIDE
        ----------------------------------------- */

        if (
          fetchedRide.captainLocation &&
          typeof fetchedRide.captainLocation.latitude === 'number' &&
          typeof fetchedRide.captainLocation.longitude === 'number'
        ) {

          setCaptainLocation({
            latitude:
              fetchedRide.captainLocation.latitude,

            longitude:
              fetchedRide.captainLocation.longitude,
          });
        }


        setBackendError(false);

      } catch (error) {

        console.log(
          'RYDO BACKEND ERROR:',
          error
        );

        setBackendError(true);

      } finally {

        setLoading(false);
      }
    };


  /* ===================================================
     FETCH LIVE LOCATIONS
  =================================================== */

  const fetchLiveLocations =
    async () => {

      if (!rideCode) {
        return;
      }


      try {

        const code =
          String(rideCode)
            .toUpperCase()
            .trim();


        const response =
          await fetch(
            `${API_URL}/api/rides/${encodeURIComponent(
              code
            )}/locations`
          );


        if (!response.ok) {
          return;
        }


        const data =
          await response.json() as LiveLocationsResponse;


        console.log(
          'RYDO LIVE LOCATIONS:',
          data
        );


        /* -----------------------------------------
           CAPTAIN
        ----------------------------------------- */

        if (
          data.captainLocation &&
          typeof data.captainLocation.latitude === 'number' &&
          typeof data.captainLocation.longitude === 'number'
        ) {

          setCaptainLocation({
            latitude:
              data.captainLocation.latitude,

            longitude:
              data.captainLocation.longitude,
          });
        }


        /* -----------------------------------------
           RIDERS
        ----------------------------------------- */

        if (
          Array.isArray(data.riders)
        ) {

          setLiveRiders(
            data.riders
          );

        } else if (
          Array.isArray(data.members)
        ) {

          setLiveRiders(
            data.members.filter(
              member =>
                member.role === 'rider'
            )
          );
        }

      } catch (error) {

        console.log(
          'RYDO LIVE LOCATION FETCH ERROR:',
          error
        );
      }
    };


  /* ===================================================
     RIDE AUTO REFRESH
  =================================================== */

  useEffect(() => {

    fetchRide();


    const rideInterval =
      setInterval(() => {

        fetchRide();

      }, 3000);


    return () => {

      clearInterval(
        rideInterval
      );
    };

  }, [rideCode]);


  /* ===================================================
     LIVE LOCATION AUTO REFRESH
  =================================================== */

  useEffect(() => {

    if (!rideCode) {
      return;
    }


    fetchLiveLocations();


    const locationInterval =
      setInterval(() => {

        fetchLiveLocations();

      }, 2000);


    return () => {

      clearInterval(
        locationInterval
      );
    };

  }, [rideCode]);


  /* ===================================================
     ROUTE WAYPOINTS
  =================================================== */

  const routeWaypoints =
    useMemo(() => {

      const points:
        Coordinate[] = [];


      if (route.start) {

        points.push({
          latitude:
            route.start.latitude,

          longitude:
            route.start.longitude,
        });
      }


      route.stops.forEach(
        stop => {

          points.push({
            latitude:
              stop.latitude,

            longitude:
              stop.longitude,
          });
        }
      );


      if (route.destination) {

        points.push({
          latitude:
            route.destination.latitude,

          longitude:
            route.destination.longitude,
        });
      }


      return points;

    }, [
      route.start,
      route.stops,
      route.destination,
    ]);


  /* ===================================================
     CALCULATE ROAD ROUTE
  =================================================== */

  useEffect(() => {

    let cancelled = false;


    const calculateRoute =
      async () => {

        if (
          routeWaypoints.length < 2
        ) {

          setRoadRoute([]);

          return;
        }


        try {

          setRouteLoading(true);
          setRouteError(false);


          const coordinates =
            routeWaypoints
              .map(
                point =>
                  `${point.longitude},${point.latitude}`
              )
              .join(';');


          const url =
            `${OSRM_URL}/${coordinates}` +
            `?overview=full` +
            `&geometries=geojson` +
            `&steps=true` +
            `&alternatives=false`;


          console.log(
            'RYDO ROUTING:',
            url
          );


          const response =
            await fetch(url);


          if (!response.ok) {

            throw new Error(
              'Routing request failed'
            );
          }


          const data =
            await response.json();


          if (
            data.code !== 'Ok' ||
            !data.routes ||
            !data.routes.length
          ) {

            throw new Error(
              'No road route found'
            );
          }


          const geometry =
            data.routes[0]?.geometry;


          if (
            !geometry ||
            !geometry.coordinates
          ) {

            throw new Error(
              'Route geometry missing'
            );
          }


          const convertedRoute:
            Coordinate[] =
            geometry.coordinates.map(
              (coordinate: number[]) => ({
                latitude:
                  coordinate[1],

                longitude:
                  coordinate[0],
              })
            );


          if (!cancelled) {

            setRoadRoute(
              convertedRoute
            );

            setRouteError(false);
          }

        } catch (error) {

          console.log(
            'RYDO ROUTING ERROR:',
            error
          );


          if (!cancelled) {

            setRoadRoute([]);

            setRouteError(true);
          }

        } finally {

          if (!cancelled) {
            setRouteLoading(false);
          }
        }
      };


    calculateRoute();


    return () => {

      cancelled = true;
    };

  }, [routeWaypoints]);


  /* ===================================================
     FIT MAP TO ROUTE
  =================================================== */

  useEffect(() => {

    if (
      !mapRef.current ||
      roadRoute.length < 2
    ) {
      return;
    }


    const timer =
      setTimeout(() => {

        mapRef.current?.fitToCoordinates(
          roadRoute,
          {
            edgePadding: {
              top: 190,
              right: 45,
              bottom: 250,
              left: 45,
            },

            animated: true,
          }
        );

      }, 500);


    return () => {

      clearTimeout(timer);
    };

  }, [roadRoute]);


  /* ===================================================
     FOLLOW RIDER AFTER RIDE START
  =================================================== */

  useEffect(() => {

    if (
      !rideStarted ||
      !riderLocation ||
      !mapRef.current
    ) {
      return;
    }


    mapRef.current.animateCamera(
      {
        center: {
          latitude:
            riderLocation.latitude,

          longitude:
            riderLocation.longitude,
        },
      },
      {
        duration: 800,
      }
    );

  }, [
    riderLocation?.latitude,
    riderLocation?.longitude,
    rideStarted,
  ]);


  /* ===================================================
     NAVIGATE — IN-APP (live-ride-map)
  =================================================== */

  const handleNavigateToCaptain =
    () => {

      const code =
        String(rideCode || '')
          .toUpperCase()
          .trim();


      if (!code) {

        Alert.alert(
          'Ride Error',
          'Ride code is missing. Cannot open navigation.'
        );

        return;
      }


      /* -----------------------------------------
         OPEN THE RYDO IN-APP NAVIGATION SCREEN

         live-ride-map.tsx handles:
         - Rider GPS tracking
         - Captain live marker (via Socket.IO)
         - Other rider markers (via Socket.IO)
         - Road route: Rider → Start → Destination
         - SOS button
      ----------------------------------------- */

      router.push({
        pathname: '/live-ride-map',

        params: {
          rideCode:
            code,

          riderName:
            String(riderName || '').trim(),

          rideName:
            displayRideName,

          captainName:
            displayCaptain,

          role:
            'rider',

          userName:
            String(riderName || '').trim(),
        },
      });
    };


  /* ===================================================
     SOS — SEND TO BACKEND + SOCKET BROADCAST
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


                  const name =
                    String(
                      riderName || ''
                    ).trim();


                  if (!code) {

                    Alert.alert(
                      'SOS Error',
                      'Ride code is missing.'
                    );

                    return;
                  }


                  /* -----------------------------------
                     GET CURRENT GPS FOR SOS
                  ----------------------------------- */

                  const lat =
                    riderLocation?.latitude ??
                    null;

                  const lng =
                    riderLocation?.longitude ??
                    null;


                  /* -----------------------------------
                     SEND SOS TO BACKEND
                  ----------------------------------- */

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
                              name || 'Unknown Rider',

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
     LEAVE
  =================================================== */

  const handleLeaveRide =
    () => {

      Alert.alert(
        'Leave Ride',

        'Are you sure you want to leave this ride?',

        [
          {
            text: 'CANCEL',
            style: 'cancel',
          },

          {
            text: 'LEAVE',
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


                  const name =
                    String(
                      riderName || ''
                    ).trim();


                  if (
                    !code ||
                    !name
                  ) {

                    Alert.alert(
                      'Error',
                      'Ride code or rider name is missing.'
                    );

                    return;
                  }


                  const response =
                    await fetch(
                      `${API_URL}/api/rides/${encodeURIComponent(
                        code
                      )}/leave`,
                      {
                        method: 'POST',

                        headers: {
                          'Content-Type':
                            'application/json',
                        },

                        body:
                          JSON.stringify({
                            riderName:
                              name,
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
                      'Unable to Leave',

                      data.message ||
                        'Failed to leave ride.'
                    );

                    return;
                  }


                  router.back();

                } catch (error) {

                  console.log(
                    'RYDO LEAVE ERROR:',
                    error
                  );


                  Alert.alert(
                    'Connection Error',

                    'Could not connect to the server.'
                  );
                }
              },
          },
        ]
      );
    };


  /* ===================================================
     ROUTE MARKERS
  =================================================== */

  const renderRouteMarkers =
    () => {

      return (
        <>

          {/* START */}

          {route.start && (

            <Marker
              coordinate={{
                latitude:
                  route.start.latitude,

                longitude:
                  route.start.longitude,
              }}

              title="START"

              description={
                route.start.name
              }

              zIndex={15}
            >

              <View
                style={
                  styles.liveStartMarker
                }
              >

                <Text
                  style={
                    styles.liveStartText
                  }
                >
                  S
                </Text>

              </View>

            </Marker>
          )}


          {/* STOPS */}

          {route.stops.map(
            (stop, index) => (

              <Marker
                key={
                  `stop-${index}`
                }

                coordinate={{
                  latitude:
                    stop.latitude,

                  longitude:
                    stop.longitude,
                }}

                title={
                  `STOP ${index + 1}`
                }

                description={
                  stop.name
                }

                zIndex={15}
              >

                <View
                  style={
                    styles.liveStopMarker
                  }
                >

                  <Text
                    style={
                      styles.liveStopText
                    }
                  >
                    {index + 1}
                  </Text>

                </View>

              </Marker>
            )
          )}


          {/* DESTINATION */}

          {route.destination && (

            <Marker
              coordinate={{
                latitude:
                  route.destination.latitude,

                longitude:
                  route.destination.longitude,
              }}

              title="DESTINATION"

              description={
                route.destination.name
              }

              zIndex={15}
            >

              <View
                style={
                  styles.liveDestinationMarker
                }
              />

            </Marker>
          )}

        </>
      );
    };


  /* ===================================================
     NORMAL DASHBOARD
  =================================================== */

  const renderNormalDashboard =
    () => {

      return (

        <ScrollView
          style={
            styles.scroll
          }

          contentContainerStyle={
            styles.scrollContent
          }

          showsVerticalScrollIndicator={
            false
          }
        >

          {/* RIDE */}

          <View
            style={
              styles.rideSection
            }
          >

            <Text
              style={styles.label}
            >
              CONNECTED RIDE
            </Text>

            <Text
              style={styles.rideName}
            >
              {displayRideName}
            </Text>

            <View
              style={styles.codeRow}
            >

              <Text
                style={styles.codeLabel}
              >
                RIDE CODE
              </Text>

              <Text
                style={styles.code}
              >
                {displayCode}
              </Text>

            </View>

          </View>


          {/* ROUTE */}

          <View
            style={styles.routeBox}
          >

            <View
              style={styles.routeHeader}
            >

              <Text
                style={styles.routeLabel}
              >
                JOURNEY ROUTE
              </Text>

              <Text
                style={styles.routeStatus}
              >
                NOT STARTED
              </Text>

            </View>


            {/* START */}

            <View
              style={styles.routePoint}
            >

              <View
                style={
                  styles.routeDotStart
                }
              />

              <View
                style={
                  styles.routeTextContainer
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
                >
                  {route.start?.name ||
                    'Waiting for captain'}
                </Text>

              </View>

            </View>


            {/* STOPS */}

            {route.stops.map(
              (stop, index) => (

                <View
                  key={
                    `normal-stop-${index}`
                  }

                  style={
                    styles.routePoint
                  }
                >

                  <View
                    style={
                      styles.routeDotStop
                    }
                  />

                  <View
                    style={
                      styles.routeTextContainer
                    }
                  >

                    <Text
                      style={
                        styles.routeSmall
                      }
                    >
                      STOP {index + 1}
                    </Text>

                    <Text
                      style={
                        styles.routePlace
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
              style={styles.routePoint}
            >

              <View
                style={
                  styles.routeDotDestination
                }
              />

              <View
                style={
                  styles.routeTextContainer
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
                >
                  {route.destination?.name ||
                    'Waiting for captain'}
                </Text>

              </View>

            </View>

          </View>


          {/* MAP */}

          <View
            style={
              styles.normalMapContainer
            }
          >

            <MapView
              ref={mapRef}

              style={styles.map}

              provider={PROVIDER_GOOGLE}

              initialRegion={
                mapInitialRegion
              }

              showsUserLocation={false}

              showsMyLocationButton={false}

              showsCompass={true}

              showsScale={true}

              loadingEnabled={true}

              toolbarEnabled={false}
            >

              {roadRoute.length > 1 && (

                <Polyline
                  coordinates={
                    roadRoute
                  }

                  strokeColor="#147BFF"

                  strokeWidth={6}

                  lineCap="round"

                  lineJoin="round"

                  zIndex={10}
                />
              )}


              {/* YOU */}

              {riderLocation && (

                <Marker
                  coordinate={
                    riderLocation
                  }

                  title="You"

                  description="Your live GPS location"

                  zIndex={30}
                >

                  <View
                    style={
                      styles.riderMarker
                    }
                  >

                    <View
                      style={
                        styles.riderMarkerInner
                      }
                    />

                  </View>

                </Marker>
              )}


              {/* CAPTAIN */}

              {captainLocation && (

                <Marker
                  coordinate={
                    captainLocation
                  }

                  title="Captain"

                  description={
                    displayCaptain
                  }

                  zIndex={35}
                >

                  <View
                    style={
                      styles.captainMarker
                    }
                  >

                    <Text
                      style={
                        styles.captainMarkerText
                      }
                    >
                      C
                    </Text>

                  </View>

                </Marker>
              )}


              {renderRouteMarkers()}

            </MapView>


            {/* ROUTE STATUS */}

            <View
              style={
                styles.routeStatusBadge
              }
            >

              <View
                style={
                  styles.routeStatusDot
                }
              />

              <Text
                style={
                  styles.routeStatusText
                }
              >

                {routeLoading
                  ? 'CALCULATING ROAD ROUTE'
                  : routeError
                  ? 'ROUTE UNAVAILABLE'
                  : roadRoute.length > 1
                  ? 'ROAD ROUTE READY'
                  : 'WAITING FOR ROUTE'}

              </Text>

            </View>


            {/* GPS */}

            <View
              style={
                styles.normalGPSStatus
              }
            >

              <View
                style={[
                  styles.mapStatusDot,

                  riderLocation &&
                    styles.mapStatusDotLive,
                ]}
              />

              <Text
                style={
                  styles.mapStatusText
                }
              >

                {locationLoading
                  ? 'GETTING GPS'
                  : locationPermissionDenied
                  ? 'GPS PERMISSION REQUIRED'
                  : 'YOUR GPS IS LIVE'}

              </Text>

            </View>

          </View>


          {renderCrew()}


          {/* STATUS */}

          <View
            style={
              styles.statusSection
            }
          >

            <Text
              style={styles.label}
            >
              RIDE STATUS
            </Text>

            <View
              style={styles.statusBox}
            >

              <View
                style={styles.bigDot}
              />

              <View
                style={
                  styles.statusContent
                }
              >

                <Text
                  style={
                    styles.statusTitle
                  }
                >
                  WAITING FOR CAPTAIN
                </Text>

                <Text
                  style={
                    styles.statusDescription
                  }
                >
                  The ride will begin when
                  the captain starts it.
                </Text>

              </View>

            </View>

          </View>


          {/* LEAVE */}

          <TouchableOpacity
            activeOpacity={0.8}

            style={
              styles.leaveButton
            }

            onPress={
              handleLeaveRide
            }
          >

            <Text
              style={
                styles.leaveText
              }
            >
              LEAVE RIDE
            </Text>

            <Text
              style={
                styles.leaveArrow
              }
            >
              ←
            </Text>

          </TouchableOpacity>


          <View
            style={styles.footer}
          >

            <View
              style={styles.footerLine}
            />

            <Text
              style={styles.footerText}
            >
              RYDO • RIDE DIFFERENT
            </Text>

          </View>

        </ScrollView>
      );
    };


  /* ===================================================
     CREW
  =================================================== */

  const renderCrew =
    () => {

      return (

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
              {totalMembers === 1
                ? 'MEMBER'
                : 'MEMBERS'}
            </Text>

          </View>


          {/* CAPTAIN */}

          <View
            style={styles.member}
          >

            <Text
              style={styles.number}
            >
              01
            </Text>

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
                GROUP CAPTAIN
              </Text>

            </View>

            <View
              style={styles.online}
            >

              <View
                style={
                  styles.onlineDot
                }
              />

              <Text
                style={
                  styles.onlineText
                }
              >
                LIVE
              </Text>

            </View>

          </View>


          {/* RIDERS */}

          {riders.map(
            (rider, index) => {

              const isYou =
                rider.name ===
                displayName;


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

                  <Text
                    style={
                      styles.number
                    }
                  >
                    {String(
                      index + 2
                    ).padStart(2, '0')}
                  </Text>


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
                      {isYou
                        ? 'YOU • RIDER'
                        : 'RIDER'}
                    </Text>

                  </View>


                  {isYou ? (

                    <View
                      style={
                        styles.youBadge
                      }
                    >

                      <Text
                        style={
                          styles.youBadgeText
                        }
                      >
                        YOU
                      </Text>

                    </View>

                  ) : (

                    <View
                      style={
                        styles.online
                      }
                    >

                      <View
                        style={
                          styles.onlineDot
                        }
                      />

                      <Text
                        style={
                          styles.onlineText
                        }
                      >
                        LIVE
                      </Text>

                    </View>
                  )}

                </View>
              );
            }
          )}


          {!loading &&
            riders.length === 0 && (

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
                  NO OTHER RIDERS
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  You are currently the
                  only rider.
                </Text>

              </View>
            )}

        </View>
      );
    };


  /* ===================================================
     LIVE RIDE
  =================================================== */

  const renderLiveRide =
    () => {

      return (

        <View
          style={
            styles.liveContainer
          }
        >

          {/* =================================================
              MAP
          ================================================= */}

          <MapView
            ref={mapRef}

            style={
              styles.fullMap
            }

            provider={
              PROVIDER_GOOGLE
            }

            initialRegion={
              mapInitialRegion
            }

            showsUserLocation={false}

            showsMyLocationButton={false}

            showsCompass={false}

            showsScale={false}

            loadingEnabled={true}

            toolbarEnabled={false}
          >

            {/* BLUE ROAD ROUTE */}

            {roadRoute.length > 1 && (

              <Polyline
                coordinates={
                  roadRoute
                }

                strokeColor="#147BFF"

                strokeWidth={7}

                lineCap="round"

                lineJoin="round"

                geodesic={false}

                zIndex={10}
              />
            )}


            {/* =================================================
                RIDER / YOU
            ================================================= */}

            {riderLocation && (

              <Marker
                coordinate={
                  riderLocation
                }

                title="You"

                description={
                  'Your live GPS location'
                }

                anchor={{
                  x: 0.5,
                  y: 0.5,
                }}

                zIndex={40}
              >

                <View
                  style={
                    styles.liveRiderMarker
                  }
                >

                  <View
                    style={
                      styles.liveRiderInner
                    }
                  />

                </View>

              </Marker>
            )}


            {/* =================================================
                CAPTAIN
            ================================================= */}

            {captainLocation && (

              <Marker
                coordinate={
                  captainLocation
                }

                title="Captain"

                description={
                  displayCaptain
                }

                anchor={{
                  x: 0.5,
                  y: 0.5,
                }}

                zIndex={50}
              >

                <View
                  style={
                    styles.liveCaptainMarker
                  }
                >

                  <Text
                    style={
                      styles.liveCaptainText
                    }
                  >
                    C
                  </Text>

                </View>

              </Marker>
            )}


            {/* =================================================
                OTHER RIDERS
            ================================================= */}

            {riders.map(
              (rider, index) => {

                const memberLocation =
                  getMemberLocation(
                    rider
                  );


                if (
                  !memberLocation ||
                  rider.name ===
                    displayName
                ) {

                  return null;
                }


                return (

                  <Marker
                    key={
                      `crew-${rider._id || rider.name}-${index}`
                    }

                    coordinate={
                      memberLocation
                    }

                    title={
                      rider.name
                    }

                    description={
                      'RYDO Crew Rider'
                    }

                    zIndex={30}
                  >

                    <View
                      style={
                        styles.crewMapMarker
                      }
                    >

                      <View
                        style={
                          styles.crewMapMarkerInner
                        }
                      />

                    </View>

                  </Marker>
                );
              }
            )}


            {renderRouteMarkers()}

          </MapView>


          {/* DARK OVERLAY */}

          <View
            pointerEvents="none"

            style={
              styles.mapDarkOverlay
            }
          />


          {/* =================================================
              TOP CARD
          ================================================= */}

          <View
            style={
              styles.liveTop
            }
          >

            <View
              style={
                styles.liveRideCard
              }
            >

              <View
                style={
                  styles.liveBrandRow
                }
              >

                <Text
                  style={
                    styles.liveBrand
                  }
                >
                  RYDO
                </Text>

                <View
                  style={
                    styles.liveBadge
                  }
                >

                  <View
                    style={
                      styles.liveBadgeDot
                    }
                  />

                  <Text
                    style={
                      styles.liveBadgeText
                    }
                  >
                    LIVE
                  </Text>

                </View>

              </View>


              <Text
                style={
                  styles.liveRideName
                }
              >
                {displayRideName}
              </Text>


              <Text
                style={
                  styles.liveCode
                }
              >
                {displayCode}
              </Text>

            </View>

          </View>


          {/* =================================================
              ROUTE ACTIVE
          ================================================= */}

          <View
            style={
              styles.routeActiveBadge
            }
          >

            <View
              style={
                styles.routeActiveDot
              }
            />

            <Text
              style={
                styles.routeActiveText
              }
            >

              {routeLoading
                ? 'CALCULATING ROUTE'
                : routeError
                ? 'ROUTE ERROR'
                : 'BLUE ROAD ROUTE ACTIVE'}

            </Text>

          </View>


          {/* =================================================
              NAVIGATE TO CAPTAIN
          ================================================= */}

          <TouchableOpacity
            activeOpacity={0.85}

            onPress={
              handleNavigateToCaptain
            }

            style={
              styles.navigateButton
            }
          >

            <View
              style={
                styles.navigateArrowCircle
              }
            >

              <Text
                style={
                  styles.navigateArrow
                }
              >
                ↑
              </Text>

            </View>


            <Text
              style={
                styles.navigateText
              }
            >
              NAVIGATE
            </Text>

          </TouchableOpacity>


          {/* =================================================
              SOS
          ================================================= */}

          <TouchableOpacity
            activeOpacity={0.8}

            onPress={
              handleSOS
            }

            style={
              styles.sosButton
            }
          >

            <View
              style={
                styles.sosIcon
              }
            >

              <Text
                style={
                  styles.sosIconText
                }
              >
                !
              </Text>

            </View>

            <Text
              style={
                styles.sosText
              }
            >
              SOS
            </Text>

            <Text
              style={
                styles.sosSubText
              }
            >
              EMERGENCY
            </Text>

          </TouchableOpacity>


          {/* =================================================
              CREW PANEL
          ================================================= */}

          <View
            style={
              styles.liveCrewPanel
            }
          >

            <View
              style={
                styles.liveCrewHeader
              }
            >

              <Text
                style={
                  styles.liveCrewTitle
                }
              >
                CREW
              </Text>

              <Text
                style={
                  styles.liveCrewCount
                }
              >
                {totalMembers}
              </Text>

            </View>


            {/* CAPTAIN */}

            <View
              style={
                styles.liveCrewMember
              }
            >

              <View
                style={
                  styles.liveCrewCaptainDot
                }
              />

              <View
                style={
                  styles.liveCrewInfo
                }
              >

                <Text
                  style={
                    styles.liveCrewName
                  }
                >
                  {displayCaptain}
                </Text>

                <Text
                  style={
                    styles.liveCrewRole
                  }
                >
                  CAPTAIN
                </Text>

              </View>

              <Text
                style={
                  styles.liveCrewStatus
                }
              >
                LIVE
              </Text>

            </View>


            {/* RIDERS */}

            {riders.map(
              (rider, index) => {

                const isYou =
                  rider.name ===
                  displayName;


                return (

                  <View
                    key={
                      `live-rider-${rider._id || rider.name}-${index}`
                    }

                    style={
                      styles.liveCrewMember
                    }
                  >

                    <View
                      style={[
                        styles.liveCrewDot,

                        isYou &&
                          styles.liveYouDot,
                      ]}
                    />


                    <View
                      style={
                        styles.liveCrewInfo
                      }
                    >

                      <Text
                        style={
                          styles.liveCrewName
                        }
                      >
                        {rider.name}
                      </Text>

                      <Text
                        style={
                          styles.liveCrewRole
                        }
                      >
                        {isYou
                          ? 'YOU • RIDER'
                          : 'RIDER'}
                      </Text>

                    </View>


                    <Text
                      style={
                        styles.liveCrewStatus
                      }
                    >
                      {isYou
                        ? 'YOU'
                        : 'LIVE'}
                    </Text>

                  </View>
                );
              }
            )}

          </View>


          {/* =================================================
              BOTTOM ROUTE
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
                  styles.bottomStartIcon
                }
              />

              <View
                style={
                  styles.bottomRouteText
                }
              >

                <Text
                  style={
                    styles.bottomSmall
                  }
                >
                  START
                </Text>

                <Text
                  numberOfLines={1}

                  style={
                    styles.bottomPlace
                  }
                >
                  {route.start?.name ||
                    'START'}
                </Text>

              </View>

            </View>


            <View
              style={
                styles.bottomDivider
              }
            />


            <View
              style={
                styles.bottomRoutePoint
              }
            >

              <View
                style={
                  styles.bottomDestinationIcon
                }
              />

              <View
                style={
                  styles.bottomRouteText
                }
              >

                <Text
                  style={
                    styles.bottomSmall
                  }
                >
                  DESTINATION
                </Text>

                <Text
                  numberOfLines={1}

                  style={
                    styles.bottomPlace
                  }
                >
                  {route.destination?.name ||
                    'DESTINATION'}
                </Text>

              </View>

            </View>

          </View>


          {/* =================================================
              GPS
          ================================================= */}

          <View
            style={
              styles.gpsLiveBadge
            }
          >

            <View
              style={
                styles.gpsLiveDot
              }
            />

            <Text
              style={
                styles.gpsLiveText
              }
            >

              {locationLoading
                ? 'GETTING GPS'
                : locationPermissionDenied
                ? 'GPS PERMISSION REQUIRED'
                : 'YOUR GPS IS LIVE'}

            </Text>

          </View>


          {/* =================================================
              LEAVE
          ================================================= */}

          <TouchableOpacity
            activeOpacity={0.8}

            onPress={
              handleLeaveRide
            }

            style={
              styles.liveLeaveButton
            }
          >

            <Text
              style={
                styles.liveLeaveText
              }
            >
              LEAVE
            </Text>

          </TouchableOpacity>

        </View>
      );
    };


  /* ===================================================
     MAIN
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

        {/* =============================================
            WAITING
        ============================================= */}

        {!rideStarted &&
          !rideEnded && (

            <>

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
                      styles.mode
                    }
                  >
                    RIDER MODE
                  </Text>

                </View>


                <View
                  style={
                    styles.status
                  }
                >

                  <View
                    style={
                      styles.statusDot
                    }
                  />

                  <Text
                    style={
                      styles.statusText
                    }
                  >

                    {loading
                      ? 'CONNECTING'
                      : backendError
                      ? 'OFFLINE'
                      : 'CONNECTED'}

                  </Text>

                </View>

              </View>


              {renderNormalDashboard()}

            </>
          )}


        {/* =============================================
            LIVE
        ============================================= */}

        {rideStarted &&
          !rideEnded &&
          renderLiveRide()}


        {/* =============================================
            ENDED
        ============================================= */}

        {rideEnded && (

          <View
            style={
              styles.endedContainer
            }
          >

            <Text
              style={
                styles.endedBrand
              }
            >
              RYDO
            </Text>

            <Text
              style={
                styles.endedTitle
              }
            >
              RIDE ENDED
            </Text>

            <Text
              style={
                styles.endedText
              }
            >
              This ride has been completed
              by the captain.
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}

              onPress={() =>
                router.back()
              }

              style={
                styles.endedButton
              }
            >

              <Text
                style={
                  styles.endedButtonText
                }
              >
                BACK
              </Text>

            </TouchableOpacity>

          </View>
        )}

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


    /* ================================================
       HEADER
    ================================================ */

    header: {
      height: 72,
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: '#171717',
    },

    brand: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 5,
    },

    mode: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 2,
      marginTop: 3,
    },

    status: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#292929',
      paddingHorizontal: 10,
      paddingVertical: 7,
    },

    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FFFFFF',
      marginRight: 7,
    },

    statusText: {
      color: '#AAAAAA',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1.5,
    },


    /* ================================================
       SCROLL
    ================================================ */

    scroll: {
      flex: 1,
    },

    scrollContent: {
      paddingHorizontal: 22,
      paddingTop: 25,
      paddingBottom: 70,
    },


    /* ================================================
       RIDE
    ================================================ */

    rideSection: {
      marginBottom: 24,
    },

    label: {
      color: '#555555',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 2,
    },

    rideName: {
      color: '#FFFFFF',
      fontSize: 31,
      fontWeight: '800',
      marginTop: 8,
    },

    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
    },

    codeLabel: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginRight: 10,
    },

    code: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 2,
    },


    /* ================================================
       ROUTE
    ================================================ */

    routeBox: {
      borderWidth: 1,
      borderColor: '#252525',
      padding: 18,
      marginBottom: 24,
    },

    routeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },

    routeLabel: {
      color: '#777777',
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 1.5,
    },

    routeStatus: {
      color: '#555555',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 1,
    },

    routePoint: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 55,
      borderTopWidth: 1,
      borderTopColor: '#181818',
    },

    routeTextContainer: {
      flex: 1,
      marginLeft: 13,
    },

    routeSmall: {
      color: '#555555',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 1.3,
    },

    routePlace: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 3,
    },

    routeDotStart: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: '#FFFFFF',
    },

    routeDotStop: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#777777',
    },

    routeDotDestination: {
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#FFFFFF',
      backgroundColor: '#000000',
    },


    /* ================================================
       MAP
    ================================================ */

    normalMapContainer: {
      height: 280,
      borderWidth: 1,
      borderColor: '#252525',
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: '#111111',
    },

    map: {
      width: '100%',
      height: '100%',
    },


    /* ================================================
       ROUTE STATUS
    ================================================ */

    routeStatusBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor:
        'rgba(0,0,0,0.82)',
      paddingHorizontal: 10,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
    },

    routeStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#147BFF',
      marginRight: 7,
    },

    routeStatusText: {
      color: '#FFFFFF',
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 1,
    },


    /* ================================================
       GPS
    ================================================ */

    normalGPSStatus: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      backgroundColor:
        'rgba(0,0,0,0.82)',
      paddingHorizontal: 12,
      paddingVertical: 9,
      flexDirection: 'row',
      alignItems: 'center',
    },

    mapStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#777777',
      marginRight: 8,
    },

    mapStatusDotLive: {
      backgroundColor: '#147BFF',
    },

    mapStatusText: {
      color: '#FFFFFF',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 1.2,
    },


    /* ================================================
       NORMAL MARKERS
    ================================================ */

    riderMarker: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: '#147BFF',
    },

    riderMarkerInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#147BFF',
    },

    captainMarker: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor:
        'rgba(0,0,0,0.78)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },

    captainMarkerText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },


    /* ================================================
       CREW
    ================================================ */

    crewSection: {
      marginTop: 30,
    },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 13,
    },

    sectionTitle: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 1,
    },

    memberCount: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 1,
    },

    member: {
      minHeight: 68,
      borderTopWidth: 1,
      borderColor: '#242424',
      flexDirection: 'row',
      alignItems: 'center',
    },

    number: {
      width: 35,
      color: '#555555',
      fontSize: 9,
      fontWeight: '700',
    },

    memberInfo: {
      flex: 1,
    },

    memberName: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },

    memberRole: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: 3,
    },

    online: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    onlineDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: '#FFFFFF',
      marginRight: 6,
    },

    onlineText: {
      color: '#666666',
      fontSize: 7,
      fontWeight: '700',
      letterSpacing: 1,
    },

    youBadge: {
      borderWidth: 1,
      borderColor: '#FFFFFF',
      paddingHorizontal: 9,
      paddingVertical: 5,
    },

    youBadgeText: {
      color: '#FFFFFF',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 1,
    },

    emptyCrew: {
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderColor: '#242424',
    },

    emptyTitle: {
      color: '#777777',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
    },

    emptyText: {
      color: '#444444',
      fontSize: 11,
      marginTop: 5,
    },


    /* ================================================
       STATUS
    ================================================ */

    statusSection: {
      marginTop: 30,
    },

    statusBox: {
      borderWidth: 1,
      borderColor: '#292929',
      marginTop: 12,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
    },

    bigDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#555555',
      marginRight: 15,
    },

    statusContent: {
      flex: 1,
    },

    statusTitle: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1,
    },

    statusDescription: {
      color: '#666666',
      fontSize: 11,
      marginTop: 5,
    },


    /* ================================================
       LEAVE
    ================================================ */

    leaveButton: {
      height: 54,
      borderWidth: 1,
      borderColor: '#292929',
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    leaveText: {
      color: '#777777',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
    },

    leaveArrow: {
      color: '#FFFFFF',
      fontSize: 18,
      marginLeft: 12,
    },


    /* ================================================
       FOOTER
    ================================================ */

    footer: {
      alignItems: 'center',
      paddingTop: 35,
      paddingBottom: 10,
    },

    footerLine: {
      width: 30,
      height: 1,
      backgroundColor: '#FFFFFF',
      marginBottom: 10,
    },

    footerText: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 2,
    },


    /* =================================================
       LIVE MODE
    ================================================= */

    liveContainer: {
      flex: 1,
      backgroundColor: '#000000',
    },

    fullMap: {
      ...StyleSheet.absoluteFillObject,
    },

    mapDarkOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor:
        'rgba(0,0,0,0.08)',
    },


    /* ================================================
       TOP CARD
    ================================================ */

    liveTop: {
      position: 'absolute',
      top: 14,
      left: 14,
      right: 14,
    },

    liveRideCard: {
      backgroundColor:
        'rgba(20,20,20,0.72)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.18)',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },

    liveBrandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    liveBrand: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 5,
    },

    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        'rgba(0,0,0,0.60)',
      paddingHorizontal: 9,
      paddingVertical: 6,
    },

    liveBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#147BFF',
      marginRight: 6,
    },

    liveBadgeText: {
      color: '#FFFFFF',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    liveRideName: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
      marginTop: 7,
    },

    liveCode: {
      color: '#BBBBBB',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 2,
      marginTop: 4,
    },


    /* ================================================
       ROUTE ACTIVE
    ================================================ */

    routeActiveBadge: {
      position: 'absolute',
      top: 142,
      left: 14,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        'rgba(15,15,15,0.78)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.16)',
      paddingHorizontal: 10,
      paddingVertical: 7,
    },

    routeActiveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#147BFF',
      marginRight: 7,
    },

    routeActiveText: {
      color: '#FFFFFF',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 1.2,
    },


    /* ================================================
       NAVIGATE BUTTON
    ================================================ */

    navigateButton: {
      position: 'absolute',
      right: 16,
      top: 190,
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor:
        'rgba(0,0,0,0.78)',
      borderWidth: 2,
      borderColor:
        'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    navigateArrowCircle: {
      width: 27,
      height: 27,
      borderRadius: 14,
      backgroundColor: '#147BFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 3,
    },

    navigateArrow: {
      color: '#FFFFFF',
      fontSize: 21,
      fontWeight: '900',
      lineHeight: 23,
    },

    navigateText: {
      color: '#FFFFFF',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 1,
    },


    /* ================================================
       SOS
    ================================================ */

    sosButton: {
      position: 'absolute',
      right: 16,
      bottom: 205,
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor:
        'rgba(20,20,20,0.76)',
      borderWidth: 2,
      borderColor:
        'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    sosIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 3,
    },

    sosIconText: {
      color: '#000000',
      fontSize: 13,
      fontWeight: '900',
    },

    sosText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    sosSubText: {
      color: '#888888',
      fontSize: 5,
      fontWeight: '800',
      letterSpacing: 1,
      marginTop: 2,
    },


    /* ================================================
       CREW PANEL
    ================================================ */

    liveCrewPanel: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 142,
      backgroundColor:
        'rgba(15,15,15,0.70)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.16)',
      paddingHorizontal: 13,
      paddingVertical: 9,
    },

    liveCrewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 5,
    },

    liveCrewTitle: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.8,
    },

    liveCrewCount: {
      color: '#777777',
      fontSize: 8,
      fontWeight: '800',
    },

    liveCrewMember: {
      minHeight: 32,
      borderTopWidth: 1,
      borderTopColor:
        'rgba(255,255,255,0.08)',
      flexDirection: 'row',
      alignItems: 'center',
    },

    liveCrewDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FFFFFF',
      marginRight: 9,
    },

    liveCrewCaptainDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#147BFF',
      marginRight: 9,
    },

    liveYouDot: {
      backgroundColor: '#147BFF',
    },

    liveCrewInfo: {
      flex: 1,
    },

    liveCrewName: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },

    liveCrewRole: {
      color: '#666666',
      fontSize: 6,
      fontWeight: '800',
      letterSpacing: 1,
      marginTop: 1,
    },

    liveCrewStatus: {
      color: '#BBBBBB',
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 1,
    },


    /* ================================================
       LIVE MARKERS
    ================================================ */

    liveRiderMarker: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        'rgba(20,123,255,0.30)',
      borderWidth: 3,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    liveRiderInner: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#147BFF',
      borderWidth: 3,
      borderColor: '#FFFFFF',
    },

    liveCaptainMarker: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        'rgba(0,0,0,0.78)',
      borderWidth: 3,
      borderColor: '#147BFF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    liveCaptainText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },

    crewMapMarker: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor:
        'rgba(0,0,0,0.65)',
      borderWidth: 2,
      borderColor:
        'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    crewMapMarkerInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#FFFFFF',
    },


    /* ================================================
       ROUTE MARKERS
    ================================================ */

    liveStartMarker: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    liveStartText: {
      color: '#000000',
      fontSize: 11,
      fontWeight: '900',
    },

    liveStopMarker: {
      width: 25,
      height: 25,
      borderRadius: 13,
      backgroundColor: '#147BFF',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    liveStopText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
    },

    liveDestinationMarker: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#147BFF',
      borderWidth: 3,
      borderColor: '#FFFFFF',
    },


    /* ================================================
       BOTTOM ROUTE
    ================================================ */

    bottomRoutePanel: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 73,
      minHeight: 58,
      backgroundColor:
        'rgba(15,15,15,0.76)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.18)',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
    },

    bottomRoutePoint: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },

    bottomRouteText: {
      flex: 1,
      marginLeft: 8,
    },

    bottomSmall: {
      color: '#777777',
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    bottomPlace: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      marginTop: 2,
    },

    bottomStartIcon: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#147BFF',
    },

    bottomDestinationIcon: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: '#147BFF',
      backgroundColor: '#000000',
    },

    bottomDivider: {
      width: 1,
      height: 30,
      backgroundColor:
        'rgba(255,255,255,0.16)',
      marginHorizontal: 10,
    },


    /* ================================================
       LIVE GPS
    ================================================ */

    gpsLiveBadge: {
      position: 'absolute',
      left: 14,
      bottom: 18,
      backgroundColor:
        'rgba(0,0,0,0.78)',
      paddingHorizontal: 10,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
    },

    gpsLiveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#147BFF',
      marginRight: 7,
    },

    gpsLiveText: {
      color: '#FFFFFF',
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 1,
    },


    /* ================================================
       LIVE LEAVE
    ================================================ */

    liveLeaveButton: {
      position: 'absolute',
      right: 14,
      bottom: 17,
      backgroundColor:
        'rgba(0,0,0,0.72)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.22)',
      paddingHorizontal: 12,
      paddingVertical: 7,
    },

    liveLeaveText: {
      color: '#AAAAAA',
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 1,
    },


    /* ================================================
       ENDED
    ================================================ */

    endedContainer: {
      flex: 1,
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },

    endedBrand: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 6,
    },

    endedTitle: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: 2,
      marginTop: 25,
    },

    endedText: {
      color: '#666666',
      fontSize: 12,
      textAlign: 'center',
      marginTop: 10,
    },

    endedButton: {
      marginTop: 30,
      borderWidth: 1,
      borderColor: '#333333',
      paddingHorizontal: 35,
      paddingVertical: 14,
    },

    endedButtonText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 2,
    },

  });