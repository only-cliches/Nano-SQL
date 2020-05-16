
import {TableQueryResult, InanoSQLQuery, InanoSQLTable, InanoSQLDataModel, InanoSQLTableConfig, InanoSQLConfig, InanoSQLFKActions} from "@nano-sql/core/lib/interfaces";
import { hash, buildQuery } from "@nano-sql/core/lib/utilities";
import { nanoSQL, nSQL, InanoSQLInstance } from "@nano-sql/core";

import { ApolloServer, gql} from 'apollo-server';
import { DocumentNode } from 'graphql';
import { buildFederatedSchema } from "@apollo/federation";
import {
    InputValueDefinitionNode,
    FieldDefinitionNode,
    NonNullTypeNode,
    NamedTypeNode,
    ListTypeNode,
    ObjectTypeDefinitionNode,
    InputObjectTypeDefinitionNode,
    DirectiveNode,
    ObjectTypeExtensionNode, Location, NameNode, StringValueNode, EnumValueDefinitionNode, EnumTypeDefinitionNode
} from "graphql/language/ast";
import pluralize from "pluralize";


const inst = nSQL();

const db = inst.createDatabase({
    id: "test",
    tables: [
        {
            name: 'dummy',
            model: {
                "name:string": {pk: true},

            }
        },
        {
            indexes: {name: {foreignKey: {
                        target: 'dummy.name',
                        onDelete: InanoSQLFKActions.RESTRICT
                    }}},
            name: "user",
            model: {
                "id:uuid": {pk: true},
                "name:string": {},
                "age:int": {notNull: true},
                "meta:obj": {
                    model: {
                        "color:string": {}
                    }
                },
                "tags:string[]": {default: []}
            }
        }
    ],
});


const typemap = {
    safestr:  'String',
    int:      'Int',
    number:   'Float',
    float:    'Float',
    array:    '[JSON]',
    date:     'Date',
    uuid:     'UUID',
    timeId:   'TimeId',
    timeIdms: 'TimeId',
    string:   'String',
    object:   'JSON',
    obj:      'JSON',
    map:      'JSON',
    boolean:  'Boolean',
    bool:     'Boolean'
}

const types = gql`
"""A global object identifier. It is a base64 encoding of {"nsql.{tablename}" : {primaryKeyValue} }"""
scalar ID
"""A string that can be parsed as JSON. Represents dynamic data."""
scalar JSON
"""A string that can be parsed as UUID."""
scalar UUID
"""A string representing a Data"""
scalar Date

"A location in a connection that can be used for resuming pagination."
scalar Cursor

"An object with a globally unique \`ID\`."
interface Node {
    "A globally unique identifier. Can be used in various places throughout the system to identify this single value."
    nodeId: ID!
}

enum TimeUnit { """Seconds""" S, """Milliseconds""" MS}

"""A time id, that has a timestamp & seed value"""
type TimeId {
    value: String!
    time: Int!
    seed: Int!
    unit: TimeUnit!
}

"Information about pagination in a connection."
type PageInfo {
    "When paginating forwards, the cursor to continue."
    endCursor: Cursor
    "When paginating forwards, are there more items?"
    hasNextPage: Boolean!
    "When paginating backwards, are there more items?"
    hasPreviousPage: Boolean!
    "When paginating backwards, the cursor to continue."
    startCursor: Cursor
}

type Query implements Node {
    """The version of the used nanoSQL"""
    nanoSQLVersion: Int

    "Fetches an object given its globally unique \`ID\`."
    node(
        "The globally unique \`ID\`."
        nodeId: ID!
    ): Node
    "The root query type must be a \`Node\` to work well with Relay 1 mutations. This just resolves to \`query\`."
    nodeId: ID!
}`;

function camelize(str, capitalizeFirst = true) : string {
    return str
        .replace(/\s(.)/g, function($1) { return $1.toUpperCase(); })
        .replace(/\s/g, '')
        .replace(/^(.)/, function($1) { return capitalizeFirst ? $1.toUpperCase() : $1.toLowerCase(); });
}


function buildModelInput(md: {[key: string] : InanoSQLDataModel}, ...scope:string[]) : Array<InputObjectTypeDefinitionNode>
{
    const definitions = new Array<InputObjectTypeDefinitionNode>();

    const rootInput = {
        kind: "InputObjectTypeDefinition" as "InputObjectTypeDefinition",
        fields: new Array<InputValueDefinitionNode>(),
        name: {
            kind: "Name" as "Name", value: camelize(scope.join(' ')) + 'Input'}
    };

    for (const mdKey of Object.keys(md))
    {
        const typeDef = md[mdKey];
        const [key, typeShort] = mdKey.split(':');
        const [typeStripped, ...arrPar] = typeShort.split('[]');

        const inputType = typeDef.model ?  camelize(scope.concat([key, 'input']).join(' '))  : typemap[typeStripped];

        if (typeDef.model)
            definitions.push(...buildModelInput(typeDef.model, ...scope, key));

        const fDefInput : NamedTypeNode|ListTypeNode = {
            name: {kind: "Name", value: inputType},
            kind: "NamedType"
        };

        let typeNodeInput : NamedTypeNode|ListTypeNode|NonNullTypeNode =
            arrPar.reduce((type, val) : NamedTypeNode|ListTypeNode => ({
                kind: "ListType", type
            }), fDefInput);

        if (typeDef.notNull)
            typeNodeInput = { kind: 'NonNullType', type: typeNodeInput };

        rootInput.fields.push({
            type: typeNodeInput,
            name: {kind: "Name", value: key + 'Input'},
            kind: "InputValueDefinition"
        });
    }
    definitions.push(rootInput);
    return definitions;
}


function buildModel(table: boolean, apolloFederation: boolean, md: {[key: string] : InanoSQLDataModel}, ...scope:string[]) : Array<ObjectTypeDefinitionNode>
{
    const definitions = new Array<ObjectTypeDefinitionNode>();

    const root = {
        kind: "ObjectTypeDefinition" as "ObjectTypeDefinition",
        fields: new Array<FieldDefinitionNode>(),
        interfaces: new Array<NamedTypeNode>(),
        directives: new Array<DirectiveNode>(),
        name: {
            kind: "Name" as "Name", value: camelize(scope.join(' '))}
    };
    if (table) {

        root.interfaces.push({name: {kind: 'Name', value: 'Node'}, kind: 'NamedType'});
        root.fields.push({
            kind: 'FieldDefinition',
            description: {kind: "StringValue", value: "A globally unique identifier. Can be used in various places throughout the system to identify this single value."},
            name: {kind: 'Name', value: 'nodeId'},
            type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}}
        });

        if (apolloFederation)
            root.directives.push({
                arguments: [{kind: 'Argument', name: {kind: 'Name', value: 'fields'}, value: {kind: "Variable", name: {kind: 'Name', value: 'nodeId'}}}],
                kind: 'Directive', name: {kind: 'Name', value: 'key'}
            });
        {

        }
    }

    for (const mdKey of Object.keys(md))
    {
        const typeDef = md[mdKey];
        const [key, typeShort] = mdKey.split(':');
        const [typeStripped, ...arrPar] = typeShort.split('[]');

        const type = typeDef.model ?  camelize(scope.concat([key]).join(' '))  : typemap[typeStripped];

        if (typeDef.model)
            definitions.push(...buildModel(false, apolloFederation, typeDef.model, ...scope, key));

        const fDef : NamedTypeNode|ListTypeNode = {
            name: {kind: "Name", value: type},
            kind: "NamedType"
        };

        let typeNode : NamedTypeNode|ListTypeNode|NonNullTypeNode =
            arrPar.reduce((type, val) : NamedTypeNode|ListTypeNode => ({
                    kind: "ListType", type
                }), fDef);

        if (typeDef.notNull)
            typeNode = { kind: 'NonNullType', type: typeNode };

        root.fields.push({
            type: typeNode,
            name: {kind: "Name", value: key},
            kind: "FieldDefinition"
        });

    }
    definitions.push(root);
    return definitions;
}

function makePaginationTypes(tableTypeName: string, cfg: InanoSQLTableConfig)
{
    const pk = primaryKey(cfg);
    const modelKeys = Object.keys(cfg.model || {});
    const idxs =
            Object.keys(cfg.indexes || {}).map((key) => modelKeys.find((mk) => mk.startsWith(key + ':')))
                .filter((v) : v is string  => v != undefined).map((key) => key.split(':')).map(([key, type]) => ({key, type}));

    const typenames = pluralize(tableTypeName);


    const OrderByEnum : EnumTypeDefinitionNode = {
        kind: 'EnumTypeDefinition',
        description: {kind: 'StringValue', value: `Methods to use when ordering "${tableTypeName}".`},
        name: {kind: 'Name', value: camelize([typenames, 'order', 'by'].join(' '))},
        values:
            new Array<EnumValueDefinitionNode>().concat(
                ...[pk, ...idxs].map(({key, type}) : EnumValueDefinitionNode[] =>
                     [{
                         kind: 'EnumValueDefinition',
                         name: { kind: 'Name', value: [...key.toUpperCase().split('.'), 'ASC'].join('_') }
                      },
                      {
                         kind: 'EnumValueDefinition',
                         name: { kind: 'Name', value: [...key.toUpperCase().split('.'), 'DESC'].join('_') } }
                     ]))
    };

    const res : ObjectTypeDefinitionNode[] = [
        {
            name: {kind: 'Name', value: `${typenames}Connection`},
            kind: 'ObjectTypeDefinition',
            description: {kind: 'StringValue', value: `A connection to a list of "${tableTypeName}" values.`},
            fields: [
                {
                    name: {kind: 'Name', value: "edges"},
                    kind: 'FieldDefinition',
                    description: {kind: 'StringValue', value: `A list of edges which contains the "${tableTypeName}" and cursor to aid in pagination.`},
                    type: {kind: 'NonNullType', type: {kind: 'ListType', type: {kind:'NonNullType', type: {kind:'NamedType', name: {kind: 'Name', value: `${typenames}Edge`}}}}}
                },
                {
                    name: {kind: 'Name', value: "nodes"},
                    kind: 'FieldDefinition',
                    description: {kind: 'StringValue', value: `A list of  "${tableTypeName}" objects.`},
                    type: {kind: 'NonNullType', type: {kind: 'ListType', type: {kind:'NamedType', name: {kind: 'Name', value: `${tableTypeName}`}}}}
                },
                {
                    name: {kind: 'Name', value: "pageInfo"},
                    kind: 'FieldDefinition',
                    description: {kind: 'StringValue', value: "Information to aid in pagination."},
                    type: {kind: 'NonNullType', type: {kind:'NamedType', name: {kind: 'Name', value: `PageInfo`}}}
                },
                {
                    name: {kind: 'Name', value: "totalCount"},
                    kind: 'FieldDefinition',
                    description: {kind: 'StringValue', value: `The count of *all* "${tableTypeName}" you could get from the connection.`},
                    type: {kind: 'NonNullType', type: {kind:'NamedType', name: {kind: 'Name', value: `Int`}}}
                }
            ]
        },
        {
            name: {kind: 'Name', value: `${typenames}Edge`},
            kind: 'ObjectTypeDefinition',
            description: {kind: 'StringValue', value: `A "${tableTypeName}" edge in the connection..`},
            fields: [
                {
                    name: {kind: 'Name', value: "cursor"},
                    kind: 'FieldDefinition',
                    description: {kind: 'StringValue', value: "A cursor for use in pagination."},
                    type: {kind:'NamedType', name: {kind: 'Name', value: `Cursor`}}
                },
                {
                    name: {kind: 'Name', value: "node"},
                    kind: 'FieldDefinition',
                    description: {kind: 'StringValue', value: `The "${tableTypeName}" at the end of the edge.`},
                    type: {kind:'NamedType', name: {kind: 'Name', value: `${tableTypeName}`}}
                }
            ]
        }];

     const condition : InputObjectTypeDefinitionNode = {
            name: {kind: 'Name', value: `${typenames}Condition`},
            kind: 'InputObjectTypeDefinition',
            description: {kind: 'StringValue', value: `A condition to be used against  "${tableTypeName}" object types. All fields are tested for equality and combined with a logical ‘and.’`},
            fields: new Array<InputValueDefinitionNode>().concat(
                [pk, ...idxs].map(({key, type}) : InputValueDefinitionNode =>
                    ({
                        kind: 'InputValueDefinition',
                        description: {kind: 'StringValue', value: `Checks for equality with the object’s "${key}" field`},
                        name: { kind: 'Name', value: camelize(key.split('.').join(' '), false) },
                        type: {kind:'NamedType', name: {kind: 'Name', value: `${typemap[type]}`}}
                    })))
        };

    return [OrderByEnum, ...res, condition];
}

function paginateArguments(typename: string, withCondition = false) : Array<InputValueDefinitionNode>
{
    const typenames = pluralize(typename);
    const res : InputValueDefinitionNode[] = [
        {
            name: {kind: 'Name', value: "after"},
            type: {kind:'NamedType', name: {kind: 'Name', value: "Cursor"}},
            kind: 'InputValueDefinition',
            description: {kind: 'StringValue', value: "Read all values in the set after (below) this cursor."}
        },
        {
            name: {kind: 'Name', value: "before"},
            type: {kind:'NamedType', name: {kind: 'Name', value: "Cursor"}},
            kind: 'InputValueDefinition',
            description: {kind: 'StringValue', value: "Read all values in the set before (above) this cursor."}
        },
        {
            name: {kind: 'Name', value: "first"},
            type: {kind:'NamedType', name: {kind: 'Name', value: "Int"}},
            kind: 'InputValueDefinition',
            description: {kind: 'StringValue', value: "Only read the first `n` values of the set."}
        },
        {
            name: {kind: 'Name', value: "last"},
            type: {kind:'NamedType', name: {kind: 'Name', value: "Int"}},
            kind: 'InputValueDefinition',
            description: {kind: 'StringValue', value: "Only read the last `n` values of the set."}
        },
        {
            name: {kind: 'Name', value: "offset"},
            type: {kind:'NamedType', name: {kind: 'Name', value: "Int"}},
            kind: 'InputValueDefinition',
            description: {kind: 'StringValue', value:  "Skip the first `n` values from our `after` cursor, an alternative to cursor based pagination. May not be used with `last`."}
        },
        {
            name: {kind: 'Name', value: "orderBy"},
            type: {kind: "ListType", type: {kind: "NonNullType", type: {kind: 'NamedType', name: {kind: 'Name', value: camelize([typenames, 'condition'].join(" "))}}}},
            kind: 'InputValueDefinition',
            description: {kind: 'StringValue', value:  `The method to use when ordering "${typenames}".`}
        }
    ];

    if (withCondition)
        res.push({
            name: {kind: 'Name', value: "condition"},
            type: {kind: 'NamedType', name: {kind: 'Name', value: camelize([typenames, 'condition'].join(" "))}},
            kind: 'InputValueDefinition',
            description: {kind: 'StringValue', value: "A condition to be used in determining which values should be returned by the collection."}
        });

    return res;
}

function primaryKey(cfg: InanoSQLTableConfig)
{
    let { primaryKey } = cfg;
    let primaryKeyType : string|null = null;

    if (primaryKey)
    {
        const f = Object.keys(cfg.model).find((k) => k.startsWith(primaryKey + ':'));
        if (f)
            primaryKeyType = f.split(':')[1];
    }

    if (!primaryKey && typeof cfg.model != "string")
    {
        const getPk = (mds : {[model: string]: InanoSQLDataModel}, ...scope: string[]) =>
        {
            for (const mdKey of Object.keys(mds))
            {
                const model = mds[mdKey];
                if (model.pk)
                    return scope.concat([mdKey]);
                if (model.model) {
                    const subPk = getPk(model.model, ...scope, mdKey);
                    if (subPk)
                        return subPk;
                }
            }
            return undefined;
        };
        const pk = getPk(cfg.model);
        primaryKey = camelize(pk.map((v) => v.split(':')[0]).join(' '), false);
        primaryKeyType = pk.pop().split(':').pop();
    }
    else if (!primaryKeyType)
        primaryKeyType = "JSON";

    return {key: primaryKey!, type: primaryKeyType!};
}

function buildQueries(tableTypeName: string, cfg: InanoSQLTableConfig) : Array<ObjectTypeDefinitionNode | ObjectTypeExtensionNode> {
    const definitions = new Array<ObjectTypeDefinitionNode|ObjectTypeExtensionNode>();


    const queryExt = {
        kind: 'ObjectTypeExtension' as 'ObjectTypeExtension',
        name: {kind: "Name" as "Name", value: 'Query'},
        interfaces: new Array<NamedTypeNode>(),
        directives: new Array<DirectiveNode>(),
        fields: new Array<FieldDefinitionNode>(),
    };
    const pk = primaryKey(cfg)


    if (pk.key)
        queryExt.fields.push({
            kind: "FieldDefinition",
            name: {kind: 'Name', value: cfg.name},
            type: {kind: "NamedType", name: {value: tableTypeName, kind: 'Name'}},
            description: { kind: 'StringValue', value:  `Read a single "${cfg.name}" by it's primary key "${pk.key}".`},
            arguments: [{
                directives: [],
                name: {kind: 'Name', value: pk.key},
                type: {kind: 'NonNullType',
                       type: {kind:'NamedType', name: {kind: 'Name', value: typemap[pk.type!]}}},
                kind: 'InputValueDefinition'
            }]
        });

    queryExt.fields.push({
        kind: "FieldDefinition",
        name: {kind: 'Name', value: pluralize(cfg.name)},
        type: {kind: "NamedType", name: {value: pluralize(tableTypeName) + 'Connection', kind: 'Name'}},
        description: { kind: 'StringValue', value:  `Reads and enables pagination through a set of "${cfg.name}".`},
        arguments: paginateArguments(cfg.name, true)
    });

    for (const idxName of Object.keys(cfg.indexes || {}))
    {
        const modelKeys = Object.keys(cfg.model || {});

        const idx = cfg.indexes![idxName];
        const f = modelKeys.find((mk) => mk.startsWith(idxName + ':'));
        if (!f)
            continue;

        const [key, type] = f.split(':');

        queryExt.fields.push({
            kind: "FieldDefinition",
            name: {kind: 'Name', value: camelize([pluralize(cfg.name), "by", key].join(' '), false)},
            type: {kind: "NamedType", name: {value: pluralize(tableTypeName) + 'Connection', kind: 'Name'}},
            description: { kind: 'StringValue', value:  `Reads and enables pagination through a set of "${cfg.name}" selected by ${key}.`},
            arguments:  [
                            {
                                name: {kind: 'Name', value: key},
                                type: {kind:'NamedType', name: {kind: 'Name', value: type}},
                                kind: 'InputValueDefinition'
                            }, ...paginateArguments(cfg.name, false)
                        ]
                    });

        if (idx.foreignKey)
        {
            const foreignTable = camelize(idx.foreignKey.target.split('.')[0]);
            definitions.push({
                kind: 'ObjectTypeExtension',
                name: {kind: "Name" , value: tableTypeName},
                fields: [{
                    kind: "FieldDefinition",
                    name: {kind: 'Name', value: camelize([idx.foreignKey.target.split('.')[0], "by", key].join(' '), false)},
                    type: {kind: "NamedType", name: {value: foreignTable, kind: 'Name'}},
                    arguments:  []
                }],
            });

            definitions.push({
                kind: 'ObjectTypeExtension',
                name: {kind: "Name" , value: foreignTable},
                fields: [{
                    kind: "FieldDefinition",
                    name: {kind: 'Name', value: camelize([pluralize(tableTypeName), "by",  key].join(' '), false)},
                    type: {kind: "NamedType", name: {value: pluralize(tableTypeName) + 'Connection', kind: 'Name'}},
                    arguments: paginateArguments(idx.foreignKey.target.split('.')[0], false)
                }],
            });
        }
    }

    definitions.push(queryExt);
    return definitions;
}

function buildSchemaTypes(dbConfig: InanoSQLConfig, config: {apolloFederation?: boolean} = {}) : DocumentNode {
    //@key(fields: "id")
    const definitions = [...types.definitions];
    const query = definitions.find((k) => k.kind == 'ObjectTypeDefinition' && k.name.value == "Query")!;


    for (const typeKey of Object.keys(dbConfig.types || {}))
    {
        const type = dbConfig.types![typeKey];
        if (type.model)
            definitions.push(...buildModel(false, false, type.model), ...buildModelInput(type.model));
    }

    for (const tableConfig of dbConfig.tables!)
    {
        //types
        let tableTypeName = typeof tableConfig.model == 'string' ? tableConfig.model : camelize(tableConfig.name);
        if (typeof tableConfig.model != 'string')
            definitions.push(
                ...buildModel(true, !!config.apolloFederation, tableConfig.model, tableConfig.name),
                ...buildModelInput(tableConfig.model, tableConfig.name));
        definitions.push(...makePaginationTypes(tableTypeName, tableConfig));
        definitions.push(...buildQueries(tableTypeName , tableConfig));
    }

    return {
        kind: 'Document',
        definitions
    }
}

db.then(() => buildSchemaTypes(inst.dbs.test.config)).then((typeDefs) => {

    const server = new ApolloServer({
        logger: console,
        debug: true,
        typeDefs
    });


    server.listen(4000).then(({ url }) => {
        console.log(`🚀 Server ready at ${url}`)
    });

}, console.error);

