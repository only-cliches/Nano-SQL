const App = new Vue({
    template: `<p>Random String: {{ message }}</p>`,
    data: {
        message: 'Loading',
    },
    methods: {
        updateMessage: function(event) {
            nSQL("message").query("select").exec().then((rows) => {
                if (!rows.length) return;
                this.message = rows[0].message;
            });
        }
    },
    created: function() {
        nSQL("message").on("change", this.updateMessage);
    },
    destroyed: function() {
        nSQL("message").off("change", this.updateMessage);
    }
});

const randomString = () => {
    return Math.round(Math.random() * 10000).toString(16);
}

nSQL("message")
.model([
    { key: "id", type: "int", props: ["pk", "ai"] },
    { key: "message", type: "string" }
])
.connect().then(() => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    App.$mount(div);

    setInterval(() => {
        nSQL("message").query("upsert", { id: 1, message: randomString() }).exec();
    }, 500);
    
});