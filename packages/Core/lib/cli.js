#!/usr/bin/env node
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var chokadir = require("chokidar");
var path = require("path");
var fs = require("fs");
var chalk = require("chalk");
var cliArgs = require("command-line-args");
var luxon_1 = require("luxon");
var packageJSON = {};
try {
    packageJSON = fs.readFileSync(path.join(__dirname, "../package.json"), {});
    packageJSON = JSON.parse(packageJSON.toString("utf-8"));
}
catch (e) {
    throw new Error(e);
}
console.log(chalk.default.magenta("nanoSQL v" + packageJSON.version + " CLI"));
var _cwd = process.cwd();
var options = cliArgs([
    { name: "package", alias: "p", type: String },
    { name: "watch", alias: "w", type: Boolean },
    { name: "watchPolling", alias: "l", type: Number },
    { name: "files", alias: "f", type: String, multiple: true },
    { name: "outDir", alias: "o", type: String }
]);
var useOptions = options;
if (options.package) {
    try {
        var optionsFile = fs.readFileSync(path.join(_cwd, options.package), {});
        useOptions = __assign({}, useOptions, JSON.parse(optionsFile.toString("utf-8")));
    }
    catch (e) {
        throw new Error(e);
    }
}
else {
    try {
        var optionsFile = fs.readFileSync(path.join(_cwd, "nsql.json"), {});
        useOptions = __assign({}, useOptions, JSON.parse(optionsFile.toString("utf-8")));
    }
    catch (e) {
        // silently fail
    }
}
var parseModel = function (name, level, model) {
    var file = "";
    var tabs = "";
    for (var i = 0; i < level; i++) {
        tabs += "\t";
    }
    var hasArr = "";
    if (name) {
        hasArr = name.split("[]").filter(function (v, i) { return i > 0; }).map(function (v) { return "[]"; }).join("");
        file += tabs + (name.split(":")[0] + ":{\n");
    }
    var hasStar = "";
    Object.keys(model).forEach(function (m) {
        var mSplit = m.split(":");
        var nestedModel = model[m].model;
        if (nestedModel) { // nested object
            file += parseModel(m, level + 1, nestedModel);
        }
        else if (mSplit[0] === "*") {
            hasStar = mSplit[1] === "*" ? "any" : mSplit[1];
        }
        else { // primitive type
            var arrType = mSplit[1].split("[]").filter(function (v, i) { return i > 0; }).map(function (v) { return "[]"; }).join("");
            switch (mSplit[1].replace(/\[\]/gmi, "")) {
                case "any":
                case "blob":
                    file += tabs + ("\t" + mSplit[0] + ":any" + arrType + ";\n");
                    break;
                case "*":
                    hasStar = "any";
                    break;
                case "int":
                case "float":
                case "number":
                    file += tabs + ("\t" + mSplit[0] + ":number" + arrType + ";\n");
                    break;
                case "safestr":
                case "string":
                    file += tabs + ("\t" + mSplit[0] + ":string" + arrType + ";\n");
                    break;
                case "bool":
                case "boolean":
                    file += tabs + ("\t" + mSplit[0] + ":boolean" + arrType + ";\n");
                    break;
                case "array":
                    file += tabs + ("\t" + mSplit[0] + ":any[]" + arrType + ";\n");
                    break;
                case "uuid":
                    file += tabs + ("\t" + mSplit[0] + ":uuid" + arrType + ";\n");
                    break;
                case "timeId":
                    file += tabs + ("\t" + mSplit[0] + ":timeId" + arrType + ";\n");
                    break;
                case "timeIdms":
                    file += tabs + ("\t" + mSplit[0] + ":timeIdms" + arrType + "\n");
                    break;
            }
        }
    });
    if (hasStar) {
        file += tabs + ("\t[key: string]: " + hasStar + ";\n");
    }
    if (name) {
        file += tabs + ("}" + hasArr + ";\n");
    }
    return file;
};
var parseFile = function (file, idx) {
    try {
        delete require.cache[file];
        var mod = require(file);
        var tsFile_1 = "import { uuid, timeId, timeIdms } from  \"@nano-sql/core/lib/interfaces\"\n\n";
        if (mod.tables) {
            mod.tables.forEach(function (table) {
                tsFile_1 += "export interface I" + table.name + "Table {\n";
                tsFile_1 += parseModel("", 0, table.model);
                tsFile_1 += "}";
                tsFile_1 += "\n\n";
            });
        }
        var now = luxon_1.DateTime.local();
        console.log(idx + 1 + ". \"" + (file.split(/\\|\//gmi).pop() || "") + "\" types rendered.");
        return tsFile_1;
    }
    catch (e) {
        throw new Error(e);
    }
};
if (!useOptions.files || !useOptions.files.length) {
    throw new Error("No files declared, need files with {files: []} or --files file1 file2!");
}
if (!useOptions.outDir) {
    throw new Error("No out directory declared, need it with {outDir: \".\"} or --outDir .!");
}
useOptions.files.forEach(function (file, i) {
    var now = luxon_1.DateTime.local();
    console.log("Running on " + now.toLocaleString(luxon_1.DateTime.DATETIME_FULL));
    var newTypeFile = parseFile(path.join(_cwd, file), i);
    var fileName = (file.split(/\\|\//gmi).pop() || "").split(".").shift();
    try {
        fs.writeFileSync(path.join(useOptions.outDir || _cwd, fileName + ".ts"), newTypeFile);
    }
    catch (e) {
        throw new Error(e);
    }
});
if (useOptions.watch) {
    console.log("\nWatching files...");
    useOptions.files.forEach(function (file) {
        var watcher = chokadir.watch(path.join(_cwd, file), {
            persist: true,
            usePolling: useOptions.watchPolling ? true : false,
            interval: useOptions.watchPolling,
        });
        watcher.on("change", function (ev) {
            var now = luxon_1.DateTime.local();
            console.log("Change detected " + now.toLocaleString(luxon_1.DateTime.DATETIME_FULL));
            var newTypeFile = parseFile(ev, 0);
            var fileName = (ev.split(/\\|\//gmi).pop() || "").split(".").shift();
            try {
                fs.writeFileSync(path.join(useOptions.outDir || _cwd, fileName + ".ts"), newTypeFile);
            }
            catch (e) {
                throw new Error(e);
            }
        });
    });
}
//# sourceMappingURL=cli.js.map