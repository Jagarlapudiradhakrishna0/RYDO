/* =====================================================
   RYDO - SOCKET.IO RIDE SERVER

   File:
   backend/socket/rideSocket.js

   PURPOSE:
   - Create Socket.IO ride rooms
   - Allow Captain/Riders to join a ride
   - Receive live GPS locations
   - Broadcast locations to everyone in the ride
   - Keep Captain and Rider locations separate
   - Track memberId consistently
   ===================================================== */


/* =====================================================
   INITIALIZE SOCKET.IO
   ===================================================== */

function initializeRideSocket(io) {

  console.log('================================');
  console.log('RYDO: Socket.IO INITIALIZING');
  console.log('================================');


  /* ===================================================
     CONNECTION
     =================================================== */

  io.on('connection', (socket) => {

    console.log('================================');
    console.log('RYDO: SOCKET CONNECTED');
    console.log('Socket ID:', socket.id);
    console.log('================================');


    /* =================================================
       JOIN RIDE

       Event:
       joinRide

       Data:
       {
         rideCode: 'ABC123',
         memberId: 'captain-john',
         userName: 'John',
         role: 'captain'
       }
       ================================================= */

    socket.on('joinRide', (data) => {

      try {

        if (!data) {

          console.log(
            'RYDO: joinRide received empty data'
          );

          return;
        }


        /* ---------------------------------------------
           DATA
           --------------------------------------------- */

        const rideCode =
          String(data.rideCode || '')
            .toUpperCase()
            .trim();

        const userName =
          String(data.userName || '')
            .trim();

        const role =
          String(data.role || 'rider')
            .toLowerCase()
            .trim();

        const memberId =
          String(data.memberId || '')
            .trim();


        /* ---------------------------------------------
           VALIDATION
           --------------------------------------------- */

        if (!rideCode) {

          socket.emit('socketError', {
            message: 'Ride code is required',
          });

          return;
        }


        if (!userName) {

          socket.emit('socketError', {
            message: 'User name is required',
          });

          return;
        }


        /* ---------------------------------------------
           MEMBER ID
           --------------------------------------------- */

        const validRole =
          role === 'captain'
            ? 'captain'
            : 'rider';

        const finalMemberId =
          memberId ||
          `${validRole}-${userName
            .toLowerCase()
            .replace(/\s+/g, '-')}`;


        /* ---------------------------------------------
           LEAVE PREVIOUS ROOM
           --------------------------------------------- */

        if (
          socket.rideCode &&
          socket.rideCode !== rideCode
        ) {

          socket.leave(
            socket.rideCode
          );

          console.log(
            'RYDO: Left previous ride room:',
            socket.rideCode
          );
        }


        /* ---------------------------------------------
           JOIN SOCKET ROOM
           --------------------------------------------- */

        socket.join(rideCode);


        /* ---------------------------------------------
           SAVE SOCKET INFORMATION
           --------------------------------------------- */

        socket.rideCode =
          rideCode;

        socket.memberId =
          finalMemberId;

        socket.userName =
          userName;

        socket.role =
          validRole;


        /* ---------------------------------------------
           LOG
           --------------------------------------------- */

        console.log('================================');
        console.log(
          'RYDO: USER JOINED SOCKET RIDE'
        );
        console.log(
          'Socket ID:',
          socket.id
        );
        console.log(
          'Member ID:',
          finalMemberId
        );
        console.log(
          'Ride Code:',
          rideCode
        );
        console.log(
          'User:',
          userName
        );
        console.log(
          'Role:',
          validRole
        );
        console.log('================================');


        /* ---------------------------------------------
           CONFIRM TO USER
           --------------------------------------------- */

        socket.emit(
          'rideJoined',
          {
            success: true,

            rideCode,

            memberId:
              finalMemberId,

            userName,

            role:
              validRole,

            message:
              'Connected to ride successfully',
          }
        );


        /* ---------------------------------------------
           INFORM EVERYONE ELSE
           --------------------------------------------- */

        socket
          .to(rideCode)
          .emit(
            'userJoined',
            {
              memberId:
                finalMemberId,

              userName,

              role:
                validRole,

              rideCode,
            }
          );


      } catch (error) {

        console.error(
          'RYDO: joinRide error'
        );

        console.error(error);

        socket.emit(
          'socketError',
          {
            message:
              'Failed to join ride',
          }
        );

      }

    });


    /* =================================================
       LIVE LOCATION

       Event:
       updateLocation

       Data:
       {
         rideCode: 'ABC123',
         memberId: 'captain-john',
         userName: 'John',
         role: 'captain',
         latitude: 17.3850,
         longitude: 78.4867,
         updatedAt: '2026-08-20T...'
       }
       ================================================= */

    socket.on(
      'updateLocation',
      (data) => {

        try {

          if (!data) {

            console.log(
              'RYDO: Empty location data'
            );

            return;
          }


          /* -------------------------------------------
             DATA
             ------------------------------------------- */

          const rideCode =
            String(
              data.rideCode ||
              socket.rideCode ||
              ''
            )
              .toUpperCase()
              .trim();

          const userName =
            String(
              data.userName ||
              socket.userName ||
              ''
            )
              .trim();

          const role =
            String(
              data.role ||
              socket.role ||
              'rider'
            )
              .toLowerCase()
              .trim();

          const memberId =
            String(
              data.memberId ||
              socket.memberId ||
              ''
            )
              .trim();

          const latitude =
            Number(data.latitude);

          const longitude =
            Number(data.longitude);


          /* -------------------------------------------
             VALIDATION
             ------------------------------------------- */

          if (!rideCode) {

            socket.emit(
              'socketError',
              {
                message:
                  'Ride code is required',
              }
            );

            return;
          }


          if (!userName) {

            socket.emit(
              'socketError',
              {
                message:
                  'User name is required',
              }
            );

            return;
          }


          if (!memberId) {

            socket.emit(
              'socketError',
              {
                message:
                  'Member ID is required',
              }
            );

            return;
          }


          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          ) {

            socket.emit(
              'socketError',
              {
                message:
                  'Valid latitude and longitude are required',
              }
            );

            return;
          }


          /* -------------------------------------------
             VALIDATE COORDINATE RANGE
             ------------------------------------------- */

          if (
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {

            socket.emit(
              'socketError',
              {
                message:
                  'Invalid GPS coordinates',
              }
            );

            return;
          }


          /* -------------------------------------------
             NORMALIZE ROLE
             ------------------------------------------- */

          const validRole =
            role === 'captain'
              ? 'captain'
              : 'rider';


          /* -------------------------------------------
             MAKE LOCATION OBJECT
             ------------------------------------------- */

          const locationData = {

            socketId:
              socket.id,

            memberId,

            rideCode,

            userName,

            role:
              validRole,

            latitude,

            longitude,

            updatedAt:
              data.updatedAt ||
              new Date().toISOString(),

          };


          /* -------------------------------------------
             LOG LOCATION
             ------------------------------------------- */

          console.log(
            'RYDO: LIVE LOCATION'
          );

          console.log(
            'Socket:',
            socket.id
          );

          console.log(
            'Member:',
            memberId
          );

          console.log(
            'Ride:',
            rideCode
          );

          console.log(
            'User:',
            userName
          );

          console.log(
            'Role:',
            validRole
          );

          console.log(
            'Latitude:',
            latitude
          );

          console.log(
            'Longitude:',
            longitude
          );


          /* -------------------------------------------
             BROADCAST TO EVERYONE IN RIDE

             io.to() includes the sender.
             ------------------------------------------- */

          io
            .to(rideCode)
            .emit(
              'locationUpdated',
              locationData
            );

        } catch (error) {

          console.error(
            'RYDO: updateLocation error'
          );

          console.error(error);

          socket.emit(
            'socketError',
            {
              message:
                'Failed to update location',
            }
          );

        }

      }
    );


    /* =================================================
       REQUEST CURRENT SOCKET INFO
       ================================================= */

    socket.on(
      'getSocketInfo',
      () => {

        socket.emit(
          'socketInfo',
          {

            socketId:
              socket.id,

            memberId:
              socket.memberId ||
              null,

            rideCode:
              socket.rideCode ||
              null,

            userName:
              socket.userName ||
              null,

            role:
              socket.role ||
              null,

          }
        );

      }
    );


    /* =================================================
       LEAVE RIDE
       ================================================= */

    socket.on(
      'leaveRide',
      () => {

        try {

          const rideCode =
            socket.rideCode;

          const userName =
            socket.userName;

          const role =
            socket.role;

          const memberId =
            socket.memberId;


          if (!rideCode) {
            return;
          }


          console.log(
            'RYDO: USER LEAVING RIDE'
          );

          console.log(
            'Socket:',
            socket.id
          );

          console.log(
            'Member:',
            memberId
          );

          console.log(
            'Ride:',
            rideCode
          );

          console.log(
            'User:',
            userName
          );

          console.log(
            'Role:',
            role
          );


          /* -------------------------------------------
             INFORM OTHER USERS
             ------------------------------------------- */

          socket
            .to(rideCode)
            .emit(
              'userLeft',
              {

                socketId:
                  socket.id,

                memberId,

                rideCode,

                userName,

                role,

              }
            );


          /* -------------------------------------------
             LEAVE ROOM
             ------------------------------------------- */

          socket.leave(
            rideCode
          );


          /* -------------------------------------------
             CLEAR SOCKET DATA
             ------------------------------------------- */

          socket.rideCode =
            null;

          socket.memberId =
            null;

          socket.userName =
            null;

          socket.role =
            null;


        } catch (error) {

          console.error(
            'RYDO: leaveRide error'
          );

          console.error(error);

        }

      }
    );


    /* =================================================
       DISCONNECT
       ================================================= */

    socket.on(
      'disconnect',
      (reason) => {

        console.log('================================');

        console.log(
          'RYDO: SOCKET DISCONNECTED'
        );

        console.log(
          'Socket ID:',
          socket.id
        );

        console.log(
          'Member:',
          socket.memberId ||
          'Unknown'
        );

        console.log(
          'User:',
          socket.userName ||
          'Unknown'
        );

        console.log(
          'Ride:',
          socket.rideCode ||
          'None'
        );

        console.log(
          'Role:',
          socket.role ||
          'Unknown'
        );

        console.log(
          'Reason:',
          reason
        );

        console.log('================================');


        /* -------------------------------------------
           INFORM RIDE MEMBERS
           ------------------------------------------- */

        if (socket.rideCode) {

          socket
            .to(socket.rideCode)
            .emit(
              'userDisconnected',
              {

                socketId:
                  socket.id,

                memberId:
                  socket.memberId,

                rideCode:
                  socket.rideCode,

                userName:
                  socket.userName,

                role:
                  socket.role,

              }
            );

        }

      }
    );

  });


  console.log(
    'RYDO: Socket.IO READY'
  );

}


/* =====================================================
   EXPORT
   ===================================================== */

module.exports =
  initializeRideSocket;