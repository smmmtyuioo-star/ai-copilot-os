const fs = require('fs');
let c = fs.readFileSync('src/app/(dashboard)/api-center/page.tsx', 'utf8');
c = c.replaceAll('String.fromCharCode(47)', "'/' + '/'");
fs.writeFileSync('src/app/(dashboard)/api-center/page.tsx', c);
console.log('done');