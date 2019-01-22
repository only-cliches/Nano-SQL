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
var utilities_1 = require("./utilities");
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
    { name: "ignoreCasing", alias: "c", type: Boolean },
    { name: "files", alias: "f", type: String, multiple: true },
    { name: "outDir", alias: "o", type: String }
]);
var useOptions = options;
if (options.package) {
    try {
        var optionsFile = fs.readFileSync(path.join(_cwd, options.package), {});
        useOptions = __assign({}, JSON.parse(optionsFile.toString("utf-8")), useOptions);
    }
    catch (e) {
        throw new Error(e);
    }
}
else {
    try {
        var optionsFile = fs.readFileSync(path.join(_cwd, "nsql.json"), {});
        useOptions = __assign({}, JSON.parse(optionsFile.toString("utf-8")), useOptions);
    }
    catch (e) {
        // silently fail
    }
}
var parseModel = function (name, level, required, model) {
    var file = "";
    var tabs = "";
    var hasArr = "";
    for (var i = 0; i < level; i++) {
        tabs += "\t";
    }
    var hasStar = "";
    if (name) {
        hasArr = name.split("[]").filter(function (v, i) { return i > 0; }).map(function (v) { return "[]"; }).join("");
        file += tabs + ("" + name.split(":")[0] + (required ? "" : "?") + ":{\n");
    }
    Object.keys(model).forEach(function (m) {
        var mSplit = m.split(":");
        var modelProps = model[m];
        var nestedModel = model[m].model;
        var optnl = modelProps.notNull || modelProps.pk || typeof modelProps.default !== "undefined" ? "" : "?";
        if (nestedModel) { // nested object
            file += parseModel(m, level + 1, optnl === "", nestedModel);
        }
        else if (mSplit[0] === "*") {
            hasStar = mSplit[1] === "*" ? "any" : mSplit[1];
        }
        else { // primitive type
            var arrType = mSplit[1].split("[]").filter(function (v, i) { return i > 0; }).map(function (v) { return "[]"; }).join("");
            switch (mSplit[1].replace(/\[\]/gmi, "")) {
                case "any":
                case "blob":
                    file += tabs + ("\t" + mSplit[0] + optnl + ":any" + arrType + ";\n");
                    break;
                case "*":
                    hasStar = "any";
                    break;
                case "int":
                case "float":
                case "number":
                    file += tabs + ("\t" + mSplit[0] + optnl + ":number" + arrType + ";\n");
                    break;
                case "safestr":
                case "string":
                    file += tabs + ("\t" + mSplit[0] + optnl + ":string" + arrType + ";\n");
                    break;
                case "bool":
                case "boolean":
                    file += tabs + ("\t" + mSplit[0] + optnl + ":boolean" + arrType + ";\n");
                    break;
                case "array":
                    file += tabs + ("\t" + mSplit[0] + optnl + ":any[]" + arrType + ";\n");
                    break;
                case "uuid":
                    file += tabs + ("\t" + mSplit[0] + optnl + ":uuid" + arrType + ";\n");
                    break;
                case "timeId":
                    file += tabs + ("\t" + mSplit[0] + optnl + ":timeId" + arrType + ";\n");
                    break;
                case "timeIdms":
                    file += tabs + ("\t" + mSplit[0] + optnl + ":timeIdms" + arrType + "\n");
                    break;
                case "geo":
                    file += tabs + ("\t" + mSplit[0] + optnl + ":{\n");
                    file += tabs + "\t\tlat:number;\n";
                    file += tabs + "\t\tlon:number;\n";
                    file += tabs + ("\t}" + arrType + "\n");
                    break;
                default:
                    var type = mSplit[1].replace(/\[\]/gmi, "");
                    file += tabs + ("\t" + mSplit[0] + optnl + ":Itype" + (useOptions.ignoreCasing ? type : utilities_1.titleCase(type)) + arrType + ";\n");
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
        var mod_1 = require(file);
        var tsFile_1 = "import { uuid, timeId, timeIdms } from  \"@nano-sql/core/lib/interfaces\";\n\n";
        if (mod_1.tables) {
            mod_1.tables.forEach(function (table) {
                if (typeof table.model === "string") {
                    var typeName = table.model.replace(/\[\]/gmi, "");
                    tsFile_1 += "export interface Itable" + (useOptions.ignoreCasing ? table.name : utilities_1.titleCase(table.name)) + " extends Itype" + (useOptions.ignoreCasing ? typeName : utilities_1.titleCase(typeName)) + " {} \n\n";
                }
                else {
                    tsFile_1 += "export interface Itable" + (useOptions.ignoreCasing ? table.name : utilities_1.titleCase(table.name)) + " {\n";
                    tsFile_1 += parseModel("", 0, true, table.model);
                    tsFile_1 += "}";
                    tsFile_1 += "\n\n";
                }
                if (table.queries) {
                    Object.keys(table.queries || {}).forEach(function (fnName) {
                        var fn = (table.queries || {})[fnName];
                        if (fn.args) {
                            if (typeof fn.args === "string") {
                                var typeName = fn.args.replace(/\[\]/gmi, "");
                                tsFile_1 += "export interface Itable" + (useOptions.ignoreCasing ? table.name : utilities_1.titleCase(table.name)) + "FnArgs" + (useOptions.ignoreCasing ? fnName : utilities_1.titleCase(fnName)) + " extends Itype" + (useOptions.ignoreCasing ? typeName : utilities_1.titleCase(typeName)) + "  {} \n\n";
                            }
                            else {
                                tsFile_1 += "export interface Itable" + (useOptions.ignoreCasing ? table.name : utilities_1.titleCase(table.name)) + "FnArgs" + (useOptions.ignoreCasing ? fnName : utilities_1.titleCase(fnName)) + " {\n";
                                tsFile_1 += parseModel("", 0, true, fn.args);
                                tsFile_1 += "}";
                                tsFile_1 += "\n\n";
                            }
                        }
                        if (fn.returns) { // manually declared
                            if (typeof fn.returns === "string") {
                                var typeName = fn.returns.replace(/\[\]/gmi, "");
                                tsFile_1 += "export interface Itable" + (useOptions.ignoreCasing ? table.name : utilities_1.titleCase(table.name)) + "FnReturns" + (useOptions.ignoreCasing ? fnName : utilities_1.titleCase(fnName)) + " extends Itype" + (useOptions.ignoreCasing ? typeName : utilities_1.titleCase(typeName)) + "  {} \n\n";
                            }
                            else {
                                tsFile_1 += "export interface Itable" + (useOptions.ignoreCasing ? table.name : utilities_1.titleCase(table.name)) + "FnReturns" + (useOptions.ignoreCasing ? fnName : utilities_1.titleCase(fnName)) + " {\n";
                                tsFile_1 += parseModel("", 0, true, fn.returns);
                                tsFile_1 += "}";
                                tsFile_1 += "\n\n";
                            }
                        }
                        else { // autodetect 
                        }
                    });
                }
            });
        }
        if (mod_1.types) {
            Object.keys(mod_1.types).forEach(function (type) {
                var typeObj = (mod_1.types || {})[type];
                tsFile_1 += "export interface Itype" + (useOptions.ignoreCasing ? type : utilities_1.titleCase(type)) + " {\n";
                tsFile_1 += parseModel("", 0, true, typeObj);
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