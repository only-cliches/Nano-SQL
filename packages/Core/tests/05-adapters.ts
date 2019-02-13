import { expect, assert } from "chai";
import "mocha";
import { TestDBs, JSON2CSV, CSV2JSON, cleanNsqlJoin } from "./init";
import { comments, users, posts } from "./data";
import { nanoSQL } from "../src";
import { InanoSQLInstance } from "../src/interfaces";
import { nanoSQLAdapterTest } from "../src/adapter-test";
import { SyncStorage } from "../src/adapters/syncStorage";
import { RocksDB, rimraf } from "../src/adapters/rocksDB";


const webpack = require("webpack");
const path = require("path");
const fs = require("fs");
const PATHS = {
    build: path.join(__dirname, "dist")
};
const puppeteer = require("puppeteer");
const stoppable = require("stoppable");
const http = require("http");
const url = require("url");

declare const RSE: any;

describe("Adapter Tests", () => {
    it("Sync Storage", (done: MochaDone) => {
        new nanoSQLAdapterTest(SyncStorage, []).test().then(() => {
            done();
        }).catch((err) => {
            console.log(err);
            done(new Error(err));
        });
    });
    it("RocksDB Storage", (done: MochaDone) => {
        new nanoSQLAdapterTest(RocksDB, []).test().then(() => {
            rimraf(path.join(__dirname, "../", "db_123"));
            done();
        }).catch((err) => {
            console.log(err);
            rimraf(path.join(__dirname, "../", "db_123"));
            done(new Error(err));
        });
    });

    it("WebSQL, IndexedDB & LocalStorage", (done: MochaDone) => {

        webpack({
            entry: {
                "adapter-browser": [path.join(__dirname, "adapter-browser")],
            },
            output: {
                path: PATHS.build,
                filename: "[name].js",
                libraryTarget: "umd",
                umdNamedDefine: true
            },
            resolve: {
                extensions: [".ts", ".tsx", ".js"]
            },
            module: {
                rules: [
                    {
                        test: /\.ts$/,
                        loader: "ts-loader"
                    }
                ]
            }
        }, (err, stats) => {
            if (err || stats.hasErrors()) {
                console.error(err);
                return;
            }


            const server = stoppable(http.createServer(function (req, res) {

                // parse URL
                const parsedUrl = url.parse(req.url);
                // extract URL path
                let pathname = path.join(__dirname, "dist", parsedUrl.pathname);
                // based on the URL path, extract the file extention. e.g. .js, .doc, ...
                let ext = path.parse(pathname).ext;
                // maps file extention to MIME typere
                const map = {
                    ".ico": "image/x-icon",
                    ".html": "text/html",
                    ".js": "text/javascript",
                    ".json": "application/json",
                    ".css": "text/css",
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".wav": "audio/wav",
                    ".mp3": "audio/mpeg",
                    ".svg": "image/svg+xml",
                    ".pdf": "application/pdf",
                    ".doc": "application/msword"
                };

                fs.exists(pathname, function (exist) {
                    if (!exist) {
                        // if the file is not found, return 404
                        res.statusCode = 404;
                        res.end(`File ${pathname} not found!`);
                        return;
                    }

                    // if is a directory search for index file matching the extention
                    if (fs.statSync(pathname).isDirectory()) {
                        pathname += "/index.html";
                        ext = ".html";
                    }

                    // read file from file system
                    fs.readFile(pathname, function (err, data) {
                        if (err) {
                            res.statusCode = 500;
                            res.end(`Error getting the file: ${err}.`);
                        } else {
                            // if the file is found, set Content-type and send data
                            res.setHeader("Content-type", map[ext] || "text/plain");
                            res.end(data);
                        }
                    });
                });
            }));

            server.listen(8080, "localhost", 511, () => {
                (async () => {
                    const browser = await puppeteer.launch();
                    const page = await browser.newPage();
                    await page.bringToFront();
                    await page.goto("http://localhost:8080");
                    await page.waitFor(500);
                    const result = await page.evaluate(() => {
                        return new Promise((res, rej) => {
                            RSE.on("done", (count) => {
                                console.log("DONE");
                                res(count);
                            });
                        });
                    });
                    if (result === 0) {
                        done();
                    } else {
                        done(new Error("Browser Test Error"));
                    }
                    browser.close();
                    server.stop();

                })();
            });
        });
    }).timeout(60000);

});