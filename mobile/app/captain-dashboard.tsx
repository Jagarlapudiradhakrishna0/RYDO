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
import { API_URL } from '@/constants/network';

/* =====================================================
   BACKEND
===================================================== */

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

  const [loadingRiders, setLoadingRiders] =
    useState(true);

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

  /* ===================================================
     MAP
  =================================================== */

  const [mapReady, setMapReady] =
    useState(false);

  const mapRef =
    useRef<MapView | null>(null);

  /* ===================================================
     FETCH CONTROL
  =================================================== */

  const mountedRef =
    useRef(true);

  const fetchInProgressRef =
    useRef(false);

  /* ===================================================
     PARAMS
  =================================================== */

  const {
    rideName,
    captainName,
    rideCode,
  } = useLocalSearchParams<{
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

  /* ===================================================
     GET RIDE
  =================================================== */

  const fetchRide = async () => {
    if (!rideCode) {
      console.log(
        'RYDO: No ride code available'
      );

      if (mountedRef.current) {
        setLoadingRiders(false);
        setLoadingRoute(false);
      }

      return;
    }

    /*
     Prevent multiple simultaneous requests.
    */

    if (fetchInProgressRef.current) {
      return;
    }

    fetchInProgressRef.current = true;

    const code = String(rideCode)
      .trim()
      .toUpperCase();

    try {
      const response = await fetch(
        `${API_URL}/api/rides/${encodeURIComponent(
          code
        )}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.log(
          'RYDO: Failed to get ride:',
          data.message
        );

        return;
      }

      if (!mountedRef.current) {
        return;
      }

      const ride = data.ride;

      /* =============================================
         RIDE STATUS
      ============================================= */

      setRideStarted(
        Boolean(ride?.isStarted)
      );

      /* =============================================
         RIDERS
         
         IMPORTANT:
         Every refresh replaces the local riders
         list with the backend's current list.

         Therefore, if a rider leaves the group and
         the backend removes them from ride.riders,
         they will automatically disappear here.
      ============================================= */

      const backendRiders =
        Array.isArray(ride?.riders)
          ? ride.riders
          : [];

      setRiders(
        backendRiders.map((rider: any) => ({
          _id: rider?._id,
          name:
            rider?.name ||
            'Rider',
          joinedAt:
            rider?.joinedAt,
        }))
      );

      /* =============================================
         ROUTE
      ============================================= */

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

      const newRoute: RouteData = {
        start,
        destination,
        stops,
      };

      setRouteData(newRoute);

      console.log(
        'RYDO: Ride refreshed',
        {
          riders:
            backendRiders.length,
          route:
            newRoute,
        }
      );
    } catch (error) {
      console.log(
        'RYDO: Backend connection error:',
        error
      );
    } finally {
      fetchInProgressRef.current =
        false;

      if (mountedRef.current) {
        setLoadingRiders(false);
        setLoadingRoute(false);
      }
    }
  };

  /* ===================================================
     LOAD RIDE + AUTO REFRESH
     
     The Captain Dashboard checks the backend every
     3 seconds.

     This means:
     
     Captain Dashboard
            ↓
       GET ride
            ↓
       backend riders
            ↓
       replace current riders
            ↓
     rider who left disappears
  =================================================== */

  useEffect(() => {
    mountedRef.current = true;

    fetchRide();

    const interval =
      setInterval(() => {
        fetchRide();
      }, 3000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [rideCode]);

  /* ===================================================
     LOCATION TRACKING
  =================================================== */

  useEffect(() => {
    let subscription:
      | Location.LocationSubscription
      | null = null;

    let cancelled = false;

    const startLocationTracking =
      async () => {
        try {
          const { status } =
            await Location.requestForegroundPermissionsAsync();

          if (cancelled) {
            return;
          }

          if (status !== 'granted') {
            setLocationPermission(false);
            setLocationLoading(false);
            return;
          }

          setLocationPermission(true);

          const currentLocation =
            await Location.getCurrentPositionAsync(
              {
                accuracy:
                  Location.Accuracy.High,
              }
            );

          if (cancelled) {
            return;
          }

          setLocation(
            currentLocation.coords
          );

          setLocationLoading(false);

          subscription =
            await Location.watchPositionAsync(
              {
                accuracy:
                  Location.Accuracy.High,

                timeInterval: 3000,

                distanceInterval: 5,
              },

              (newLocation) => {
                if (!cancelled) {
                  setLocation(
                    newLocation.coords
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
            setLocationLoading(false);
          }
        }
      };

    startLocationTracking();

    return () => {
      cancelled = true;

      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  /* ===================================================
     GET ROAD ROUTE FROM OSRM
  =================================================== */

  const fetchRoadRoute = async () => {
    if (
      !routeData.start ||
      !routeData.destination
    ) {
      console.log(
        'RYDO: Route coordinates missing'
      );

      setRoadRoute([]);

      return;
    }

    try {
      setRouteLoading(true);
      setRouteError('');

      /*
       Route order:

       Start
       ↓
       Stops
       ↓
       Destination
      */

      const points: RoutePoint[] = [
        routeData.start,
        ...routeData.stops,
        routeData.destination,
      ];

      const coordinates = points
        .map(
          (point) =>
            `${point.longitude},${point.latitude}`
        )
        .join(';');

      const url =
        `${OSRM_URL}/${coordinates}` +
        `?overview=full&geometries=geojson`;

      console.log(
        'RYDO: Requesting OSRM route'
      );

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
          'Unable to calculate road route'
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

      setRoadRoute(
        coordinatesFromOSRM
      );

      console.log(
        'RYDO: Road route loaded:',
        coordinatesFromOSRM.length,
        'points'
      );

      setTimeout(() => {
        if (
          mountedRef.current &&
          mapRef.current &&
          coordinatesFromOSRM.length
        ) {
          mapRef.current.fitToCoordinates(
            coordinatesFromOSRM,
            {
              edgePadding: {
                top: 70,
                right: 50,
                bottom: 70,
                left: 50,
              },

              animated: true,
            }
          );
        }
      }, 500);
    } catch (error) {
      console.log(
        'RYDO: OSRM route error:',
        error
      );

      if (mountedRef.current) {
        setRoadRoute([]);
        setRouteError(
          'Unable to load road route'
        );
      }
    } finally {
      if (mountedRef.current) {
        setRouteLoading(false);
      }
    }
  };

  /* ===================================================
     LOAD ROAD ROUTE WHEN ROUTE CHANGES
  =================================================== */

  useEffect(() => {
    if (
      routeData.start &&
      routeData.destination
    ) {
      fetchRoadRoute();
    } else {
      setRoadRoute([]);
      setRouteError('');
    }
  }, [
    routeData.start?.latitude,
    routeData.start?.longitude,
    routeData.destination?.latitude,
    routeData.destination?.longitude,
    JSON.stringify(
      routeData.stops.map(
        (stop) => ({
          name: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
        })
      )
    ),
  ]);

  /* ===================================================
     FIT MAP TO ROUTE
  =================================================== */

  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      roadRoute.length === 0
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
              top: 80,
              right: 50,
              bottom: 80,
              left: 50,
            },

            animated: true,
          }
        );
      }
    }, 500);
  }, [
    roadRoute,
    mapReady,
  ]);

  /* ===================================================
     SHARE RIDE
  =================================================== */

  const shareRide = async () => {
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

  const toggleRide = async () => {
    const code =
      String(displayRideCode)
        .trim()
        .toUpperCase();

    /* ===============================================
       END RIDE
    =============================================== */

    if (rideStarted) {
      try {
        const response =
          await fetch(
            `${API_URL}/api/rides/${encodeURIComponent(
              code
            )}/status`,
            {
              method: 'PATCH',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                isStarted: false,
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

        setRideStarted(false);

        /*
         Refresh immediately after ending.
        */

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

    /* ===============================================
       MAKE SURE ROAD ROUTE EXISTS
    =============================================== */

    if (roadRoute.length === 0) {
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
            method: 'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              isStarted: true,
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

      setRideStarted(true);

      /*
       OPEN FULL SCREEN LIVE MAP
       
       `as any` avoids Expo Router's generated
       pathname typing error when the route exists
       but TypeScript has not regenerated its route
       types yet.
      */

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
     TOTAL MEMBERS
  =================================================== */

  const totalMembers =
    riders.length + 1;

  /* ===================================================
     HAS ROUTE
  =================================================== */

  const hasRoute =
    Boolean(
      routeData.start &&
        routeData.destination
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

      <View style={styles.container}>

        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>
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

          <View style={styles.status}>
            <View
              style={[
                styles.statusDot,
                rideStarted &&
                  styles.statusDotActive,
              ]}
            />

            <Text
              style={styles.statusText}
            >
              {rideStarted
                ? 'LIVE'
                : 'READY'}
            </Text>
          </View>
        </View>

        {/* CONTENT */}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >

          {/* CURRENT RIDE */}

          <View
            style={styles.rideHeader}
          >
            <Text
              style={styles.sectionLabel}
            >
              CURRENT RIDE
            </Text>

            <Text
              style={styles.rideName}
            >
              {displayRideName}
            </Text>

            <View
              style={styles.rideMeta}
            >
              <Text
                style={styles.metaText}
              >
                RIDE CODE
              </Text>

              <Text style={styles.code}>
                {displayRideCode}
              </Text>
            </View>
          </View>

          {/* ROUTE */}

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

              {loadingRoute ? (
                <Text
                  style={
                    styles.routeStatus
                  }
                >
                  LOADING
                </Text>
              ) : hasRoute ? (
                <Text
                  style={
                    styles.routeStatus
                  }
                >
                  CONFIRMED
                </Text>
              ) : (
                <Text
                  style={
                    styles.routeStatus
                  }
                >
                  NOT SET
                </Text>
              )}
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
                        routeData.start
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

          {/* LIVE ROUTE MAP */}

          <View
            style={styles.mapContainer}
          >

            {/* MAP HEADER */}

            <View
              style={
                styles.mapHeaderOverlay
              }
            >
              <Text
                style={styles.mapLabel}
              >
                RYDO ROUTE
              </Text>

              <Text
                style={styles.mapStatus}
              >
                {routeLoading
                  ? 'LOADING'
                  : roadRoute.length > 0
                  ? 'ROUTE READY'
                  : 'READY'}
              </Text>
            </View>

            {location ? (
              <MapView
                ref={mapRef}
                style={styles.realMap}
                showsUserLocation={true}
                showsMyLocationButton={
                  true
                }
                showsCompass={true}
                rotateEnabled={true}
                zoomEnabled={true}
                scrollEnabled={true}
                pitchEnabled={true}
                onMapReady={() =>
                  setMapReady(true)
                }
                initialRegion={{
                  latitude:
                    location.latitude,

                  longitude:
                    location.longitude,

                  latitudeDelta:
                    0.05,

                  longitudeDelta:
                    0.05,
                }}
              >

                {/* CAPTAIN */}

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
                  description="Captain current location"
                />

                {/* START */}

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

                {/* STOPS */}

                {routeData.stops.map(
                  (
                    stop,
                    index
                  ) => (
                    <Marker
                      key={`map-stop-${index}`}
                      coordinate={{
                        latitude:
                          stop.latitude,

                        longitude:
                          stop.longitude,
                      }}
                      title={`STOP ${
                        index + 1
                      }`}
                      description={
                        stop.name
                      }
                    />
                  )
                )}

                {/* DESTINATION */}

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

                {/* ROAD ROUTE */}

                {roadRoute.length > 1 && (
                  <Polyline
                    coordinates={
                      roadRoute
                    }
                    strokeWidth={5}
                    strokeColor="#FFFFFF"
                    lineCap="round"
                    lineJoin="round"
                  />
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

            {routeError !== '' && (
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

          {/* CREW */}

          <View
            style={styles.crewSection}
          >
            <View
              style={styles.sectionHeader}
            >
              <Text
                style={styles.sectionTitle}
              >
                CREW
              </Text>

              <Text
                style={styles.memberCount}
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
                  style={styles.number}
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
                  style={styles.memberDot}
                />

                <Text
                  style={styles.online}
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
                  style={styles.member}
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
                      style={
                        styles.memberDot
                      }
                    />

                    <Text
                      style={
                        styles.online
                      }
                    >
                      JOINED
                    </Text>
                  </View>
                </View>
              )
            )}

            {!loadingRiders &&
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

          {/* ROUTE PLANNING */}

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
              activeOpacity={0.8}
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

          {/* RIDE CONTROL */}

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
              activeOpacity={0.8}
              style={[
                styles.startButton,
                rideStarted &&
                  styles.stopButton,
              ]}
              onPress={toggleRide}
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
          </View>

          {/* SHARE */}

          <TouchableOpacity
            activeOpacity={0.75}
            style={
              styles.shareButton
            }
            onPress={shareRide}
          >
            <Text
              style={styles.shareText}
            >
              SHARE RIDE CODE
            </Text>

            <Text
              style={styles.shareArrow}
            >
              ↗
            </Text>
          </TouchableOpacity>

          {/* MANAGEMENT */}

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
              activeOpacity={0.75}
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
              activeOpacity={0.75}
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

          {/* BOTTOM */}

          <View style={styles.bottom}>
            <View
              style={styles.bottomLine}
            />

            <Text
              style={styles.bottomText}
            >
              RYDO • RIDE DIFFERENT
            </Text>
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* =====================================================
   STYLES
===================================================== */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },

  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 5,
    paddingBottom: 40,
  },

  /* HEADER */

  header: {
    height: 70,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brand: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 5,
  },

  captainLabel: {
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
    backgroundColor: '#555555',
    marginRight: 7,
  },

  statusDotActive: {
    backgroundColor: '#FFFFFF',
  },

  statusText: {
    color: '#AAAAAA',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  /* RIDE */

  rideHeader: {
    marginTop: 22,
  },

  sectionLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },

  rideName: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 8,
  },

  rideMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  metaText: {
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

  /* ROUTE */

  savedRouteSection: {
    marginTop: 28,
  },

  savedRouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  routeStatus: {
    color: '#777777',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  savedRouteBox: {
    borderWidth: 1,
    borderColor: '#252525',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#050505',
  },

  routePointRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#181818',
  },

  routePoint: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 15,
  },

  routeStartPoint: {
    backgroundColor: '#FFFFFF',
  },

  routeStopPoint: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#777777',
    marginLeft: 1,
    marginRight: 16,
  },

  routeDestinationPoint: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    marginLeft: -1,
    marginRight: 14,
  },

  routePointContent: {
    flex: 1,
  },

  routePointLabel: {
    color: '#555555',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },

  routePointName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  routeEmptyBox: {
    borderWidth: 1,
    borderColor: '#252525',
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: '#050505',
  },

  routeEmptyTitle: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  routeEmptyText: {
    color: '#444444',
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },

  /* MAP */

  mapContainer: {
    height: 280,
    borderWidth: 1,
    borderColor: '#252525',
    marginTop: 25,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#050505',
  },

  realMap: {
    width: '100%',
    height: '100%',
  },

  mapHeaderOverlay: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  mapLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    backgroundColor:
      'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  mapStatus: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    backgroundColor:
      'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  mapError: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor:
      'rgba(0,0,0,0.85)',
    padding: 10,
  },

  mapErrorText: {
    color: '#FFFFFF',
    fontSize: 9,
    textAlign: 'center',
  },

  locationLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
  },

  locationLoadingTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  locationLoadingText: {
    color: '#555555',
    fontSize: 10,
    marginTop: 7,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  /* CREW */

  crewSection: {
    marginTop: 28,
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
    minHeight: 65,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#242424',
    flexDirection: 'row',
    alignItems: 'center',
  },

  memberNumber: {
    width: 35,
  },

  number: {
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

  memberStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  memberDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },

  online: {
    color: '#666666',
    fontSize: 7,
    fontWeight: '700',
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

  /* ROUTE PLANNING */

  routeSection: {
    marginTop: 28,
  },

  routeButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#242424',
    backgroundColor: '#111111',
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  routeButtonTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  routeButtonSubtitle: {
    color: '#666666',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 3,
  },

  routeButtonArrow: {
    color: '#FFFFFF',
    fontSize: 22,
  },

  /* CONTROL */

  controlSection: {
    marginTop: 28,
  },

  startButton: {
    height: 58,
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stopButton: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },

  startButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  stopButtonText: {
    color: '#FFFFFF',
  },

  startArrow: {
    color: '#000000',
    fontSize: 23,
    marginLeft: 17,
  },

  /* SHARE */

  shareButton: {
    height: 52,
    borderWidth: 1,
    borderColor: '#292929',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  shareText: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  shareArrow: {
    color: '#FFFFFF',
    fontSize: 19,
    marginLeft: 14,
  },

  /* MANAGEMENT */

  managementSection: {
    marginTop: 30,
  },

  managementButton: {
    height: 52,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#242424',
    marginTop: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  managementText: {
    color: '#AAAAAA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
  },

  managementArrow: {
    color: '#FFFFFF',
    fontSize: 20,
  },

  /* BOTTOM */

  bottom: {
    alignItems: 'center',
    paddingTop: 35,
    paddingBottom: 10,
  },

  bottomLine: {
    width: 30,
    height: 1,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },

  bottomText: {
    color: '#555555',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
  },
});