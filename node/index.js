"use strict";
var db_index_1 = require("./db-index");
var lie_ts_1 = require("lie-ts");
exports._assign = function (obj) {
    return JSON.parse(JSON.stringify(obj));
};
/**
 * The primary abstraction class, there is no database implimintation code here.
 * Just events, quries and filters.
 *
 * @export
 * @class NanoSQLInstance
 */
var NanoSQLInstance = (function () {
    function NanoSQLInstance() {
        var t = this;
        t._actions = {};
        t._views = {};
        t._models = {};
        t._query = [];
        t._preConnectExtend = [];
        t._events = ["change", "delete", "upsert", "drop", "select", "error"];
        t._callbacks = {};
        t._hasEvents = {};
        t._callbacks["*"] = {};
        var i = t._events.length;
        while (i--) {
            t._callbacks["*"][t._events[i]] = [];
        }
        t._functions = {};
        t._rowFilters = {};
    }
    /**
     * Changes the table pointer to a new table.
     *
     * @param {string} [table]
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.table = function (table) {
        if (table)
            this._selectedTable = table, this.activeTable = table;
        return this;
    };
    /**
     * Inits the backend database for use.
     *
     * Optionally include a custom database driver, otherwise the built in memory driver will be used.
     *
     * @param {NanoSQLBackend} [backend]
     * @returns {(Promise<Object | string>)}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.connect = function (backend) {
        var _this = this;
        var t = this;
        if (t.backend) {
            return new lie_ts_1.Promise(function (res, rej) {
                rej();
                throw Error();
            });
        }
        t.backend = backend || new db_index_1._NanoSQLDB();
        return new lie_ts_1.Promise(function (res, rej) {
            t.backend._connect({
                _models: t._models,
                _actions: t._actions,
                _views: t._views,
                _functions: t._functions,
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
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.on = function (actions, callBack) {
        var t = this;
        var l = t._selectedTable;
        var i = 0;
        var a = actions.split(" ");
        if (!t._callbacks[l]) {
            t._callbacks[l] = {};
            t._callbacks[l]["*"] = [];
            while (i--) {
                t._callbacks[l][t._events[i]] = [];
            }
        }
        i = a.length;
        while (i--) {
            if (t._events.indexOf(a[i]) !== -1) {
                t._callbacks[l][a[i]].push(callBack);
            }
        }
        t._refreshEventChecker();
        return t;
    };
    /**
     * Remove a specific event handler from being triggered anymore.
     *
     * @param {Function} callBack
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.off = function (callBack) {
        var t = this;
        for (var key in t._callbacks) {
            for (var key2 in t._callbacks[key]) {
                t._callbacks[key][key2] = t._callbacks[key][key2].filter(function (cBs) {
                    return cBs !== callBack;
                });
            }
        }
        t._refreshEventChecker();
        return t;
    };
    NanoSQLInstance.prototype._refreshEventChecker = function () {
        var _this = this;
        this._hasEvents = {};
        Object.keys(this._models).concat(["*"]).forEach(function (table) {
            _this._hasEvents[table] = _this._events.reduce(function (prev, cur) {
                return prev + (_this._callbacks[table] ? _this._callbacks[table][cur].length : 0);
            }, 0) > 0;
        });
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
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.model = function (dataModel) {
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
     *          // NanoSQL will not let any other arguments into this function.
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
     * NanoSQL("users").getView("view-name",{array:'',of:"",arguments:""}).then(function(result) {
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
     * NanoSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
     *
     * @param {Array<ActionOrView>} viewArray
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.views = function (viewArray) {
        return this._views[this._selectedTable] = viewArray, this;
    };
    /**
     * Execute a specific view.  Refernece the "views" function for more description.
     *
     * Example:
     * ```ts
     * NanoSQL("users").getView('view-name',{foo:"bar"}).then(function(result) {
     *  console.log(result) <== view result.
     * })
     * ```
     *
     * @param {string} viewName
     * @param {any} viewArgs
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.getView = function (viewName, viewArgs) {
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
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype._cleanArgs = function (argDeclarations, args) {
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
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype._cast = function (type, val) {
        var t = typeof val;
        var types = {
            "string": t !== "string" ? String(val || "") : val,
            "int": t !== "number" || val % 1 !== 0 ? parseInt(val || 0) : val,
            "float": t !== "number" ? parseFloat(val || 0) : val,
            "array": Array.isArray(val) ? exports._assign(val || []) : [],
            "map": t === "object" ? exports._assign(val || {}) : {},
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
     *          // NanoSQL will not let any other arguments into this function.
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
     * NanoSQL("users").doAction("action-name",{array:'',of:"",arguments:""}).then(function(result) {
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
     * NanoSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
     *
     * @param {Array<ActionOrView>} actionArray
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.actions = function (actionArray) {
        return this._actions[this._selectedTable] = actionArray, this;
    };
    /**
     * Init an action for the current selected table. Reference the "actions" method for more info.
     *
     * Example:
     * ```ts
     * NanoSQL("users").doAction('action-name',{foo:"bar"}).then(function(result) {
     *      console.log(result) <== result of your action
     * });
     * ```
     *
     * @param {string} actionName
     * @param {any} actionArgs
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.doAction = function (actionName, actionArgs) {
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
     * Add a function to the usable list of functions for this database.  Must be called BEFORE connect().
     *
     * Functions can be used with any database on the attached store.
     *
     * Example:
     *
     * ```ts
     * NanoSQL().newFunction('ADD',{ // Function is called "ADD"
     *  type:"simple", // "aggregate" or "simple"
     *  call:function(row:DBRow, args: string[], ptr: number[], prev: any) {
     *      // arguments are passed in as an array in the args argument.
     *      // ptr is an array that lets you know the length and position of the current query.
     *      // ptr[0] is the current index, ptr[1] is the max index/length
     *      // prev is only used for aggregate functions, lets  you pass an argument into the next function call.
     *      let r = JSON.parse(JSON.stringify(row));
     *      r.ADD = args.reduce((a, b) => parseFloat(a) + parseFloat(b));
     *      return r;
     *  }
     * });
     * ```
     *
     * Then to use it in a query:
     * ```ts
     * NanoSQL("users").query("select",["name","ADD(balance, 2)"]).exec();
     * ```
     *
     * Make sure the calculated value is add to the row(s) with the `useKey` argument, otherwise `AS` arguments won't work.
     *
     * @param {string} filterName
     * @param {(rows: Array<Object>) => Array<Object>} filterFunction
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.newFunction = function (functionName, functionType, filterFunction) {
        return this._functions[functionName] = { type: functionType, call: filterFunction }, this;
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
     * .query("select",["count(*)"]) //Get the length of records in the database
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
     * It works exactly like select, except it removes data instead of selecting it.  The second argument is an array of columns to clear.  If no second argument is passed, the entire row is deleted.
     * If no where argument is passed, the entire table is dropped
     *
     * Examples:
     * ```ts
     * .query("delete",['balance']) //Clear the contents of the balance column on ALL rows.
     * .query("delete",['comments']).where(["accountType","=","spammer"]) // If a where statment is passed you'll only clear the columns of the rows selected by the where statement.
     * .query("delete").where(["balance","<",0]) // remove all rows with a balance less than zero
     * .query("delete") // Same as drop statement
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
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.query = function (action, args) {
        var _this = this;
        this._query = [];
        var a = action.toLowerCase();
        if (["select", "upsert", "delete", "drop", "show tables", "describe"].indexOf(a) !== -1) {
            var newArgs_1 = args || (a === "select" || a === "delete" ? [] : {});
            if (action === "upsert") {
                // Cast row types and remove columns that don't exist in the data model
                var inputArgs_1 = {};
                this._models[this._selectedTable].forEach(function (model) {
                    if (newArgs_1[model.key]) {
                        inputArgs_1[model.key] = _this._cast(model.type, newArgs_1[model.key]);
                    }
                });
                // Apply insert filters
                if (this._rowFilters[this._selectedTable]) {
                    inputArgs_1 = this._rowFilters[this._selectedTable](inputArgs_1);
                }
                newArgs_1 = inputArgs_1;
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
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.where = function (args) {
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
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.orderBy = function (args) {
        return this._addCmd("orderby", args);
    };
    /**
     * Group By command, typically used with an aggregate function.
     *
     * Example:
     *
     * ```ts
     * NanoSQL("users").query("select",["favoriteColor","count(*)"]).groupBy({"favoriteColor":"asc"}).exec();
     * ```
     *
     * This will provide a list of all favorite colors and how many each of them are in the db.
     *
     * @param {({[key: string]:"asc"|"desc"})} columns
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.groupBy = function (columns) {
        return this._addCmd("groupby", columns);
    };
    /**
     * Having statement, used to filter Group BY statements. Syntax is identical to where statements.
     *
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.having = function (args) {
        return this._addCmd("having", args);
    };
    /**
     * Join command.
     *
     * Example:
     *
     * ```ts
     *  NanoSQL("orders")
     *  .query("select", ["orders.id","orders.title","users.name"])
     *  .where(["orders.status","=","complete"])
     *  .orderBy({"orders.date":"asc"})
     *  .join({
     *      type:"inner",
     *      table:"users",
     *      where:["orders.customerID","=","user.id"]
     *  }).exec();
     *```
     * A few notes on the join command:
     * 1. You muse use dot notation with the table names in all "where", "select", "orderby", and "groupby" arguments.
     * 2. Possible join types are `inner`, `left`, `right`, and `outer`.
     * 3. The "table" argument lets you determine the data on the right side of the join.
     * 4. The "where" argument lets you set what conditions the tables are joined on.
     *
     *
     *
     * @param {JoinArgs} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.join = function (args) {
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
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.limit = function (args) {
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
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.offset = function (args) {
        return this._addCmd("offset", args);
    };
    /**
     * Used to add a command to the query
     *
     * @internal
     * @param {string} type
     * @param {(any)} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype._addCmd = function (type, args) {
        return this._query.push({ type: type, args: args }), this;
    };
    /**
     * Trigger a database event
     *
     * @param {DatabaseEvent} eventData
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.triggerEvent = function (eventData, triggerEvents) {
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
     * Returns a default object for the current table's data model, useful for forms.
     *
     * The optional argument lets you pass in an object to over write the data model's defaults as desired.
     *
     * Examples:
     *
     * ```ts
     * console.log(NanoSQL("users").default()) <= {username:"none", id:undefined, age: 0}
     * console.log(NanoSQL("users").default({username:"defalt"})) <= {username:"default", id:undefined, age: 0}
     * ```
     *
     * DO NOT use this inside upsert commands like `.query("upsert",NanoSQL("users").defalt({userObj}))..`.
     * The database defaults are already applied through the upsert path, you'll be doing double work.
     *
     * Only use this to pull default values into a form in your UI or similar situation.
     *
     * @param {*} [replaceObj]
     * @returns {{[key: string]: any}}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.default = function (replaceObj) {
        var newObj = {};
        var t = this;
        t._models[t._selectedTable].forEach(function (m) {
            newObj[m.key] = (replaceObj && replaceObj[m.key]) ? replaceObj[m.key] : m.default;
            if (!newObj[m.key]) {
                newObj[m.key] = t._cast(m.type, null); // Generate default value from type, eg int == 0
            }
        });
        return newObj;
    };
    /**
     * Start a database transaction, useful for importing large amounts of data.
     *
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.beginTransaction = function () {
        if (this.backend._transaction)
            return this.backend._transaction("start");
    };
    /**
     * End a database transaction.
     *
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.endTransaction = function () {
        if (this.backend._transaction)
            return this.backend._transaction("end");
    };
    /**
     * Adds a query filter to every request.
     *
     * @param {(args: DBExec, complete:(args: DBExec) => void) => void} callBack
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.queryFilter = function (callBack) {
        this._queryMod = callBack;
    };
    /**
     * Executes the current pending query to the db engine, returns a promise with the rows as objects in an array.
     * The second argument of the promise is always the NanoSQL variable, allowing you to chain commands.
     *
     * Example:
     * NanoSQL("users").query("select").exec().then(function(rows, db) {
     *     console.log(rows) // <= [{id:1,username:"Scott",password:"1234"},{id:2,username:"Jeb",password:"1234"}]
     *     return db.query("upsert",{password:"something more secure"}).where(["id","=",1]).exec();
     * }).then(function(rows, db) {
     *  ...
     * })...
     *
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.exec = function () {
        var t = this;
        var _t = t._selectedTable;
        if (t._hasEvents[_t]) {
            t._triggerEvents = t._query.map(function (q) {
                switch (q.type) {
                    case "select": return [q.type];
                    case "delete":
                    case "upsert":
                    case "drop": return [q.type, "change"];
                    default: return [];
                }
            }).reduce(function (a, b) { return a.concat(b); });
        }
        return new lie_ts_1.Promise(function (res, rej) {
            if (!t.backend) {
                rej();
                throw Error;
            }
            var _tEvent = function (data, callBack, type, changedRows, isError) {
                if (t._hasEvents[_t]) {
                    t.triggerEvent({
                        name: "error",
                        actionOrView: "",
                        table: _t,
                        query: t._query,
                        time: new Date().getTime(),
                        result: data,
                        changeType: type,
                        changedRows: changedRows
                    }, t._triggerEvents);
                }
                callBack(data, t);
            };
            var execArgs = {
                table: _t,
                query: t._query,
                viewOrAction: t._activeActionOrView || "",
                onSuccess: function (rows, type, affectedRows) {
                    _tEvent(rows, res, type, affectedRows, false);
                },
                onFail: function (err) {
                    t._triggerEvents = ["error"];
                    if (rej)
                        _tEvent(err, rej, "error", [], true);
                }
            };
            if (t._queryMod) {
                t._queryMod(execArgs, function (newArgs) {
                    t.backend._exec(newArgs);
                });
            }
            else {
                t.backend._exec(execArgs);
            }
        });
    };
    /**
     * Configure the database driver, must be called before the connect() method.
     *
     * @param {any} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.config = function (args) {
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
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.extend = function () {
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
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.loadJS = function (rows) {
        var t = this;
        t.beginTransaction();
        return new lie_ts_1.Promise(function (res, rej) {
            var pointer = 0;
            var rowData = [];
            var next = function () {
                if (pointer < rows.length) {
                    if (rows[pointer]) {
                        t.table(t._selectedTable).query("upsert", rows[pointer]).exec().then(function (res) {
                            rowData.push(res);
                            pointer++;
                            next();
                        });
                    }
                    else {
                        pointer++;
                        next();
                    }
                }
                else {
                    t.endTransaction();
                    res(rowData, t);
                }
            };
            next();
        });
    };
    /**
     * Adds a filter to rows going into the database, allows you to control the range and type of inputs.
     *
     * This function will be called on every upsert and you'll recieve the upsert data as it's being passed in.
     *
     * NanoSQL will apply the "default" row data to each column and type cast each column BEFORE calling this function.
     *
     * @param {(row: object) => object} callBack
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.rowFilter = function (callBack) {
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
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.loadCSV = function (csv) {
        var t = this;
        var fields = [];
        t.beginTransaction();
        return new lie_ts_1.Promise(function (res, rej) {
            lie_ts_1.Promise.all(csv.split("\n").map(function (v, k) {
                return new lie_ts_1.Promise(function (resolve, reject) {
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
                t.endTransaction();
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
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.uuid = function () {
        var r, s, buf;
        var random16Bits = function () {
            if (typeof crypto === "undefined") {
                return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
            }
            else {
                if (crypto.getRandomValues) {
                    buf = new Uint16Array(1);
                    crypto.getRandomValues(buf);
                    return buf[0];
                }
                else if (crypto["randomBytes"]) {
                    return crypto["randomBytes"](2).reduce(function (prev, cur) { return cur * prev; });
                }
                else {
                    return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
                }
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
     * @memberOf _NanoSQLDB
     */
    NanoSQLInstance._hash = function (key) {
        return Math.abs(key.split("").reduce(function (prev, next, i) {
            return ((prev << 5) + prev) + key.charCodeAt(i);
        }, 0));
    };
    /**
     * Export the current query to a CSV file, use in place of "exec()";
     *
     * Example:
     * NanoSQL("users").query("select").toCSV(true).then(function(csv, db) {
     *   console.log(csv);
     *   // Returns something like:
     *   id,name,pass,postIDs
     *   1,"scott","1234","[1,2,3,4]"
     *   2,"jeb","5678","[5,6,7,8]"
     * });
     *
     * @param {boolean} [headers]
     * @returns {Promise<string>}
     *
     * @memberOf NanoSQLInstance
     */
    NanoSQLInstance.prototype.toCSV = function (headers) {
        var t = this;
        return new lie_ts_1.Promise(function (res, rej) {
            t.exec().then(function (json) {
                var header = t._query.filter(function (q) {
                    return q.type === "select";
                }).map(function (q) {
                    return q.args.length ? q.args.map(function (m) {
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
                            default: return row[column["key"]];
                        }
                    }).join(",");
                }).join("\n"), t);
            });
        });
    };
    return NanoSQLInstance;
}());
exports.NanoSQLInstance = NanoSQLInstance;
/**
 * @internal
 */
var _NanoSQLStatic = new NanoSQLInstance();
exports.nSQL = function (setTablePointer) {
    return _NanoSQLStatic.table(setTablePointer);
};
