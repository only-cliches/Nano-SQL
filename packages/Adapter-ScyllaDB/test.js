const cassandra = require('cassandra-driver');
const client = new cassandra.Client({
    contactPoints: ['127.0.0.1:9042'],
    localDataCenter: 'datacenter1',
});

const query = `CREATE KEYSPACE IF NOT EXISTS k1 WITH REPLICATION = { 
    'class' : 'SimpleStrategy', 
    'replication_factor' : 1 
   };`;
client.execute(query, [])
    .then(() => {
        return client.execute(`USE k1;`);
    }).then(() => {
        return client.execute(`CREATE TABLE IF NOT EXISTS test2 (
            id int,
            data decimal,
            PRIMARY KEY (id)
        ) WITH CLUSTERING ORDER BY (id ASC);`, []);
    }).then(() => {
        let rows = [];
        for (let i = 0; i < 10; i ++) {
            rows.push({id: i, data: Math.random()})
        }
        return Promise.all(rows.map(r => client.execute(`INSERT INTO k1.test2 (id, data) VALUES (?, ?);`, [r.id, r.data], {prepare: true, consistency: 0})))
    }).then(() => {
        return client.execute(`SELECT * FROM k1.test2;`, [])
    }).then((rows) => {
        console.log(rows);
    }).catch((err) => {
        console.log(err);
    })