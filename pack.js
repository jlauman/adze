
const fs   = require('fs');


let src1 = fs.readFileSync('./web/what/main.js', { encoding: 'utf8' });
let buf1 = Buffer.from(src1, 'utf8');
let src2 = buf1.toString('base64'); //.replace(/(\n|\r|\+)/gm, ' ');

let code = `
FILES['/demo/main.js'] = () => (new Buffer("${src2}", "base64")).toString("utf8");
`
fs.writeFileSync('./web/what/main2.js', code);

