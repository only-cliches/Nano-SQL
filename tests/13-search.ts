import { nSQL, NanoSQLInstance } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";
import { tokenizer } from "../src/utilities";

const initStore = (complete: (nSQL: NanoSQLInstance) => void) => {
    const nSQL = new NanoSQLInstance();
    nSQL.table("posts")
    .model([
        {key: "id", type: "uuid", props: ["pk()"]},
        {key: "title", type: "string", props: ["search(4, enlglish)"]},
        {key: "content", type: "string", props: ["search(1, english)"]}
    ])
    .connect().then(() => {
        return nSQL.loadJS("posts", [
            {
                title: "Typescript",
                content: "TypeScript is designed for development of large applications and transpile to JavaScript. As TypeScript is a superset of JavaScript, existing JavaScript programs are also valid TypeScript programs. TypeScript may be used to develop JavaScript applications for both client-side and server-side (Node.js) execution."
            },
            {
                title: "Programming Language",
                content: "A programming language is a formal language that specifies a set of instructions that can be used to produce various kinds of output. Programming languages generally consist of instructions for a computer. Programming languages can be used to create programs that implement specific algorithms."
            },
            {
                title: "Node.js",
                content: "Node.js is an open-source, cross-platform JavaScript run-time environment that executes JavaScript code server-side. Historically, JavaScript was used primarily for client-side scripting, in which scripts written in JavaScript are embedded in a webpage's HTML and run client-side by a JavaScript engine in the user's web browser. Node.js lets developers use JavaScript for server-side scripting—running scripts server-side to produce dynamic web page content before the page is sent to the user's web browser. Consequently, Node.js represents a 'JavaScript everywhere' paradigm, unifying web application development around a single programming language, rather than different languages for server side and client side scripts."
            }
        ]);
    }).then(() => {
        complete(nSQL);
    });
};

const englishText = `JavaScript (/ˈdʒɑːvəˌskrɪpt/),[6] often abbreviated as JS, is a high-level, interpreted programming language. It is a language which is also characterized as dynamic, weakly typed, prototype-based and multi-paradigm.

Alongside HTML and CSS, JavaScript is one of the three core technologies of the World Wide Web.[7] JavaScript enables interactive web pages and thus is an essential part of web applications. The vast majority of websites use it,[8] and all major web browsers have a dedicated JavaScript engine to execute it.

As a multi-paradigm language, JavaScript supports event-driven, functional, and imperative (including object-oriented and prototype-based) programming styles. It has an API for working with text, arrays, dates, regular expressions, and basic manipulation of the DOM, but the language itself does not include any I/O, such as networking, storage, or graphics facilities, relying for these upon the host environment in which it is embedded. 1/2 1/8 1/400`;

const englishTokens = [{ "o": "javascript", "w": "JFSKRPT", "i": 0 }, { "o": "dvskrpt", "w": "TFSKRPT", "i": 1 }, { "o": "6.0000", "w": "6.0000", "i": 2 }, { "o": "often", "w": "OFTN", "i": 3 }, { "o": "abbreviated", "w": "ABRF", "i": 4 }, { "o": "as", "w": "", "i": 5 }, { "o": "js", "w": "JS", "i": 6 }, { "o": "is", "w": "", "i": 7 }, { "o": "a", "w": "", "i": 8 }, { "o": "high", "w": "HF", "i": 9 }, { "o": "level", "w": "LFL", "i": 10 }, { "o": "interpreted", "w": "INTRPRT", "i": 11 }, { "o": "programming", "w": "PRKRM", "i": 12 }, { "o": "language", "w": "LNKK", "i": 13 }, { "o": "it", "w": "", "i": 14 }, { "o": "is", "w": "", "i": 15 }, { "o": "a", "w": "", "i": 16 }, { "o": "language", "w": "LNKK", "i": 17 }, { "o": "which", "w": "", "i": 18 }, { "o": "is", "w": "", "i": 19 }, { "o": "also", "w": "", "i": 20 }, { "o": "characterized", "w": "XRKTR", "i": 21 }, { "o": "as", "w": "", "i": 22 }, { "o": "dynamic", "w": "TNM", "i": 23 }, { "o": "weakly", "w": "WKL", "i": 24 }, { "o": "typed", "w": "TP", "i": 25 }, { "o": "prototype", "w": "PRTTP", "i": 26 }, { "o": "based", "w": "BS", "i": 27 }, { "o": "and", "w": "", "i": 28 }, { "o": "multi", "w": "MLT", "i": 29 }, { "o": "paradigm", "w": "PRTKM", "i": 30 }, { "o": "alongside", "w": "ALNKST", "i": 31 }, { "o": "html", "w": "TML", "i": 32 }, { "o": "and", "w": "", "i": 33 }, { "o": "css", "w": "KS", "i": 34 }, { "o": "javascript", "w": "JFSKRPT", "i": 35 }, { "o": "is", "w": "", "i": 36 }, { "o": "one", "w": "ON", "i": 37 }, { "o": "of", "w": "", "i": 38 }, { "o": "the", "w": "", "i": 39 }, { "o": "three", "w": "0R", "i": 40 }, { "o": "core", "w": "KR", "i": 41 }, { "o": "technologies", "w": "TXNLK", "i": 42 }, { "o": "of", "w": "", "i": 43 }, { "o": "the", "w": "", "i": 44 }, { "o": "world", "w": "WRLT", "i": 45 }, { "o": "wide", "w": "WT", "i": 46 }, { "o": "web", "w": "WB", "i": 47 }, { "o": "7.0000", "w": "7.0000", "i": 48 }, { "o": "javascript", "w": "JFSKRPT", "i": 49 }, { "o": "enables", "w": "ENBL", "i": 50 }, { "o": "interactive", "w": "INTRKT", "i": 51 }, { "o": "web", "w": "WB", "i": 52 }, { "o": "pages", "w": "PJ", "i": 53 }, { "o": "and", "w": "", "i": 54 }, { "o": "thus", "w": "0", "i": 55 }, { "o": "is", "w": "", "i": 56 }, { "o": "an", "w": "", "i": 57 }, { "o": "essential", "w": "ESNT", "i": 58 }, { "o": "part", "w": "PRT", "i": 59 }, { "o": "of", "w": "", "i": 60 }, { "o": "web", "w": "WB", "i": 61 }, { "o": "applications", "w": "APLK", "i": 62 }, { "o": "the", "w": "", "i": 63 }, { "o": "vast", "w": "FST", "i": 64 }, { "o": "majority", "w": "MJR", "i": 65 }, { "o": "of", "w": "", "i": 66 }, { "o": "websites", "w": "WBST", "i": 67 }, { "o": "use", "w": "US", "i": 68 }, { "o": "it", "w": "", "i": 69 }, { "o": "8.0000", "w": "8.0000", "i": 70 }, { "o": "and", "w": "", "i": 71 }, { "o": "all", "w": "", "i": 72 }, { "o": "major", "w": "MJR", "i": 73 }, { "o": "web", "w": "WB", "i": 74 }, { "o": "browsers", "w": "BRSR", "i": 75 }, { "o": "have", "w": "", "i": 76 }, { "o": "a", "w": "", "i": 77 }, { "o": "dedicated", "w": "TTK", "i": 78 }, { "o": "javascript", "w": "JFSKRPT", "i": 79 }, { "o": "engine", "w": "ENJN", "i": 80 }, { "o": "to", "w": "", "i": 81 }, { "o": "execute", "w": "EKSKT", "i": 82 }, { "o": "it", "w": "", "i": 83 }, { "o": "as", "w": "", "i": 84 }, { "o": "a", "w": "", "i": 85 }, { "o": "multi", "w": "MLT", "i": 86 }, { "o": "paradigm", "w": "PRTKM", "i": 87 }, { "o": "language", "w": "LNKK", "i": 88 }, { "o": "javascript", "w": "JFSKRPT", "i": 89 }, { "o": "supports", "w": "SPRT", "i": 90 }, { "o": "event", "w": "EFNT", "i": 91 }, { "o": "driven", "w": "TRFN", "i": 92 }, { "o": "functional", "w": "FNKXN", "i": 93 }, { "o": "and", "w": "", "i": 94 }, { "o": "imperative", "w": "IMPR", "i": 95 }, { "o": "including", "w": "INKLT", "i": 96 }, { "o": "object", "w": "OBJKT", "i": 97 }, { "o": "oriented", "w": "ORNT", "i": 98 }, { "o": "and", "w": "", "i": 99 }, { "o": "prototype", "w": "PRTTP", "i": 100 }, { "o": "based", "w": "BS", "i": 101 }, { "o": "programming", "w": "PRKRM", "i": 102 }, { "o": "styles", "w": "STL", "i": 103 }, { "o": "it", "w": "", "i": 104 }, { "o": "has", "w": "", "i": 105 }, { "o": "an", "w": "", "i": 106 }, { "o": "api", "w": "AP", "i": 107 }, { "o": "for", "w": "", "i": 108 }, { "o": "working", "w": "WRK", "i": 109 }, { "o": "with", "w": "", "i": 110 }, { "o": "text", "w": "TKST", "i": 111 }, { "o": "arrays", "w": "AR", "i": 112 }, { "o": "dates", "w": "TT", "i": 113 }, { "o": "regular", "w": "RKLR", "i": 114 }, { "o": "expressions", "w": "EKSPRS", "i": 115 }, { "o": "and", "w": "", "i": 116 }, { "o": "basic", "w": "BSK", "i": 117 }, { "o": "manipulation", "w": "MNPL", "i": 118 }, { "o": "of", "w": "", "i": 119 }, { "o": "the", "w": "", "i": 120 }, { "o": "dom", "w": "TM", "i": 121 }, { "o": "but", "w": "", "i": 122 }, { "o": "the", "w": "", "i": 123 }, { "o": "language", "w": "LNKK", "i": 124 }, { "o": "itself", "w": "ITSLF", "i": 125 }, { "o": "does", "w": "T", "i": 126 }, { "o": "not", "w": "NT", "i": 127 }, { "o": "include", "w": "INKLT", "i": 128 }, { "o": "any", "w": "", "i": 129 }, { "o": "io", "w": "I", "i": 130 }, { "o": "such", "w": "", "i": 131 }, { "o": "as", "w": "", "i": 132 }, { "o": "networking", "w": "NTWRK", "i": 133 }, { "o": "storage", "w": "STRK", "i": 134 }, { "o": "or", "w": "", "i": 135 }, { "o": "graphics", "w": "KRFK", "i": 136 }, { "o": "facilities", "w": "FSL", "i": 137 }, { "o": "relying", "w": "RL", "i": 138 }, { "o": "for", "w": "", "i": 139 }, { "o": "these", "w": "", "i": 140 }, { "o": "upon", "w": "UPN", "i": 141 }, { "o": "the", "w": "", "i": 142 }, { "o": "host", "w": "HST", "i": 143 }, { "o": "environment", "w": "ENFRN", "i": 144 }, { "o": "in", "w": "", "i": 145 }, { "o": "which", "w": "", "i": 146 }, { "o": "it", "w": "", "i": 147 }, { "o": "is", "w": "", "i": 148 }, { "o": "embedded", "w": "EMT", "i": 149 }, { "o": "0.5000", "w": "0.5000", "i": 150 }, { "o": "0.1250", "w": "0.1250", "i": 151 }, { "o": "0.0025", "w": "0.0025", "i": 152 }];
const englishMetaTokens = [{ "o": "javascript", "w": "JFSKRPT", "i": 0 }, { "o": "dvskrpt", "w": "TFSKRPT", "i": 1 }, { "o": "6.0000", "w": "6.0000", "i": 2 }, { "o": "often", "w": "OFTN", "i": 3 }, { "o": "abbreviated", "w": "ABRFTT", "i": 4 }, { "o": "as", "w": "", "i": 5 }, { "o": "js", "w": "JS", "i": 6 }, { "o": "is", "w": "", "i": 7 }, { "o": "a", "w": "", "i": 8 }, { "o": "high", "w": "HF", "i": 9 }, { "o": "level", "w": "LFL", "i": 10 }, { "o": "interpreted", "w": "INTRPRTT", "i": 11 }, { "o": "programming", "w": "PRKRMNK", "i": 12 }, { "o": "language", "w": "LNKJ", "i": 13 }, { "o": "it", "w": "", "i": 14 }, { "o": "is", "w": "", "i": 15 }, { "o": "a", "w": "", "i": 16 }, { "o": "language", "w": "LNKJ", "i": 17 }, { "o": "which", "w": "", "i": 18 }, { "o": "is", "w": "", "i": 19 }, { "o": "also", "w": "", "i": 20 }, { "o": "characterized", "w": "XRKTRST", "i": 21 }, { "o": "as", "w": "", "i": 22 }, { "o": "dynamic", "w": "TNMK", "i": 23 }, { "o": "weakly", "w": "WKL", "i": 24 }, { "o": "typed", "w": "TPT", "i": 25 }, { "o": "prototype", "w": "PRTTP", "i": 26 }, { "o": "based", "w": "BST", "i": 27 }, { "o": "and", "w": "", "i": 28 }, { "o": "multi", "w": "MLT", "i": 29 }, { "o": "paradigm", "w": "PRTKM", "i": 30 }, { "o": "alongside", "w": "ALNKST", "i": 31 }, { "o": "html", "w": "TML", "i": 32 }, { "o": "and", "w": "", "i": 33 }, { "o": "css", "w": "KS", "i": 34 }, { "o": "javascript", "w": "JFSKRPT", "i": 35 }, { "o": "is", "w": "", "i": 36 }, { "o": "one", "w": "ON", "i": 37 }, { "o": "of", "w": "", "i": 38 }, { "o": "the", "w": "", "i": 39 }, { "o": "three", "w": "0R", "i": 40 }, { "o": "core", "w": "KR", "i": 41 }, { "o": "technologies", "w": "TXNLJS", "i": 42 }, { "o": "of", "w": "", "i": 43 }, { "o": "the", "w": "", "i": 44 }, { "o": "world", "w": "WRLT", "i": 45 }, { "o": "wide", "w": "WT", "i": 46 }, { "o": "web", "w": "WB", "i": 47 }, { "o": "7.0000", "w": "7.0000", "i": 48 }, { "o": "javascript", "w": "JFSKRPT", "i": 49 }, { "o": "enables", "w": "ENBLS", "i": 50 }, { "o": "interactive", "w": "INTRKTF", "i": 51 }, { "o": "web", "w": "WB", "i": 52 }, { "o": "pages", "w": "PJS", "i": 53 }, { "o": "and", "w": "", "i": 54 }, { "o": "thus", "w": "0S", "i": 55 }, { "o": "is", "w": "", "i": 56 }, { "o": "an", "w": "", "i": 57 }, { "o": "essential", "w": "ESNXL", "i": 58 }, { "o": "part", "w": "PRT", "i": 59 }, { "o": "of", "w": "", "i": 60 }, { "o": "web", "w": "WB", "i": 61 }, { "o": "applications", "w": "APLKXNS", "i": 62 }, { "o": "the", "w": "", "i": 63 }, { "o": "vast", "w": "FST", "i": 64 }, { "o": "majority", "w": "MJRT", "i": 65 }, { "o": "of", "w": "", "i": 66 }, { "o": "websites", "w": "WBSTS", "i": 67 }, { "o": "use", "w": "US", "i": 68 }, { "o": "it", "w": "", "i": 69 }, { "o": "8.0000", "w": "8.0000", "i": 70 }, { "o": "and", "w": "", "i": 71 }, { "o": "all", "w": "", "i": 72 }, { "o": "major", "w": "MJR", "i": 73 }, { "o": "web", "w": "WB", "i": 74 }, { "o": "browsers", "w": "BRSRS", "i": 75 }, { "o": "have", "w": "", "i": 76 }, { "o": "a", "w": "", "i": 77 }, { "o": "dedicated", "w": "TTKTT", "i": 78 }, { "o": "javascript", "w": "JFSKRPT", "i": 79 }, { "o": "engine", "w": "ENJN", "i": 80 }, { "o": "to", "w": "", "i": 81 }, { "o": "execute", "w": "EKSKT", "i": 82 }, { "o": "it", "w": "", "i": 83 }, { "o": "as", "w": "", "i": 84 }, { "o": "a", "w": "", "i": 85 }, { "o": "multi", "w": "MLT", "i": 86 }, { "o": "paradigm", "w": "PRTKM", "i": 87 }, { "o": "language", "w": "LNKJ", "i": 88 }, { "o": "javascript", "w": "JFSKRPT", "i": 89 }, { "o": "supports", "w": "SPRTS", "i": 90 }, { "o": "event", "w": "EFNT", "i": 91 }, { "o": "driven", "w": "TRFN", "i": 92 }, { "o": "functional", "w": "FNKXNL", "i": 93 }, { "o": "and", "w": "", "i": 94 }, { "o": "imperative", "w": "IMPRTF", "i": 95 }, { "o": "including", "w": "INKLTNK", "i": 96 }, { "o": "object", "w": "OBJKT", "i": 97 }, { "o": "oriented", "w": "ORNTT", "i": 98 }, { "o": "and", "w": "", "i": 99 }, { "o": "prototype", "w": "PRTTP", "i": 100 }, { "o": "based", "w": "BST", "i": 101 }, { "o": "programming", "w": "PRKRMNK", "i": 102 }, { "o": "styles", "w": "STLS", "i": 103 }, { "o": "it", "w": "", "i": 104 }, { "o": "has", "w": "", "i": 105 }, { "o": "an", "w": "", "i": 106 }, { "o": "api", "w": "AP", "i": 107 }, { "o": "for", "w": "", "i": 108 }, { "o": "working", "w": "WRKNK", "i": 109 }, { "o": "with", "w": "", "i": 110 }, { "o": "text", "w": "TKST", "i": 111 }, { "o": "arrays", "w": "ARS", "i": 112 }, { "o": "dates", "w": "TTS", "i": 113 }, { "o": "regular", "w": "RKLR", "i": 114 }, { "o": "expressions", "w": "EKSPRSNS", "i": 115 }, { "o": "and", "w": "", "i": 116 }, { "o": "basic", "w": "BSK", "i": 117 }, { "o": "manipulation", "w": "MNPLXN", "i": 118 }, { "o": "of", "w": "", "i": 119 }, { "o": "the", "w": "", "i": 120 }, { "o": "dom", "w": "TM", "i": 121 }, { "o": "but", "w": "", "i": 122 }, { "o": "the", "w": "", "i": 123 }, { "o": "language", "w": "LNKJ", "i": 124 }, { "o": "itself", "w": "ITSLF", "i": 125 }, { "o": "does", "w": "TS", "i": 126 }, { "o": "not", "w": "NT", "i": 127 }, { "o": "include", "w": "INKLT", "i": 128 }, { "o": "any", "w": "", "i": 129 }, { "o": "io", "w": "I", "i": 130 }, { "o": "such", "w": "", "i": 131 }, { "o": "as", "w": "", "i": 132 }, { "o": "networking", "w": "NTWRKNK", "i": 133 }, { "o": "storage", "w": "STRJ", "i": 134 }, { "o": "or", "w": "", "i": 135 }, { "o": "graphics", "w": "KRFKS", "i": 136 }, { "o": "facilities", "w": "FSLTS", "i": 137 }, { "o": "relying", "w": "RLYNK", "i": 138 }, { "o": "for", "w": "", "i": 139 }, { "o": "these", "w": "", "i": 140 }, { "o": "upon", "w": "UPN", "i": 141 }, { "o": "the", "w": "", "i": 142 }, { "o": "host", "w": "HST", "i": 143 }, { "o": "environment", "w": "ENFRNMNT", "i": 144 }, { "o": "in", "w": "", "i": 145 }, { "o": "which", "w": "", "i": 146 }, { "o": "it", "w": "", "i": 147 }, { "o": "is", "w": "", "i": 148 }, { "o": "embedded", "w": "EMTT", "i": 149 }, { "o": "0.5000", "w": "0.5000", "i": 150 }, { "o": "0.1250", "w": "0.1250", "i": 151 }, { "o": "0.0025", "w": "0.0025", "i": 152 }];
const enligshStemTokens = [{ "o": "javascript", "w": "javascript", "i": 0 }, { "o": "dvskrpt", "w": "dvskrpt", "i": 1 }, { "o": "6.0000", "w": "6.0000", "i": 2 }, { "o": "often", "w": "often", "i": 3 }, { "o": "abbreviated", "w": "abbrevi", "i": 4 }, { "o": "as", "w": "", "i": 5 }, { "o": "js", "w": "js", "i": 6 }, { "o": "is", "w": "", "i": 7 }, { "o": "a", "w": "", "i": 8 }, { "o": "high", "w": "high", "i": 9 }, { "o": "level", "w": "level", "i": 10 }, { "o": "interpreted", "w": "interpret", "i": 11 }, { "o": "programming", "w": "program", "i": 12 }, { "o": "language", "w": "languag", "i": 13 }, { "o": "it", "w": "", "i": 14 }, { "o": "is", "w": "", "i": 15 }, { "o": "a", "w": "", "i": 16 }, { "o": "language", "w": "languag", "i": 17 }, { "o": "which", "w": "", "i": 18 }, { "o": "is", "w": "", "i": 19 }, { "o": "also", "w": "", "i": 20 }, { "o": "characterized", "w": "character", "i": 21 }, { "o": "as", "w": "", "i": 22 }, { "o": "dynamic", "w": "dynam", "i": 23 }, { "o": "weakly", "w": "weakli", "i": 24 }, { "o": "typed", "w": "type", "i": 25 }, { "o": "prototype", "w": "prototyp", "i": 26 }, { "o": "based", "w": "base", "i": 27 }, { "o": "and", "w": "", "i": 28 }, { "o": "multi", "w": "multi", "i": 29 }, { "o": "paradigm", "w": "paradigm", "i": 30 }, { "o": "alongside", "w": "alongsid", "i": 31 }, { "o": "html", "w": "html", "i": 32 }, { "o": "and", "w": "", "i": 33 }, { "o": "css", "w": "css", "i": 34 }, { "o": "javascript", "w": "javascript", "i": 35 }, { "o": "is", "w": "", "i": 36 }, { "o": "one", "w": "on", "i": 37 }, { "o": "of", "w": "", "i": 38 }, { "o": "the", "w": "", "i": 39 }, { "o": "three", "w": "three", "i": 40 }, { "o": "core", "w": "core", "i": 41 }, { "o": "technologies", "w": "technolog", "i": 42 }, { "o": "of", "w": "", "i": 43 }, { "o": "the", "w": "", "i": 44 }, { "o": "world", "w": "world", "i": 45 }, { "o": "wide", "w": "wide", "i": 46 }, { "o": "web", "w": "web", "i": 47 }, { "o": "7.0000", "w": "7.0000", "i": 48 }, { "o": "javascript", "w": "javascript", "i": 49 }, { "o": "enables", "w": "enabl", "i": 50 }, { "o": "interactive", "w": "interact", "i": 51 }, { "o": "web", "w": "web", "i": 52 }, { "o": "pages", "w": "page", "i": 53 }, { "o": "and", "w": "", "i": 54 }, { "o": "thus", "w": "thu", "i": 55 }, { "o": "is", "w": "", "i": 56 }, { "o": "an", "w": "", "i": 57 }, { "o": "essential", "w": "essenti", "i": 58 }, { "o": "part", "w": "part", "i": 59 }, { "o": "of", "w": "", "i": 60 }, { "o": "web", "w": "web", "i": 61 }, { "o": "applications", "w": "applic", "i": 62 }, { "o": "the", "w": "", "i": 63 }, { "o": "vast", "w": "vast", "i": 64 }, { "o": "majority", "w": "major", "i": 65 }, { "o": "of", "w": "", "i": 66 }, { "o": "websites", "w": "websit", "i": 67 }, { "o": "use", "w": "us", "i": 68 }, { "o": "it", "w": "", "i": 69 }, { "o": "8.0000", "w": "8.0000", "i": 70 }, { "o": "and", "w": "", "i": 71 }, { "o": "all", "w": "", "i": 72 }, { "o": "major", "w": "major", "i": 73 }, { "o": "web", "w": "web", "i": 74 }, { "o": "browsers", "w": "browser", "i": 75 }, { "o": "have", "w": "", "i": 76 }, { "o": "a", "w": "", "i": 77 }, { "o": "dedicated", "w": "dedic", "i": 78 }, { "o": "javascript", "w": "javascript", "i": 79 }, { "o": "engine", "w": "engin", "i": 80 }, { "o": "to", "w": "", "i": 81 }, { "o": "execute", "w": "execut", "i": 82 }, { "o": "it", "w": "", "i": 83 }, { "o": "as", "w": "", "i": 84 }, { "o": "a", "w": "", "i": 85 }, { "o": "multi", "w": "multi", "i": 86 }, { "o": "paradigm", "w": "paradigm", "i": 87 }, { "o": "language", "w": "languag", "i": 88 }, { "o": "javascript", "w": "javascript", "i": 89 }, { "o": "supports", "w": "support", "i": 90 }, { "o": "event", "w": "event", "i": 91 }, { "o": "driven", "w": "driven", "i": 92 }, { "o": "functional", "w": "function", "i": 93 }, { "o": "and", "w": "", "i": 94 }, { "o": "imperative", "w": "imper", "i": 95 }, { "o": "including", "w": "includ", "i": 96 }, { "o": "object", "w": "object", "i": 97 }, { "o": "oriented", "w": "orient", "i": 98 }, { "o": "and", "w": "", "i": 99 }, { "o": "prototype", "w": "prototyp", "i": 100 }, { "o": "based", "w": "base", "i": 101 }, { "o": "programming", "w": "program", "i": 102 }, { "o": "styles", "w": "style", "i": 103 }, { "o": "it", "w": "", "i": 104 }, { "o": "has", "w": "", "i": 105 }, { "o": "an", "w": "", "i": 106 }, { "o": "api", "w": "api", "i": 107 }, { "o": "for", "w": "", "i": 108 }, { "o": "working", "w": "work", "i": 109 }, { "o": "with", "w": "", "i": 110 }, { "o": "text", "w": "text", "i": 111 }, { "o": "arrays", "w": "arrai", "i": 112 }, { "o": "dates", "w": "date", "i": 113 }, { "o": "regular", "w": "regular", "i": 114 }, { "o": "expressions", "w": "express", "i": 115 }, { "o": "and", "w": "", "i": 116 }, { "o": "basic", "w": "basic", "i": 117 }, { "o": "manipulation", "w": "manipul", "i": 118 }, { "o": "of", "w": "", "i": 119 }, { "o": "the", "w": "", "i": 120 }, { "o": "dom", "w": "dom", "i": 121 }, { "o": "but", "w": "", "i": 122 }, { "o": "the", "w": "", "i": 123 }, { "o": "language", "w": "languag", "i": 124 }, { "o": "itself", "w": "itself", "i": 125 }, { "o": "does", "w": "doe", "i": 126 }, { "o": "not", "w": "not", "i": 127 }, { "o": "include", "w": "includ", "i": 128 }, { "o": "any", "w": "", "i": 129 }, { "o": "io", "w": "io", "i": 130 }, { "o": "such", "w": "", "i": 131 }, { "o": "as", "w": "", "i": 132 }, { "o": "networking", "w": "network", "i": 133 }, { "o": "storage", "w": "storag", "i": 134 }, { "o": "or", "w": "", "i": 135 }, { "o": "graphics", "w": "graphic", "i": 136 }, { "o": "facilities", "w": "facil", "i": 137 }, { "o": "relying", "w": "reli", "i": 138 }, { "o": "for", "w": "", "i": 139 }, { "o": "these", "w": "", "i": 140 }, { "o": "upon", "w": "upon", "i": 141 }, { "o": "the", "w": "", "i": 142 }, { "o": "host", "w": "host", "i": 143 }, { "o": "environment", "w": "environ", "i": 144 }, { "o": "in", "w": "", "i": 145 }, { "o": "which", "w": "", "i": 146 }, { "o": "it", "w": "", "i": 147 }, { "o": "is", "w": "", "i": 148 }, { "o": "embedded", "w": "embed", "i": 149 }, { "o": "0.5000", "w": "0.5000", "i": 150 }, { "o": "0.1250", "w": "0.1250", "i": 151 }, { "o": "0.0025", "w": "0.0025", "i": 152 }];

describe("Search", () => {
    it("Test English Tokenizer (Default)", (done: MochaDone) => {
        try {
            expect(englishTokens).to.deep.equal(tokenizer("", "", ["", "english"], englishText));
            done();
        } catch (e) {
            done(e);
        }
    });
    it("Test English Tokenizer (Metaphone)", (done: MochaDone) => {
        try {
            expect(englishMetaTokens).to.deep.equal(tokenizer("", "", ["", "english-meta"], englishText));
            done();
        } catch (e) {
            done(e);
        }
    });
    it("Test English Tokenizer (Stemmer)", (done: MochaDone) => {
        try {
            expect(enligshStemTokens).to.deep.equal(tokenizer("", "", ["", "english-stem"], englishText));
            done();
        } catch (e) {
            done(e);
        }
    });
    it("Test search() query with one column", (done: MochaDone) => {
        initStore((db) => {
            db.query("select").where(["search(title)", ">0.4", "language"]).exec().then((rows) => {
                try {
                    expect(rows[0].title).to.equal("Programming Language");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
    it("Test search() query with two columns", (done: MochaDone) => {
        initStore((db) => {
            db.query("select").where(["search(title, content)", ">0.4", "javascript"]).exec().then((rows) => {
                try {
                    expect(rows.map(r => r.title)).to.deep.equal(["Typescript", "Node.js"]);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
});