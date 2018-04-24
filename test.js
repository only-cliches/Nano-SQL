const nSQL = require("./lib/index.js").nSQL;

nSQL('videos')
  .model([
    { key: 'id', type: 'int', props: ['pk', 'ai'] },
    { key: 'name', type: 'string' },
    { key: 'producerId', type: 'producers', props: ['ref=>videoIds[]'] }
  ]);
nSQL('producers')
  .model([
    { key: 'id', type: 'int', props: ['pk', 'ai'] },
    { key: 'name', type: 'string' },
    { key: 'videoIds', type: 'videos[]', props: ['ref=>producerId'] }
  ])
.connect().then(() => {
    return nSQL().loadJS("videos", [
        { id: 1, name: "test1", producerId: 1 },
        { id: 2, name: "test2", producerId: 1 },
        { id: 3, name: "test3", producerId: 2 }
    ])
}).then(() => {
    return nSQL().loadJS("producers", [
        { id: 1, name: "prod1", videoIds: [1, 2] },
        { id: 2, name: "prod2", videoIds: [3] }
    ])
}).then(() => {
    return nSQL("videos").query("select").orm(['producerId']).exec();
}).then((rows) => {
    console.log(rows);
})