# Setup

## Installing nanoSQL

### Browser
Simply copy one of the script links below and drop it into your page head.
```html
<!-- ES6 Only (Faster & Smaller) -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.2.8/dist/nano-sql.min.js" integrity="sha256-Bg5eKiy40Dc3Y+PG2avLwk65fLg5xtyvpDvDPLGKEuc=" crossorigin="anonymous"></script>
<!-- ES5 (Internet Explorer/Old Browser Support) -->
<!-- Promise must be polyfilled as well -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.2.8/dist/nano-sql.min.es5.js" integrity="sha256-a+6SWcT8qd9Tk3PbXJ9w2CIITOrjsRxWyBHjnb+0Uvk=" crossorigin="anonymous"></script>
```

### NodeJS / Webpack / Browserify / etc
Run this in your project directory:
```sh
npm i @nano-sql/core --save
```

Then use in your project:
```ts
// typescript & babel
import { nSQL } from "@nano-sql/core";

// commonjs / node syntax
const nSQL = require("@nano-sql/core").nSQL;
```

Now that nanoSQL is setup in your environment you can [create your first database](/databases.html)!