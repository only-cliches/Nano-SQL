import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION } from "@nano-sql/core/lib/interfaces";
import { generateID, setFast, deepSet } from "@nano-sql/core/lib/utilities";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
import {Client, Pool, PoolConfig} from "pg";
import {InanoSQLTableColumn} from "../../Core/src/interfaces";

const columnTypemap = {
    safestr:  'text',
    int:      'int',
    number:   'numeric',
    float:    'double precision',
    array:    'jsonb',
    date:     'date',
    uuid:     'uuid',
    timeId:   'varchar(20)',
    timeIdms: 'varchar(20)',
    string:   'text',
    object:   'jsonb',
    obj:      'jsonb',
    map:      'jsonb',
    boolean:  'boolean',
    bool:     'boolean',
    'string[]':   'text[]',
    'int[]':      'int[]',
    'number[]':   'number[]',
    'safestr[]':  'text[]',
    'boolean[]':   'boolean[]',
    'bool[]':      'boolean[]'
}

const makeDefault = {
    safestr:  (v : any) => `'${v}'::text`,
    int:      (v : any) => Math.round(v).toString(),
    number:   (v : any) => v.toString(),
    float:    (v : any) => v.toString(),
    array:    (v : any) => `'${JSON.stringify(v)}'::jsonb`,
    date:     (v : any) => `'${v}'::date`,
    uuid:     (v : any) => `'${v}'::uuid`,
    timeId:   (v : any) => `'${v}'::varchar(20)`,
    timeIdms: (v : any) => `'${v}'::varchar(20)`,
    string:   (v : any) => `'${v}'::text`,
    object:   (v : any) => `'${v}'::jsonb`,
    obj:      (v : any) => `'${v}'::jsonb`,
    map:      (v : any) => `'${v}'::jsonb`,
    boolean:  (v : any) => v.toString(),
    bool:     (v : any) => v.toString(),
    'string[]': (v: any) => `{${v}}::text[]`,
    'int[]':     (v: any) => `{${v}}::int[]`,
    'number[]':  (v: any) => `{${v}}::number[]`,
    'safestr[]': (v: any) => `{${v}}::text[]`,
    'boolean[]': (v: any) => `{${v}}::boolean[]`,
    'bool[]':    (v: any) => `{${v}}::boolean[]`
}


const columnDefaults = {
    int:    (tableName: string, key: string) => `nextval('${tableName}_${key}_seq')`,
    number: (tableName: string, key: string) => `nextval('${tableName}_${key}_seq')`,
    float:  (tableName: string, key: string) => `nextval('${tableName}_${key}_seq')`,
    uuid:   (_, __) => 'public.uuid_generate_v4()',
    timeId:   (_, __) => `(EXTRACT(EPOCH FROM now())::int)::text     || '-0' ||  encode(public.gen_random_bytes(2), 'hex'::text)`,
    timeIdms: (_, __) => `(EXTRACT(EPOCH FROM now()) * 1000)::bigint || '-0' ||  encode(public.gen_random_bytes(2), 'hex'::text)`
}

function pickColumn(val: InanoSQLTableColumn[], key?: string, ...keys: string[]) : InanoSQLTableColumn|undefined {
    if (!key)
        return undefined;
    const f = val.find((c) => c.key == key);

    if (keys.length == 0)
        return f;

    return f && f.model && pickColumn(f.model, keys[0], ...keys.slice(1));
};

export class PostgreSQL extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "PostgreSQL Adapter",
        version: 2.04
    };

    nSQL: InanoSQLInstance;

    private _id: string;
    private _db: Pool;
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    constructor(public poolConfig: PoolConfig & {schema?: string}) {
        super(false, false);
        if (!poolConfig.schema)
            poolConfig.schema = 'nanosql';
        this._tableConfigs = {};


    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        const {schema, ...config} = this.poolConfig;
        this._db = new Pool(config);
        this._db.query(            // language=sql
`set search_path to public;
                create extension if not exists "uuid-ossp";
                create extension if not exists "pgcrypto";
                create schema if not exists ${schema}; 
                set search_path to ${schema};`).then((conn) => {
            complete();
        }, error);
    }

    private _chkTable(table: string): string {
        if (Object.keys(this._tableConfigs).indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        } else {
            return this.poolConfig.schema + '.' + table;
        }
    }

    private _primaryKeyString(table: string) {
        return this._tableConfigs[table].pkCol.reduce((acc, val) => acc ? `(${acc}).${val}` : val, '');
    }

    private _primaryKeyType(table: string) : string {
        return this._tableConfigs[table].pkCol
            .reduce(({model} : {model}, val) => model!.find((a) => a.key == val)!, {model : this._tableConfigs[table].columns}).type;
    }

    private _compositeTypename(key: string, ...prefix: string[])
    {
        return `_${prefix.join('_nsql_')}_${key}_t`;
    }

    private _getTypename(col : InanoSQLTableColumn, ai: boolean, ...prefix : string[])
    {
        if (col.type)
            return columnTypemap[col.type];
        else if (col.model)
            return this._compositeTypename(col.key, ...prefix);
        else
            return 'jsonb';
    }

    private _makeCompositeType(col : InanoSQLTableColumn, ...prefix : string[]) : string
    {
        const compositeTypes = col.model ? col.model.filter((c) => !c.type && c.model).map((m) => this._makeCompositeType(m, ...prefix, m.key)).join('\n\n') : '';
        const typename = this._getTypename(col, false,...prefix);
        return compositeTypes +
            `DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typename}') THEN
        DROP TYPE ${typename} CASCADE;
    END IF;
    CREATE TYPE ${typename} as (${col.model!.map((m) => m.key + ' ' + this._getTypename(m, false,...prefix, m.key))});
END$$;`
            + ``;

    }

    private _makeColumnType(tableName: string, col: InanoSQLTableColumn, ai: boolean, pkKeys?: string[]) : string {

        const type : string = this._getTypename(col, ai, tableName);
        let default_ = '';

        if (pkKeys && pkKeys.length > 0 && (pkKeys[0] == col.key) && !col.default)
        {
            if (pkKeys.length == 1)
            {
                const def = columnDefaults[col.type];
                if (def)
                    default_ = 'default ' + def(tableName, col.key);
            }
            else if (col.model)
            {
                const tCol = pickColumn(col.model, ...pkKeys.slice(1));
                if (tCol)
                {

                    const innerDefault = columnDefaults[tCol!.type](tableName, pkKeys.join('_'));
                    /* now need to nest this value , e.g. ROW(null, default_value, null), but it can be nested further: ROW(null, ROW(null, default_value, null)) */

                    const makePkDefault = (col : InanoSQLTableColumn[], key?: string, ...keys: string[]) : string =>
                        `ROW(${col.map((c) => c.key == key 
                            ? ((keys && keys.length > 0) ? makePkDefault(c.model!, ...keys) : innerDefault)
                            : (c.default ? makeDefault[c.type](c.default) : 'null'))})`;

                    const def = makePkDefault(col.model, pkKeys[1], ...pkKeys.slice(2));

                    if (def)
                        default_ = 'default ' + def;
                }
            }
        }
        else if(col.default)
            default_ = col.default;

        const notNull  = col.notNull ? ' not null' : '';
        const pkKey    = (col.pk || col.key == (pkKeys && pkKeys[0])) ? ` primary key ` : "";

        let res = `${col.key} ${type} ${pkKey} ${notNull} ${default_}`;

        if (col.min)
            res += `, constraint min_${col.key} check (${col.key} >= ${col.min})`
        if (col.max)
            res += `, constraint min_${col.key} check (${col.key} <= ${col.max})`

        return res;
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {

        if (tableName in this._indices)
        {
            complete()
            return;
        }

        this._tableConfigs[tableName] = {...tableData};
        const qualifiedTableName = this._chkTable(tableName);

        const unique_index = tableData.pkCol && (tableData.pkCol.length > 0) && `
create unique index on ${qualifiedTableName}((${tableData.pkCol.reduce((acc, val) => acc ? `(${acc}).${val}` : val, '')}));` || '';


        const constraints = (tableData.pkCol && (tableData.pkCol.length > 0) ) ?
                            `, check(${tableData.pkCol.reduce((acc, val) => acc ? `(${acc}).${val}` : val, '')} is not null)`
                            : '';

        //check default values
        const pkCol = tableData.pkCol.length > 0 ? pickColumn(tableData.columns, ...tableData.pkCol) : undefined;
        const sequence = pkCol && (['int', 'number', 'float'].indexOf(pkCol.type) >= 0) && tableData.pkCol.join('_');

        const  pre_seq = sequence ? `CREATE SEQUENCE if not exists ${this.poolConfig.schema}.${tableName}_${sequence}_seq;` : '';
        const post_seq = sequence ? `ALTER  SEQUENCE ${this.poolConfig.schema}.${tableName}_${sequence}_seq OWNED BY ${tableName}.${tableData.pkCol[0]};` : '';

        const indices = Object.keys(tableData.indexes).map((key) => `CREATE INDEX ON ${qualifiedTableName}(${key});`).join('\n');

        const rows = tableData.columns.map((col) => this._makeColumnType(tableName, col, tableData.ai, tableData.pkCol));
        rows.push('__non_sql_data jsonb');
        const compositeTypes = tableData.columns.filter((c) => !c.type && c.model).map((m) => this._makeCompositeType(m, tableName)).join('\n\n');
        this._db.query(
            `set search_path to ${this.poolConfig.schema};` +
            pre_seq +
            ` ${compositeTypes}; 
            CREATE TABLE IF NOT EXISTS ${qualifiedTableName} (${rows.join()}  ${constraints});`
            + post_seq
            + unique_index + indices).then(complete, error);
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        if (table in this._indices)
        {
            complete()
            return;
        }

        this._db.query(`DROP TABLE ${this._chkTable(table)} cascade`).then((rows) =>
            //get all types
            this._db.query(` SELECT typname FROM pg_type WHERE typname like '_${table}_nsql'`).then((t) =>
            {
                const finish = () => {
                    delete this._tableConfigs[table];
                    complete();
                };
                if (t.rows.length > 0)
                    this._db.query(`drop type ${t.rows.map((r) => r.typname)} cascade;`).then(finish);
                else
                    finish();
            }), error);
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        this._db.end().then(complete, error);
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {
        const tableConfig = this._tableConfigs[table];

        const nonSqlKeys = Object.keys(row).filter((k) => tableConfig.columns.find((c) => c.key == k) == undefined);
        const nonSql = {};
        for (const k of nonSqlKeys)
        {
            nonSql[k] = row[k];
            delete row[k];
        }

        const keys = Object.keys(row)
        const values = keys.map((k) => row[k]);

        const nullUpdate = tableConfig.columns.filter((c) => !(c.key in row)).map((c) => c.key);

        if (nonSqlKeys.length > 0)
        {
            keys.push('__non_sql_data');
            values.push(nonSql);
        }
        else
            nullUpdate.push('__non_sql_data');

        const indices = keys.map((key, idx) => {
            const col = tableConfig.columns.find((c) => c.key == key);
            if (col && !col.type && col.model)
                return `json_populate_record(null::${this._compositeTypename(col.key, table)}, $${idx + 1})`;

            return `$${idx + 1}`;
        });

        const pick = (val: any, key?:string, ...keys: string[]) => key ? pick(val[key], ...keys) : val;

        if (tableConfig.pkCol.length == 0)
            this._db.query(`insert into ${this._chkTable(table)}(${keys}) values(${indices});`, values).then(
                (res) => complete(undefined)).catch(error);
        else
            this._db.query(`
    insert into ${this._chkTable(table)}(${keys}) values(${indices})
    on conflict on constraint ${table}_pkey do update set ${keys.map((k, i) => `${k}=${indices[i]}`).concat(nullUpdate.map((k) => `${k}=null`))} 
    returning ${this._primaryKeyString(table)} as ret;`, values).then(
                (res) => complete(res.rows[0].ret)).catch(error);
    }

    private _transformRow({__non_sql_data, ...rest})
    {
        let val : object;
        if (!__non_sql_data || (__non_sql_data == {}))
            val = {...rest};

        val =  {...__non_sql_data, ...rest};

        for (const key of Object.keys(val))
            if (val[key] === null)
                delete val[key];

        return val;
    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        const selection = this._tableConfigs[table].columns
            .map((col) => (!col.type || col.model) ? `row_to_json(${col.key}::${this._compositeTypename(col.key, table)}) as ${col.key}` : col.key).concat(['__non_sql_data']);

        this._db.query(`SELECT ${selection} FROM ${this._chkTable(table)} WHERE ${this._primaryKeyString(table)} = $1;`, [pk])
            .then((res) =>   complete(this._transformRow(res.rows[0])) , error);
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {

        const selection = this._tableConfigs[table].columns
            .map((col) => (!col.type || col.model) ? `row_to_json(${col.key}::${this._compositeTypename(col.key, table)}) as ${col.key}` : col.key).concat(['__non_sql_data']);
        let query = `SELECT ${selection} FROM ${this._chkTable(table)}`;

        const primKey = this._primaryKeyString(table);
        const cast = (['safestr', 'string'].indexOf(this._primaryKeyType(table)) == -1) ? '' : '::bytea';
        if (type === "range") {
            query += ` WHERE ${primKey}${cast} BETWEEN $1${cast} AND $2${cast}`;
        }


        if (reverse) {
            query += ` ORDER BY ${primKey}${cast} DESC`;
        } else {
            query += ` ORDER BY ${primKey}${cast}`;
        }

        if (type === "offset") {
            const lower = reverse ? offsetOrLow + 1 : offsetOrLow;
            const higher = limitOrHigh;
            query += ` LIMIT ${higher} OFFSET ${lower}`;
        }
        query += ';';
        this._db.query(query, type === "range" ? [offsetOrLow, limitOrHigh] : []).then((res) => { res.rows.map(this._transformRow).forEach(onRow); complete();}).catch(error);
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        this._db.query(`DELETE FROM ${this._chkTable(table)} 
                                       WHERE ${this._primaryKeyString(table)} = $1`, [pk]).then(complete, error);
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        const {pkCol} = this._tableConfigs[table];
        this._db.query(`SELECT ${this._primaryKeyString(table)} AS ret FROM ${this._chkTable(table)} ORDER BY ${this._primaryKeyString(table)}`).then(
            (res) => complete(res.rows.map(({ret}) => ret)), error);
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        this._db.query(`SELECT COUNT(*)::int as count FROM ${this._chkTable(table)}`)
            .then((res) =>  complete(res.rows[0].count), error);
    }

    private _json_to_composite(rowElement: any, col: InanoSQLTableColumn) {
        col.model!.map((m) => m.key)
    }

    private _indices : {[key: string]: [string, string, string]} = {};

    createIndex(table: string, indexName: string, type: string, complete: () => void, error: (err: any) => void)
    {
        this._db.query(`CREATE INDEX _idx_${table}_${indexName} ON ${this._chkTable(table)}(${indexName});`)
            .then(() =>
            {
                this._indices[`_idx_${table}_${indexName}`] = [table, indexName, type];
                complete();
            }, error);

    }

    deleteIndex(table: string, indexName: string, complete: () => void, error: (err: any) => void)
    {
        this._db.query(`DROP INDEX _idx_${table}_${indexName};`).
            then(() => {
                delete this._indices[`_idx_${table}_${indexName}`];
                complete();
            }, error);
    }

    // add a value to a secondary index
    addIndexValue(table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void)
    {
        complete();
    }

    // delete a value from a secondary index
    deleteIndexValue(table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void)
    {
        this._db.query(`DELETE FROM ${this._chkTable(table)} 
                                       WHERE  ${this._primaryKeyString(table)} =$1 and ${indexName} = $2`, [key, value]).then(complete, error);
    }

    // read a single index key
    readIndexKey(table: string, indexName: string, pk: any, onRowPK: (key: any) => void, complete: () => void, error: (err: any) => void)
    {
        this._db.query(`SELECT ${this._primaryKeyString(table)} as key FROM ${this._chkTable(table)} WHERE ${indexName} = $1;`, [pk])
            .then((res) => {
                res.rows.forEach(({key}) => onRowPK(key));
                complete();
            }, error);
    }

    // read a range of index keys
    readIndexKeys(table: string, indexName: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, value: any) => void, complete: () => void, error: (err: any) => void)
    {
        const [table_, name, idxType] = this._indices[`_idx_${table}_${indexName}`];

        let query = `SELECT ${this._primaryKeyString(table)} as key, ${indexName} as value FROM ${this._chkTable(table)}`;

        const cast = (['safestr', 'string'].indexOf(idxType) == -1) ? '' : '::bytea';

        if (type === "range") {
            query += ` WHERE ${indexName}${cast} BETWEEN $1${cast} AND $2${cast}`;
        }

        if (reverse) {
            query += ` ORDER BY ${indexName}${cast} DESC`;
        } else {
            query += ` ORDER BY ${indexName}${cast}`;
        }

        if (type === "offset") {
            const lower = reverse ? offsetOrLow + 1 : offsetOrLow;
            const higher = limitOrHigh;
            query += ` LIMIT ${higher} OFFSET ${lower}`;
        }
        query += ';';
        this._db.query(query, type === "range" ? [offsetOrLow, limitOrHigh] : []).then((res) => { res.rows.map(({key, value}) => onRowPK(key, value)); complete();}).catch(error);
    }

}
