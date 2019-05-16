import { isSafari } from "./utilities";
import { SyncStorage } from "./adapters/syncStorage";
import { WebSQL } from "./adapters/webSQL";
import { IndexedDB } from "./adapters/indexedDB";
import { InanoSQLAdapter } from "./interfaces";

declare var global: any;

let SnapDB: any;
if (typeof global !== "undefined") {
    SnapDB = global._snapAdapter;
}

export const detectStorage = (): string => {

    // NodeJS
    if (typeof window === "undefined") {
        return "SNP";
    }

    // Browser

    // Safari / iOS always gets WebSQL (mobile and desktop)
    // newer versions of safari drop WebSQL, so also do feature detection
    if (isSafari && typeof window["openDatabase"] !== "undefined") {
        return "WSQL";
    }

    // everyone else (FF + Chrome + Edge + IE)
    // check for support for indexed db
    if (typeof indexedDB !== "undefined") { // use indexed DB if possible
        return "IDB";
    }

    // fall back to WebSQL
    if (typeof window["openDatabase"] !== "undefined") {
        return "WSQL";
    }

    // nothing else works, we gotta do local storage. :(
    return "LS";

}

export const resolveMode = (mode: string | InanoSQLAdapter, args?: {size?: number, version?: number, path?: string | ((dbID: string, tableName: string) => { lvld: any; args?: any; })}): InanoSQLAdapter => {
    
    if (typeof mode === "string") {
        if (mode === "PERM") {
            mode = detectStorage();
        }
        switch (mode) {
            case "TEMP":
                return new SyncStorage(false);
            case "LS":
                return new SyncStorage(true);
            case "WSQL":
                return new WebSQL(args && args.size);
            case "IDB":
                return new IndexedDB(args && args.version);
            case "RKS":
                throw new Error("RocksDB is no longer built in!  Grab it here https://www.npmjs.com/package/@nano-sql/adapter-rocksdb");
            case "LVL":
                throw new Error("LevelDB is no longer build in!  Grab it here https://www.npmjs.com/package/@nano-sql/adapter-leveldb");
            case "SNP":
                return new SnapDB();
            default:
                throw new Error(`Cannot find mode ${mode}!`);
        }
    } else {
        return mode;
    }
}