"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var typescript_promise_1 = require("typescript-promise");
var immutable_store_1 = require("./immutable-store");
/**
 * The primary abstraction class, there is no database implimintation code here.
 * Just events, quries and filters.
 *
 * @export
 * @class SomeSQLInstance
 */
var SomeSQLInstance = (function () {
    function SomeSQLInstance() {
        var t = this;
        t._actions = {};
        t._views = {};
        t._models = {};
        t._query = [];
        t._preConnectExtend = [];
        t._events = ["change", "delete", "upsert", "drop", "select", "error"];
        t._callbacks = {};
        t._callbacks["*"] = {};
        var i = t._events.length;
        while (i--) {
            t._callbacks["*"][t._events[i]] = [];
        }
        t._filters = {};
        t._permanentFilters = [];
    }
    /**
     * Changes the table pointer to a new table.
     *
     * @param {string} [table]
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.table = function (table) {
        if (table)
            this._selectedTable = table, this.activeTable = table;
        return this;
    };
    /**
     * Inits the backend database for use.
     *
     * Optionally include a custom database driver, otherwise the built in memory driver will be used.
     *
     * @param {SomeSQLBackend} [backend]
     * @returns {(TSPromise<Object | string>)}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.connect = function (backend) {
        var _this = this;
        var t = this;
        t.backend = backend || new immutable_store_1._SomeSQLImmuDB();
        return new typescript_promise_1.TSPromise(function (res, rej) {
            t.backend._connect({
                _models: t._models,
                _actions: t._actions,
                _views: t._views,
                _filters: t._filters,
                _config: t._preConnectExtend,
                _parent: _this,
                _onSuccess: function (result) {
                    res(result, t);
                },
                _onFail: function (rejected) {
                    if (rej)
                        rej(rejected, t);
                }
            });
        });
    };
    /**
     * Adds an event listener to the selected database table.
     *
     * @param {("change"|"delete"|"upsert"|"drop"|"select"|"error")} actions
     * @param {Function} callBack
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.on = function (actions, callBack) {
        var t = this;
        var l = t._selectedTable;
        var i = 0;
        if (!t._callbacks[l]) {
            t._callbacks[l] = {};
            t._callbacks[l]["*"] = [];
            while (i--) {
                t._callbacks[l][t._events[i]] = [];
            }
        }
        var a = actions.split(" ");
        i = a.length;
        while (i--) {
            if (t._events.indexOf(a[i]) !== -1) {
                t._callbacks[l][a[i]].push(callBack);
            }
        }
        return t;
    };
    /**
     * Remove a specific event handler from being triggered anymore.
     *
     * @param {Function} callBack
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.off = function (callBack) {
        var t = this;
        for (var key in t._callbacks) {
            for (var key2 in t._callbacks[key]) {
                t._callbacks[key][key2] = t._callbacks[key][key2].filter(function (cBs) {
                    return cBs !== callBack;
                });
            }
        }
        return t;
    };
    /**
     * Set a filter to always be applied, on every single query.
     *
     * @param {string} filterName
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.alwaysApplyFilter = function (filterName) {
        if (this._permanentFilters.indexOf(filterName) === -1) {
            this._permanentFilters.push(filterName);
        }
        return this;
    };
    /**
     * Declare the data model for the current selected table.
     *
     * Please reference the DataModel interface for how to impliment this, a quick example:
     *
     * ```ts
     * .model([
     *  {key:"id",type:"int",props:["ai","pk"]} //auto incriment and primary key
     *  {key:"name",type:"string"}
     * ])
     * ```
     *
     * @param {Array<DataModel>} dataModel
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.model = function (dataModel) {
        var t = this;
        var l = t._selectedTable;
        var i = t._events.length;
        if (!t._callbacks[l]) {
            t._callbacks[l] = {};
            t._callbacks[l]["*"] = [];
            while (i--) {
                t._callbacks[l][t._events[i]] = [];
            }
        }
        t._models[l] = dataModel;
        t._views[l] = [];
        t._actions[l] = [];
        return t;
    };
    /**
     * Declare the views for the current selected table.  Must be called before connect()
     *
     * Views are created like this:
     *
     * ```ts
     * .views([
     *  {
     *      name:"view-name",
     *      args: ["array","of","arguments"],
     *      call: function(args) {
     *          // Because of our "args" array the args input of this function will look like this:
     *          // SomeSQL will not let any other arguments into this function.
     *          args:{
     *              array:'',
     *              of:'',
     *              arguments:''
     *          }
     *          //We can use them in our query
     *          return this.query('select').where(['name','IN',args.array]).exec();
     *      }
     *  }
     * ])
     * ```
     *
     * Then later in your app..
     *
     * ```ts
     * SomeSQL("users").getView("view-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     *
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     *
     * ```ts
     * .views[{
     *      name:...
     *      args:["name:string","balance:float","active:bool"]
     *      call:...
     * }]
     * ```
     *
     * SomeSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
     *
     * @param {Array<ActionOrView>} viewArray
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.views = function (viewArray) {
        return this._views[this._selectedTable] = viewArray, this;
    };
    /**
     * Execute a specific view.  Refernece the "views" function for more description.
     *
     * Example:
     * ```ts
     * SomeSQL("users").getView('view-name',{foo:"bar"}).then(function(result) {
     *  console.log(result) <== view result.
     * })
     * ```
     *
     * @param {string} viewName
     * @param {any} viewArgs
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.getView = function (viewName, viewArgs) {
        if (viewArgs === void 0) { viewArgs = {}; }
        var t = this;
        var l = t._selectedTable;
        var selView;
        var i = t._views[l].length;
        while (i--) {
            if (t._views[l][i].name === viewName) {
                selView = t._views[l][i];
            }
        }
        if (!selView)
            throw Error;
        t._activeActionOrView = viewName;
        return selView.call.apply(t, [t._cleanArgs(selView.args ? selView.args : [], viewArgs), t]);
    };
    /**
     * Take an action or view and it's args, then make sure the args comform to the types declared in the model.
     *
     * @internal
     * @param {Array<string>} argDeclarations
     * @param {Object} args
     * @returns {Object}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype._cleanArgs = function (argDeclarations, args) {
        var t = this;
        var l = t._selectedTable;
        var a = {};
        var i = argDeclarations.length ? argDeclarations.length : -1;
        if (i > 0) {
            while (i--) {
                var k2 = argDeclarations[i].split(":");
                if (k2.length > 1) {
                    a[k2[0]] = t._cast(k2[1], args[k2[0]] || null);
                }
                else {
                    a[k2[0]] = args[k2[0]] || null;
                }
            }
        }
        return a;
    };
    /**
     * Cast variables to a specific type.
     *
     * @internal
     * @param {string} type
     * @param {*} val
     * @returns {*}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype._cast = function (type, val) {
        var types = {
            "string": String(val),
            "int": parseInt(val),
            "float": parseFloat(val),
            "array": __assign({}, val),
            "map": __assign({}, val),
            "bool": val === true
        };
        return types[type] || val;
    };
    /**
     * Declare the actions for the current selected table.  Must be called before connect()
     *
     * Actions are created like this:
     * ```ts
     * .actions([
     *  {
     *      name:"action-name",
     *      args: ["array","of","arguments"],
     *      call: function(args) {
     *          // Because of our "args" array the args input of this function will look like this:
     *          // SomeSQL will not let any other arguments into this function.
     *          args:{
     *              array:'',
     *              of:'',
     *              arguments:''
     *          }
     *          //We can use them in our query
     *          return this.query("upsert",{balance:0}).where(['name','IN',args.array]).exec();
     *      }
     *  }
     * ])
     * ```
     *
     * Then later in your app..
     *
     * ```ts
     * SomeSQL("users").doAction("action-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     *
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     * ```ts
     * .actions[{
     *      name:...
     *      args:["name:string","balance:float","active:bool"]
     *      call:...
     * }]
     * ```
     *
     * SomeSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
     *
     * @param {Array<ActionOrView>} actionArray
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.actions = function (actionArray) {
        return this._actions[this._selectedTable] = actionArray, this;
    };
    /**
     * Init an action for the current selected table. Reference the "actions" method for more info.
     *
     * Example:
     * ```ts
     * SomeSQL("users").doAction('action-name',{foo:"bar"}).then(function(result) {
     *      console.log(result) <== result of your action
     * });
     * ```
     *
     * @param {string} actionName
     * @param {any} actionArgs
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.doAction = function (actionName, actionArgs) {
        if (actionArgs === void 0) { actionArgs = {}; }
        var t = this;
        var l = t._selectedTable;
        var selAction;
        var i = t._actions[l].length;
        while (i--) {
            if (t._actions[l][i].name === actionName) {
                selAction = t._actions[l][i];
            }
        }
        if (!selAction)
            throw Error;
        t._activeActionOrView = actionName;
        return selAction.call.apply(t, [t._cleanArgs(selAction.args ? selAction.args : [], actionArgs), t]);
    };
    /**
     * Add a filter to the usable list of filters for this database.  Must be called BEFORE connect().
     * Example:
     *
     * ```ts
     * SomeSQL().addFilter('addBalance',function(rows) {
     *      return rows.map((row) => row.balance + 1);
     * })
     * ```
     *
     * Then to use it in a query:
     * ```ts
     * SomeSQL("users").query("select").filter('addOne').exec();
     * ```
     *
     * @param {string} filterName
     * @param {(rows: Array<Object>) => Array<Object>} filterFunction
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.addFilter = function (filterName, filterFunction) {
        return this._filters[filterName] = filterFunction, this;
    };
    /**
     * Start a query into the current selected table.
     * Possibl querys are "select", "upsert", "delete", and "drop";
     *
     * ### Select
     *
     * Select is used to pull a set of rows or other data from the table.
     * When you use select the optional second argument of the query is an array of strings that allow you to show only specific columns.
     *
     * Examples:
     * ```ts
     * .query("select") // No arguments, select all columns
     * .query("select",['username']) // only get the username column
     * .query("select",["username","balance"]) //Get two columns, username and balance.
     * ```
     *
     * ### Upsert
     *
     * Upsert is used to add or modify data in the database.
     * If the primary key rows are null or undefined, the data will always be added in a new row. Otherwise, you might be updating existing rows.
     * The second argument of the query with upserts is always an Object of the data to upsert.
     *
     * Examples:
     * ```ts
     * .query("upsert",{id:1, username:"Scott"}) //If row ID 1 exists, set the username to scott, otherwise create a new row with this data.
     * .query("upsert",{username:"Scott"}) //Add a new row to the db with this username in the row.
     * .query("upsert",{balance:-35}).where(["balance","<",0]) // If you use a WHERE statement this data will be applied to the rows found with the where statement.
     * ```
     *
     * ### Delete
     *
     * Delete is used to remove data from the database.
     * It works exactly like select, except it removes data instead of selecting it.  The second argument is an array of columns to clear.  If no second argument is passed, the database is dropped.
     *
     * Examples:
     * ```ts
     * .query("delete",['balance']) //Clear the contents of the balance column on ALL rows.
     * .query("delete",['comments']).where(["accountType","=","spammer"]) // If a where statment is passed you'll only clear the columns of the rows selected by the where statement.
     * .query("delete") // same as drop statement
     * ```
     *
     * ### Drop
     *
     * Drop is used to completely clear the contents of a database.  There are no arguments.
     *
     * Drop Examples:
     * ```ts
     * .query("drop")
     * ```
     *
     * @param {("select"|"upsert"|"delete"|"drop")} action
     * @param {any} [args]
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.query = function (action, args) {
        var _this = this;
        this._query = [];
        var a = action.toLowerCase();
        if (["select", "upsert", "delete", "drop"].indexOf(a) !== -1) {
            var newArgs_1 = args || {};
            if (action === "upsert") {
                newArgs_1 = JSON.parse(JSON.stringify(args)); // Need to recursively break references, faster than looping through the whole thing recursively.
                // Apply default values & cast the rows
                this._models[this._selectedTable].forEach(function (model) {
                    if (model.default && !newArgs_1[model.key]) {
                        newArgs_1[model.key] = model.default;
                    }
                    else {
                        newArgs_1[model.key] = _this._cast(model.type, newArgs_1[model.key]);
                    }
                });
                // Apply insert filters
                if (this._rowFilters[this._selectedTable]) {
                    newArgs_1 = this._rowFilters[this._selectedTable](newArgs_1);
                }
            }
            this._query.push({ type: a, args: newArgs_1 });
        }
        else {
            throw Error;
        }
        return this;
    };
    /**
     * Used to select specific rows based on a set of conditions.
     * You can pass in a single array with a conditional statement or an array of arrays seperated by "and", "or" for compound selects.
     * A single where statement has the column name on the left, an operator in the middle, then a comparison on the right.
     *
     * Where Examples:
     *
     * ```ts
     * .where(['username','=','billy'])
     * .where(['balance','>',20])
     * .where(['catgory','IN',['jeans','shirts']])
     * .where([['name','=','scott'],'and',['balance','>',200]])
     * .where([['id','>',50],'or',['postIDs','IN',[12,20,30]],'and',['name','LIKE','Billy']])
     * ```
     *
     * @param {(Array<any|Array<any>>)} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.where = function (args) {
        return this._addCmd("where", args);
    };
    /**
     * Order the results by a given column or columns.
     *
     * Examples:
     *
     * ```ts
     * .orderBy({username:"asc"}) // order by username column, ascending
     * .orderBy({balance:"desc",lastName:"asc"}) // order by balance descending, then lastName ascending.
     * ```
     *
     * @param {Object} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.orderBy = function (args) {
        return this._addCmd("orderby", args);
    };
    /**
     * Join command.
     *
     * Example:
     *
     * ```ts
     *  SomeSQL("orders").query("select",["orders.id","orders.title","users.name"]).join({
     *      type:"inner",
     *      table:"users",
     *      where:["orders.customerID","=","user.id"]
     *  }).exec();
     *
     * A few notes on the join command:
     * 1. You muse use dot notation with the table names in all "where", "select", and "orderby" arguments.
     * 2. Possible join types are `inner`, `left`, and `right`.
     * 3. The "table" argument lets you determine the data on the right side of the join.
     * 4. The "where" argument lets you set what conditions the tables are joined on.
     *
     * ```
     *
     * @param {JoinArgs} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.join = function (args) {
        return this._addCmd("join", args);
    };
    /**
     * Limits the result to a specific amount.  Example:
     *
     * ```ts
     * .limit(20) // Limit to the first 20 results
     * ```
     *
     * @param {number} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.limit = function (args) {
        return this._addCmd("limit", args);
    };
    /**
     * Offsets the results by a specific amount from the beginning.  Example:
     *
     * ```ts
     * .offset(10) // Skip the first 10 results.
     * ```
     *
     * @param {number} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.offset = function (args) {
        return this._addCmd("offset", args);
    };
    /**
     * Adds a custom filter to the query.  The filter you use MUST be supported by the database driver OR a custom filter you provided before the connect method was called.
     * The built in memory DB supports sum, min, max, average, and count
     *
     * Example:
     * ```ts
     * //get number of rows
     * SomeSQL("users").query("select").filter("count"").exec().then(function(rows) {
     *  console.log(rows) // <= [{count:300}]
     * });
     * ```
     *
     * @param {string} name
     * @param {*} [args]
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.filter = function (name, args) {
        return this._addCmd("filter-" + name, args);
    };
    /**
     * Used to add a command to the query
     *
     * @internal
     * @param {string} type
     * @param {(any)} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype._addCmd = function (type, args) {
        return this._query.push({ type: type, args: args }), this;
    };
    /**
     * Trigger a database event
     *
     * @param {DatabaseEvent} eventData
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.triggerEvent = function (eventData, triggerEvents) {
        var t = this;
        setTimeout(function () {
            var i = triggerEvents.length;
            var j = 0;
            var e;
            var c;
            while (i--) {
                e = triggerEvents[i];
                c = t._callbacks[t._selectedTable][e].concat(t._callbacks[t._selectedTable]["*"]);
                j = c.length;
                while (j--) {
                    eventData.name = e;
                    eventData.actionOrView = t._activeActionOrView || "";
                    c[j](eventData, t);
                }
            }
            t._activeActionOrView = undefined;
        }, 0);
    };
    /**
     * Executes the current pending query to the db engine, returns a promise with the rows as objects in an array.
     * The second argument of the promise is always the SomeSQL variable, allowing you to chain commands.
     *
     * Example:
     * SomeSQL("users").query("select").exec().then(function(rows, db) {
     *     console.log(rows) // <= [{id:1,username:"Scott",password:"1234"},{id:2,username:"Jeb",password:"1234"}]
     *     return db.query("upsert",{password:"something more secure"}).where(["id","=",1]).exec();
     * }).then(function(rows, db) {
     *  ...
     * })...
     *
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.exec = function () {
        var t = this;
        var _t = t._selectedTable;
        t._triggerEvents = t._query.map(function (q) {
            switch (q.type) {
                case "select": return [q.type];
                case "delete":
                case "upsert":
                case "drop": return [q.type, "change"];
                default: return [];
            }
        }).reduce(function (a, b) { return a.concat(b); });
        return new typescript_promise_1.TSPromise(function (res, rej) {
            var _tEvent = function (data, callBack, isError) {
                if (t._permanentFilters.length && isError !== true) {
                    data = t._permanentFilters.reduce(function (prev, cur, i) {
                        return t._filters[t._permanentFilters[i]].apply(t, [data]);
                    }, data);
                }
                t.triggerEvent({
                    name: "error",
                    actionOrView: "",
                    table: _t,
                    query: t._query,
                    time: new Date().getTime(),
                    result: data
                }, t._triggerEvents);
                callBack(data, t);
            };
            t.backend._exec({
                _table: _t,
                _query: t._query,
                _viewOrAction: t._activeActionOrView || "",
                _onSuccess: function (rows) {
                    _tEvent(rows, res, false);
                },
                _onFail: function (err) {
                    t._triggerEvents = ["error"];
                    if (rej)
                        _tEvent(err, rej, true);
                }
            });
        });
    };
    /**
     * Configure the database driver, must be called before the connect() method.
     *
     * @param {any} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.config = function (args) {
        var t = this;
        if (!t.backend)
            t._preConnectExtend.push(args);
        return t;
    };
    /**
     * Perform a custom action supported by the database driver.
     *
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.extend = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var t = this;
        if (t.backend) {
            if (t.backend._extend) {
                args.unshift(t);
                return t.backend._extend.apply(t.backend, args);
            }
            else {
                return undefined;
            }
        }
    };
    /**
     * Load JSON directly into the DB.
     * JSON must be an array of maps, like this:
     * ```ts
     * [
     *  {"name":"billy","age":20},
     *  {"name":"johnny":"age":30}
     * ]
     * ```
     *
     * Rows must align with the data model.  Row data that isn't in the data model will be ignored.
     *
     * @param {Array<Object>} rows
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.loadJS = function (rows) {
        var t = this;
        return new typescript_promise_1.TSPromise(function (res, rej) {
            typescript_promise_1.TSPromise.chain(rows.map(function (row) {
                return t.table(t._selectedTable).query("upsert", row).exec();
            })).then(function (rowData) {
                res(rowData, t);
            });
        });
    };
    /**
     * Adds a filter to rows going into the database, allows you to control the range and type of inputs.
     *
     * This function will be called on every upsert and you'll recieve the upsert data as it's being passed in.
     *
     * SomeSQL will apply the "default" row data to each column and type cast each column BEFORE calling this function.
     *
     * @param {(row: object) => object} callBack
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.rowFilter = function (callBack) {
        return this._rowFilters[this._selectedTable] = callBack, this;
    };
    /**
     * Load a CSV file into the DB.  Headers must exist and will be used to identify what columns to attach the data to.
     *
     * This function performs a bunch of upserts, so expect appropriate behavior based on the primary key.
     *
     * Rows must align with the data model.  Row data that isn't in the data model will be ignored.
     *
     * @param {string} csv
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.loadCSV = function (csv) {
        var t = this;
        var fields = [];
        return new typescript_promise_1.TSPromise(function (res, rej) {
            typescript_promise_1.TSPromise.all(csv.split("\n").map(function (v, k) {
                return new typescript_promise_1.TSPromise(function (resolve, reject) {
                    if (k === 0) {
                        fields = v.split(",");
                        resolve();
                    }
                    else {
                        var record = {};
                        var row = v.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                        row = row.map(function (str) { return str.replace(/^"(.+(?="$))"$/, "$1"); });
                        var i = fields.length;
                        while (i--) {
                            if (row[i].indexOf("{") === 0 || row[i].indexOf("[") === 0) {
                                row[i] = JSON.parse(row[i].replace(/'/g, ""));
                            }
                            record[fields[i]] = row[i];
                        }
                        t.table(t._selectedTable).query("upsert", record).exec().then(function () {
                            resolve();
                        });
                    }
                });
            })).then(function () {
                res([], t);
            });
        });
    };
    /**
     * RFC4122 compliant UUID v4, 9 randomly generated 16 bit numbers.
     *
     * @static
     * @returns {string}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.uuid = function () {
        var r, s, buf;
        var random16Bits = function () {
            if (window && window.crypto.getRandomValues) {
                buf = new Uint16Array(1);
                window.crypto.getRandomValues(buf);
                return buf[0];
            }
            else {
                return Math.round(Math.random() * Math.pow(2, 16)); // Oh god, please no.
            }
        }, b = "";
        return [b, b, b, b, b, b, b, b, b].reduce(function (prev, cur, i) {
            r = random16Bits();
            s = (i === 4 ? i : (i === 5 ? (r % 16 & 0x3 | 0x8).toString(16) : b));
            r = r.toString(16);
            while (r.length < 4)
                r = "0" + r;
            return prev + ([3, 4, 5, 6].indexOf(i) >= 0 ? "-" : b) + (s + r).slice(0, 4);
        }, b);
    };
    ;
    /**
     * Utility function for generating numerical hashes from strings.
     *
     * @internal
     * @param {string} key
     * @returns {number}
     *
     * @memberOf _SomeSQLImmuDB
     */
    SomeSQLInstance._hash = function (key) {
        return Math.abs(key.split("").reduce(function (prev, next, i) {
            return (((prev << 5) + prev) + key.charCodeAt(i));
        }, 0));
    };
    /**
     * Export the current query to a CSV file, use in place of "exec()";
     *
     * Example:
     * SomeSQL("users").query("select").toCSV(true).then(function(csv, db) {
     *   console.log(csv);
     *   // Returns something like:
     *   id,name,pass,postIDs
     *   1,"scott","1234","[1,2,3,4]"
     *   2,"jeb","5678","[5,6,7,8]"
     * });
     *
     * @param {boolean} [headers]
     * @returns {TSPromise<string>}
     *
     * @memberOf SomeSQLInstance
     */
    SomeSQLInstance.prototype.toCSV = function (headers) {
        var t = this;
        return new typescript_promise_1.TSPromise(function (res, rej) {
            t.exec().then(function (json) {
                var header = t._query.filter(function (q) {
                    return q.type === "select";
                }).map(function (q) {
                    return q.args ? q.args.map(function (m) {
                        return t._models[t._selectedTable].filter(function (f) { return f["key"] === m; })[0];
                    }) : t._models[t._selectedTable];
                })[0];
                if (headers) {
                    json.unshift(header.map(function (h) {
                        return h["key"];
                    }));
                }
                res(json.map(function (row, i) {
                    if (headers && i === 0)
                        return row;
                    return header.filter(function (column) {
                        return row[column["key"]] ? true : false;
                    }).map(function (column) {
                        switch (column["type"]) {
                            case "map":
                            // tslint:disable-next-line
                            case "array": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
                            default: return JSON.stringify(row[column["key"]]);
                        }
                    }).join(",");
                }).join("\n"), t);
            });
        });
    };
    return SomeSQLInstance;
}());
exports.SomeSQLInstance = SomeSQLInstance;
/**
 * @internal
 */
var _someSQLStatic = new SomeSQLInstance();
function SomeSQL(setTablePointer) {
    return _someSQLStatic.table(setTablePointer);
}
exports.SomeSQL = SomeSQL;
