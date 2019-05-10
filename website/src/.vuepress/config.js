module.exports = {
    title: 'nanoSQL 2',
    description: "Universal database layer for the client, server & mobile devices.  It's like Lego for databases.",
    ga: "UA-131910187-2",
    serviceWorker: true,
    head: [
        ["link", {rel: "manifest", href: "manifest.webmanifest"}],
        ["link", {rel: "apple-touch-icon", href: "apple-touch-icon.png"}]
    ],
    themeConfig: {
        logo: '/icon.png',
        algolia: {
            apiKey: '2a2f0fa3dc59a45eeb3bce071e93944e',
            indexName: 'nanosql'
        },
        nav: [
            {
                text: 'Home',
                link: '/'
            },
            {
                text: 'Github',
                link: 'https://github.com/ClickSimply/Nano-SQL'
            },
            {
                text: 'NPM',
                link: 'https://www.npmjs.com/package/@nano-sql/core'
            },
        ],
        sidebar: {
            "/query/": [
                ["../welcome", "← Back" ],
                ["", "Query" ],
                ["select", "Select" ],
                ["total", "Total" ],
                ["upsert", "Upsert" ],
                ["delete", "Delete" ],
                ["clone", "Clone" ],
                ["rebuild-index", "Rebuild Index" ],
                ["conform-rows", "Conform Rows" ],
                ["drop-table", "Drop Table" ],
                ["create-table", "Create Table" ],
                ["alter-table", "Alter Table" ],
                ["show-tables", "Show Tables" ],
                ["describe", "Describe" ],
                ["import-export", "Import & Export" ],
                ["events", "Events" ],
                ["query-function-api", "Query Function API" ]
            ],
            '/adapters/': [
                ["../welcome", "← Back" ],
                ["", "Adapters" ],
                ["built-in-adapters", "Build In Adapters" ],
                ["mysql", "MySQL / MariaDB" ],
                ["dynamodb", "DynamoDB" ],
                ["redis", "Redis" ],
                ["mongodb", "MongoDB" ],
                ["sqlite-nodejs", "SQLite (NodeJS)" ],
                ["sqlite-cordova", "SQLite (Cordova)" ],
                ["sqlite-nativescript", "SQLite (NativeScript)" ],
                ["react-native", "React Native" ],
                ["scylladb", "ScyllaDB / Cassandra" ],
                ["custom-adapter-api", "Custom Adapter API" ]
            ],
            '/plugins/': [
                ["../welcome", "← Back" ],
                ["", "Plugins" ],
                ["net-offline-syncing", "Net / Offline Syncing (WIP)" ],
                ["redis-index", "Redis Index" ],
                ["search", "Search" ],
                ["backups", "Backups (WIP)" ],
                ["encryption", "Encryption (WIP)" ],
                ["history", "History (WIP)" ],
                ["date", "Date (WIP)" ],
                ["map-reduce", "Map Reduce (WIP)" ],
                ["plugin-api", "Plugin API" ]
            ],
            '/other-query-langs/': [
                ["../welcome", "← Back" ],
                ["", "Other Query Languages" ],
                ["graphql", "GraphQL (WIP)" ],
                ["sqlite", "SQLite (WIP)" ],
                ["mongodb-ql", "MongoDB QL (WIP)" ],
                ["query-language-api", "Query Language API" ]
            ],
            '/': [
                ["/welcome", "Welcome" ],
                ["/cli", "CLI"],
                ["/setup", "Setup"],
                ["/databases", "Databases"],
                ["/query/", "Query →"],
                ["/adapters/", "Adapters →"],
                ["/plugins/", "Plugins →"],
                ["/other-query-langs/", "Other Query Languages →"],
                ["/performance", "Performance"],
                ["/migration", "Migration"],
                ["/utilities", "Utilities"],
                ["/changelog", "Changelog"],  
            ],
        },
        lastUpdated: 'Last Updated',
        // Assumes GitHub. Can also be a full GitLab url.
        repo: 'ClickSimply/Nano-SQL',
        repoLabel: false,
        // if your docs are not at the root of the repo:
        docsDir: 'website/src',
        docsBranch: '2.0',
        // defaults to false, set to true to enable
        editLinks: true,
        // custom text for edit link. Defaults to "Edit this page"
        editLinkText: 'Help us improve this page!'
    }
}