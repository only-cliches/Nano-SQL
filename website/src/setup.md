# Setup

## Installing nanoSQL

### Browser
Simply copy one of the script links below and drop it into your page head.
```html
<!-- ES6 Only (Faster & Smaller) -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.3.7/dist/nano-sql.min.js" integrity="sha256-W1pVgKda7GC4fwXqq9jfOrssBDJJXZqck+ultRPVzmc=" crossorigin="anonymous"></script>
<!-- ES5 (Internet Explorer/Old Browser Support) -->
<!-- Promise must be polyfilled as well -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.3.7/dist/nano-sql.min.es5.js" integrity="sha256-1t9VlpFUgHaxlLQy6HM9ROQvTiuUv2M12Fp1oTh3+yg=" crossorigin="anonymous"></script>
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