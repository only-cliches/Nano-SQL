
import { InanoSQLInstance, TableQueryResult, InanoSQLQuery } from "@nano-sql/core/lib/interfaces";
import { hash, buildQuery } from "@nano-sql/core/lib/utilities";
import { nanoSQL } from "@nano-sql/core";

import { ApolloServer, gql} from 'apollo-server';
import { buildFederatedSchema } from "@apollo/federation";

const server = new ApolloServer({
    logger: console,
    debug: true,
    schema: buildFederatedSchema([
        {
            typeDefs: gql`extend type Query {
                topProducts(first: Int = 5): [Product]
            }
            type Product @key(fields: "upc") {
                upc: String!
                name: String!
                price: Int
            }`,
            resolvers: {}
        }
    ])
});


server.listen(4000).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
});
