# nanoSQL 3

High Performance noSQL Application Database

- https://bellard.org/quickjs/ (query language)
- https://github.com/facebook/rocksdb (database backend)
- https://github.com/uNetworking/uWebSockets (web/client server)
- https://capnproto.org/ (indexes & keys)
- https://github.com/nlohmann/json (data format)
- https://github.com/Tarsnap/scrypt
- https://microsoft.github.io/monaco-editor/

Check out the work in progress API in proposed-api.md.

nanoSQL 3 is a complete rewrite of the project with a new set of goals:

1. Make Client/Server database communication faster and more secure.
2. Improve performance and get ACID behavior where possible.
3. Handle user authentication.

First, a new server arrangement is proposed.  Typically, the application server provides all access paths for the client and the application server will call the database server when it's needed.  The application server is thus responsible for making sure all database queries are safe and secure before passing them to the database.

A typical arrangement might look like this:

```
===============================
      Internet / Clients
===============================
             |  ^
             V  |
===============================
  Reverse Proxy (Nginx/Apache)
===============================
     |  ^       
     V  |           
|=============|    |==========|
| Application | -> | Database |
|    Server   | <- |  Server  |
|=============|    |==========|
```

The new proposed arrangement would look like this:

```
===============================
      Internet / Clients
===============================
             |  ^
             V  |
===============================
  Reverse Proxy (Nginx/Apache)
===============================
     |  ^             |  ^
     V  |             V  |
|=============|    |==========|
| Application | -> | Database |
|    Server   | <- |  Server  |
|=============|    |==========|
```

The database server, written in C, can connect directly to the clients and handle a much larger number of requests without passing any load to the application server.  Additionally, the database server can access the backend RocksDB store directly in native code without being slowed dramatically by calling javascript.

What about authentication (login/logout)?  These request are passed directly to the database server where it generates and handles client security with JSON web tokens.  Through configuration options, the database can optionally perform a POST request (hook) against the application server once a login completes successfully so modifications can be made to the JSON web token.  

Additional hooks can be configured so that arbitrary requests made to the database server can be authenticated against the JSON web token and passed to the application server for processing, then returned to the client.

## But I like Javascript!

New, [lightweight javascript](https://bellard.org/quickjs/) engines make it possible for a majority of the database processing to happen in native code, then we can call out to javascript functions sparingly to process query requests and configurations.

This means we can get the performance benefit of native code while also keeping the query language and configuration easy to write with javascript.

## Other Benefits

1. The LevelUp/LevelDown API provided in NodeJS with RocksDB is extremely limited.  Once the database server has direct, native access to the RocksDB backend we can make these improvements:
- No javascript is needed to run in order to read and write to the database, MUCH faster writes/reads.
- Secondary indexes can be updated with a single write instead of a read-deserialize-modify-serialize-write.
- Indexes no longer need to be stored in memory for pagination.
- Atomic updates across tables/indexes can be done with excellent performance.

2. SPA Support - It will be possible to run complex SPA apps that exclusively use the database server for their backend and nothing else.  SPA apps would only need the database server and a static file server.

3. Fast Offline Syncing - The database server can handle a majority of the authentication and processing to sync with offline enabled clients, removing the workload entirely from the application server.

4. Extensibility - It would be easy to add simple javascript application server scripting into the database at a later time.  This means even more complicated applications could exclusively use the database server and nothing else for the backend. 

5. MapReduce - The database server can handle live map/reduce jobs as updates occur.  Check out the "analytics" section of the `createDatabase` call in `proposed-api.md`.  As rows are updated, the map/reduce process discovers the primary key for each row and performs and performs an aggregation with the previous values.  This means instead of having to process analytics style data in bulk, it gets updated with each upsert query.

6. Job Queue - The database server can offload job queues from the application server.  Later, we'll be able to set it up so that a cluster of nanoSQL servers can split jobs evenly between them.

## The Current Plan
nanoSQL 3 will start off with four packages:
1. nanoSQL Server - The standalone application written mostly in C with a RocksDB backend, designed to run on your server.  Will not depend on NodeJS, express, or anything like that.
2. Server Control Panel - A user interface that can be used to view and modify the configuration, state, and data in the database server.
3. Web Client - A client side library designed to work with nanoSQL Server.
4. Express Plugin - A library designed to make it easy to work with the nanoSQL server using ExpressJS.