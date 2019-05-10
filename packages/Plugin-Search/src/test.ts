import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { SyncStorage } from "@nano-sql/core/lib/adapters/syncStorage";
import { InanoSQLAdapter, InanoSQLPlugin, adapterConnectFilter, InanoSQLQuery, adapterCreateIndexFilter, adapterDeleteIndexFilter, adapterAddIndexValueFilter, adapterDeleteIndexValueFilter, adapterReadIndexKeyFilter, adapterReadIndexKeysFilter } from "@nano-sql/core/lib/interfaces";
import { noop } from "@nano-sql/core/lib/utilities";

