const crypto = require('crypto');

function uuid() {
    let r, s, buf;
    const random16Bits = () => {
        if (crypto.getRandomValues) { // Browser crypto
            buf = new Uint16Array(1);
            window.crypto.getRandomValues(buf);
            return buf[0];
        } else if (crypto.randomBytes) {
            return crypto.randomBytes(2).reduce((prev, cur) => cur * prev);
        } else {
            return Math.round(Math.random() * Math.pow(2, 16)); // Oh god, please no.
        }
    }, b = "";

    return [b, b, b, b, b, b, b, b, b].reduce((prev, cur, i) => {
        r = random16Bits();
        s = (i === 4 ? i : (i === 5 ? (r % 16 & 0x3 | 0x8).toString(16) : b));
        r = r.toString(16);
        while (r.length < 4) r = "0" + r;
        return prev + ([3, 4, 5, 6].indexOf(i) >= 0 ? "-" : b) + (s + r).slice(0, 4);
    }, b);
};

for(let i = 0; i < 100; i++) {
    console.log(uuid());
}