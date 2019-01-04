import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION } from "@nano-sql/core/lib/interfaces";
import { _nanoSQLQueue, generateID, _maybeAssign, setFast } from "@nano-sql/core/lib/utilities";
import * as AWS from "aws-sdk";

export interface DynamoAdapterArgs {
    filterSchema?: (schema: AWS.DynamoDB.CreateTableInput) => AWS.DynamoDB.CreateTableInput,
    filterDrop?: (dropReq: AWS.DynamoDB.DeleteTableInput) => AWS.DynamoDB.DeleteTableInput,
    filterScan?: (scanReq: AWS.DynamoDB.DocumentClient.ScanInput) => AWS.DynamoDB.DocumentClient.ScanInput, 
    filterQuery?: (queryReq: AWS.DynamoDB.DocumentClient.QueryInput) => AWS.DynamoDB.DocumentClient.QueryInput,
    filterUpdate?: (updateReq: AWS.DynamoDB.DocumentClient.UpdateItemInput) => AWS.DynamoDB.DocumentClient.UpdateItemInput,
    filterDelete?: (deleteReq: AWS.DynamoDB.DocumentClient.DeleteItemInput) => AWS.DynamoDB.DocumentClient.DeleteItemInput,
    filterGet?: (getReq: AWS.DynamoDB.DocumentClient.GetItemInput) => AWS.DynamoDB.DocumentClient.GetItemInput
}

export interface DynamoAdapterConfig {
    filterSchema: (schema: AWS.DynamoDB.CreateTableInput) => AWS.DynamoDB.CreateTableInput,
    filterDrop: (dropReq: AWS.DynamoDB.DeleteTableInput) => AWS.DynamoDB.DeleteTableInput,
    filterScan: (scanReq: AWS.DynamoDB.DocumentClient.ScanInput) => AWS.DynamoDB.DocumentClient.ScanInput, 
    filterQuery: (queryReq: AWS.DynamoDB.DocumentClient.QueryInput) => AWS.DynamoDB.DocumentClient.QueryInput,
    filterUpdate: (updateReq: AWS.DynamoDB.DocumentClient.UpdateItemInput) => AWS.DynamoDB.DocumentClient.UpdateItemInput,
    filterDelete: (deleteReq: AWS.DynamoDB.DocumentClient.DeleteItemInput) => AWS.DynamoDB.DocumentClient.DeleteItemInput,
    filterGet: (getReq: AWS.DynamoDB.DocumentClient.GetItemInput) => AWS.DynamoDB.DocumentClient.GetItemInput
}

export const copy = (e) => e;

export class DynamoDB implements InanoSQLAdapter {

    plugin: InanoSQLPlugin = {
        name: "DynamoDB Adapter",
        version: 2.0
    };

    nSQL: InanoSQLInstance;

    private _id: string;
    private _db: AWS.DynamoDB;
    private _client: AWS.DynamoDB.DocumentClient;
    private config: DynamoAdapterConfig;

    constructor(args: DynamoAdapterArgs = {}) {  
        this.config = {
            filterDrop: copy,
            filterDelete: copy,
            filterSchema: copy,
            filterUpdate: copy,
            filterGet: copy,
            filterQuery: copy,
            filterScan: copy,
            ...args
        }
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        this._db = new AWS.DynamoDB();
        this._client = new AWS.DynamoDB.DocumentClient();
        this.createAndInitTable("_ai_store", {
            model: {},
            columns: [],
            indexes: {},
            pkOffset: 0,
            actions: [],
            views: [],
            pkType: "string",
            pkCol: "",
            isPkNum: false,
            ai: false
        }, complete, error);
    }

    table(tableName: string): string {
        return this._id + "." + tableName;
    }

    createAndInitTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {

        this._db.listTables().promise().then((tables) => {
            const exists = (tables.TableNames || []).filter(t => t === this.table(tableName)).length > 0;
            if (exists) { // table already exists
                complete();
                return;
            }
            const schema: AWS.DynamoDB.CreateTableInput = {
                TableName: this.table(tableName),
                KeySchema: [       
                    { AttributeName: "tname", KeyType: "HASH"},
                    { AttributeName: "id", KeyType: "RANGE" }
                ],
                AttributeDefinitions: [
                    { AttributeName: "tname", AttributeType: "S" },
                    { AttributeName: "id", AttributeType: tableData.isPkNum ? "N" : "S" },
                ],
                ProvisionedThroughput: {       
                    ReadCapacityUnits: 2, 
                    WriteCapacityUnits: 2
                }
            }
            this._db.createTable(this.config.filterSchema(schema), (err, data) => {
                if (err) {
                    error(err);
                    return;
                }
                if (!tableData.ai) {
                    complete();
                    return;
                }

                this._client.update(this.config.filterUpdate({
                    TableName: this.table("_ai_store"),
                    Key: {
                        "tname": tableName,
                        "id": tableName
                    },
                    UpdateExpression: "set #d = :val",
                    ExpressionAttributeNames: {
                        "#d": "data"
                    },
                    ExpressionAttributeValues: {
                        ":val": 0
                    }
                }), (err) => {
                    if (err) {
                        error(err);
                        return;
                    }
                    complete();
                });
            })
        });
    }

    disconnectTable(table: string, complete: () => void, error: (err: any) => void) {
        complete();
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._db.deleteTable(this.config.filterDrop({TableName: this.table(table)}), (err) => {
            if (err) {
                error(err);
                return;
            }
            if (!this.nSQL.tables[table].ai) {
                complete();
                return;
            }

            this._client.delete(this.config.filterDelete({
                TableName: this.table("_ai_store"), 
                Key: {
                    "tname": table,
                    "id": table
                }
            }), (err) => {
                if (err) {
                    error(err);
                    return;
                }
                complete();
            });
        })
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        complete();
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {


        (() => {
            return new Promise((res, rej) => {
                if (this.nSQL.tables[table].ai) {
                    this._client.get(this.config.filterGet({
                        TableName: this.table("_ai_store"),
                        Key: {
                            "tname": table,
                            "id": table
                        }
                    }), (err, item) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        const ai = parseInt(item.Item ? item.Item["data"] : 0);
                        res(ai);
                    })
                } else {
                    res(0);
                }
            })
        })().then((ai: number) => {
            pk = pk || generateID(this.nSQL.tables[table].pkType, ai + 1);
            if (typeof pk === "undefined") {
                error(new Error("Can't add a row without a primary key!"));
                return;
            }

            row[this.nSQL.tables[table].pkCol] = pk;

            const updateRow = () => {
                this._client.update(this.config.filterUpdate({
                    TableName: this.table(table),
                    Key: {
                        "tname": table,
                        "id": pk
                    },
                    UpdateExpression: "set #d = :d",
                    ExpressionAttributeNames: {
                        "#d": "data"
                    },
                    ExpressionAttributeValues: {
                        ":d": JSON.stringify(row)
                    }
                }), (err) => {
                    if (err) {
                        error(err);
                        return;
                    }
                    complete(pk);
                });
            }

            if (this.nSQL.tables[table].ai && ai < pk) {
                // update ai counter
                this._client.update(this.config.filterUpdate({
                    TableName: this.table("_ai_store"),
                    Key: {
                        "tname": table,
                        "id": table
                    },
                    UpdateExpression: "set #d = #d + :val",
                    ExpressionAttributeNames: {
                        "#d": "data"
                    },
                    ExpressionAttributeValues: {
                        ":val": 1
                    }
                }), (err) => {
                    if (err) {
                        error(err);
                        return;
                    }
                    updateRow();
                });
            } else {
                updateRow();
            }
        });
        

    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {

        this._client.get(this.config.filterGet({
            TableName: this.table(table),
            Key: {
                "tname": table,
                "id": pk
            }
        }), (err, item) => {
            if (err) {
                error(err);
                return;
            }
            complete(item.Item ? JSON.parse(item.Item["data"]) : undefined)
        })
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {

        if (type === "offset" || type === "all") {
            let count = 0;
            let LastEvaluatedKey: AWS.DynamoDB.DocumentClient.Key;
            const low = offsetOrLow;
            const high = offsetOrLow + limitOrHigh;
            let cache: any[] = [];
            const done = () => {
                if (reverse) {
                    cache.forEach((row) => {
                        onRow(row[0], row[1]);
                    })
                    cache = [];
                    complete();
                } else {
                    complete();
                }
            }
            const read = () => {
                this._client.scan(this.config.filterScan({
                    TableName: this.table(table),
                    ExclusiveStartKey: LastEvaluatedKey
                }), (err, item) => {
                    if (err) {
                        error(err);
                        return;
                    }
                    if (!item.Items) {
                        done();
                        return;
                    }
                    (item.Items || []).forEach((item) => {
                        if (type === "offset") {
                            if (count >= low && count < high) {
                                if (reverse) {
                                    cache.unshift([item ? JSON.parse(item["data"]) : undefined, count])
                                } else {
                                    onRow(item ? JSON.parse(item["data"]) : undefined, count);
                                } 
                            }
                        } else {
                            if (reverse) {
                                cache.unshift([item ? JSON.parse(item["data"]) : undefined, count])
                            } else {
                                onRow(item ? JSON.parse(item["data"]) : undefined, count);
                            }
                        }
                        count++;
                    })
                    if (type === "offset") {
                        if (count < high && item.LastEvaluatedKey) {
                            LastEvaluatedKey = item.LastEvaluatedKey;
                            setFast(read);
                        } else {
                            done();
                        }
                    } else {
                        if (item.LastEvaluatedKey) {
                            LastEvaluatedKey = item.LastEvaluatedKey;
                            setFast(read);
                            return;
                        }
                        done();
                    }
                });
            }
            read();
        } else {
            let LastEvaluatedKey: AWS.DynamoDB.DocumentClient.Key;
            let count = 0;
            const read = () => {

                this._client.query(this.config.filterQuery({
                    TableName: this.table(table),
                    ScanIndexForward: !reverse,
                    KeyConditionExpression: "#table = :table AND #id BETWEEN :low AND :high",
                    ExpressionAttributeNames: {
                        "#table": "tname",
                        "#id": "id"
                    },
                    ExpressionAttributeValues: {
                        ":table": table,
                        ":low": offsetOrLow,
                        ":high": limitOrHigh,
                    },
                    ExclusiveStartKey: LastEvaluatedKey
                }), (err, item) => {
                    if (err) {
                        error(err);
                        return;
                    }
                    if (!item.Items) {
                        complete();
                        return;
                    }
                    (item.Items || []).forEach((item) => {
                        onRow(item ? JSON.parse(item["data"]) : undefined, count);
                        count++;
                    })
                    if (item.LastEvaluatedKey) {
                        LastEvaluatedKey = item.LastEvaluatedKey;
                        setFast(read);
                        return;
                    }
                    complete();
                });
            }
            read();
        }
    }


    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {

        this._client.delete(this.config.filterDelete({
            TableName: this.table(table), 
            Key: {
                "tname": table,
                "id": pk
            }
        }), (err) => {
            if (err) {
                error(err);
                return;
            }
            complete();
        });
    }

    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        let index: any[] = [];
        let LastEvaluatedKey: AWS.DynamoDB.DocumentClient.Key;
        const read = () => {
            this._client.scan(this.config.filterScan({
                TableName: this.table(table),
                ExclusiveStartKey: LastEvaluatedKey
            }), (err, item) => {
                if (err) {
                    error(err);
                    return;
                }
                (item.Items || []).forEach((item) => {
                    index.push(item["id"]);
                })
                if (item.LastEvaluatedKey) {
                    LastEvaluatedKey = item.LastEvaluatedKey;
                    setFast(read);
                    return;
                }
                complete(index);
            });
        }
        read();

    }

    getNumberOfRecords(table: string, complete: (length: number) => void, error: (err: any) => void) {
        let count: number = 0;
        let LastEvaluatedKey: AWS.DynamoDB.DocumentClient.Key;
        const read = () => {
            this._client.scan(this.config.filterScan({
                TableName: this.table(table),
                ExclusiveStartKey: LastEvaluatedKey
            }), (err, item) => {
                if (err) {
                    error(err);
                    return;
                }
                count += item.Count || 0;
                if (item.LastEvaluatedKey) {
                    LastEvaluatedKey = item.LastEvaluatedKey;
                    setFast(read);
                    return;
                }
                complete(count);
            });
        }
        read();
    }
}