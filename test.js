var nSQL = require("./node/index.js").nSQL;

nSQL('users') //Table/Store Name
    .model([ //Data Model
        {
            key: 'id',
            type: 'int',
            props: ['pk', 'ai']
        }, {
            key: 'name',
            type: 'string',
            default: "none"
        }, {
            key: 'age',
            type: 'int',
            default: 0
        }, {
            key: 'balance',
            type: 'float',
            default: 0.0
        }, {
            key: 'postIDs',
            type: 'array'
        }, {
            key: 'meta',
            type: 'map',
            default: {}
        }
    ])
    .views([ //Cached views to show specific data
        {
            name: 'get_user_by_name',
            args: ['name:string'],
            call: function(args, db) {
                return db.query('select').where(['name', '=', args.name]).exec();
            }
        }, {
            name: 'list_all_users',
            args: ['page:int'],
            call: function(args, db) {
                return db.query('select', ['id', 'name']).exec();
            }
        }
    ])
    .actions([ //Cached actions to update specific data
        {
            name: 'add_new_user',
            args: ['user:map'],
            call: function(args, db) {
                return db.query('upsert', args.user).exec();
            }
        }, {
            name: 'login',
            args: ['username:string', 'password:string'],
            call: function(args, db) {
                return db.query('select', ['id']).where([
                    ['username', '=', args.username], 'and', ['password', '=', args.password]
                ]).exec();
            }
        }
    ])
nSQL("orders").model([{
        key: 'id',
        type: 'int',
        props: ['pk', 'ai']
    }, {
        key: 'title',
        type: 'string'
    }, {
        key: 'total',
        type: 'float'
    }, {
        key: 'userID',
        type: 'int'
    }])
    .config({ persistent: true, history: false, memory: false })
    .connect().then(() => {

        nSQL("orders").loadJS([{
            id: 1,
            title: "Test",
            total: 200,
            userID: 2
        }, {
            id: 2,
            title: "Test",
            total: 100,
            userID: 2
        }, {
            id: 3,
            title: "Test",
            total: 600,
            userID: 5
        }]).then(() => {
            nSQL('users').loadJS([{
                id: null,
                name: 'jeb',
                age: 28,
                balance: 25.02,
                postIDs: [0, 20, 5],
                meta: {
                    favorteColor: 'orange'
                }
            }, {
                id: null,
                name: 'bob',
                age: 25,
                balance: 25.02,
                postIDs: [0, 20, 5],
                meta: {
                    favorteColor: 'blue'
                }
            }, {
                id: null,
                name: 'jeb',
                age: 21,
                balance: 22.02,
                meta: {
                    favorteColor: 'yellow'
                }
            }, {
                id: null,
                name: 'scott',
                age: 21,
                balance: 25.02,
                postIDs: [0, 20, 5],
                meta: {
                    favorteColor: 'blue'
                }
            }]).then(function() {

                nSQL("users").query("select").exec()
                    .then(function(result, db) {
                        console.log("GROUP", result);
                        return db.query('upsert', {
                            balance: 50
                        }).where(['name', '=', 'jeb']).exec();
                    })
                    .then(function(result, db) {
                        console.log(result);
                        /*return db.query('select').orderBy({
                            name: 'desc'
                        }).where([
                            ['age', '>', 25], 'or', ['id', '>', 2]
                        ]).toCSV(true);*/
                        return db.query('delete').where(["age", ">", 21]).exec();
                    })
                    .then(function(result, db) {
                        console.log(result);
                        db.query('select').orderBy({
                            name: 'asc'
                        }).exec().then(function(result2) {
                            console.log('immuTest: ' + (result === result2));
                        });


                        return db.query('select').toCSV(true);
                    })
                    .then(function(result) {
                        console.log(result);
                        nSQL("orders")
                            .query("select", ["orders.userID", "MAX(orders.total) AS orderAVG", "COUNT(*)"])
                            .join({
                                type: "left",
                                table: "users",
                                where: ["orders.userID", "=", "users.id"]
                            })
                            .groupBy({
                                "orders.userID": "asc"
                            })
                            .orderBy({
                                "orders.id": "asc",
                                "users.age": "desc"
                            })
                            .exec().then(function(rows) {
                                console.log("JOIN", rows);
                            });
                    });
            });
        });
    });