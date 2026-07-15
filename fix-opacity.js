const fs = require('fs');
let c = fs.readFileSync('src/app/(dashboard)/api-center/page.tsx', 'utf8');

// Fix all occurrences
c = c.replace(/dark:bg-blue-900\/50/g, 'op("dark:bg-blue-900",50)');
c = c.replace(/dark:bg-blue-900\/100/g, 'op("dark:bg-blue-900",100)');
c = c.replace(/dark:bg-gray-900\/50/g, 'op("dark:bg-gray-900",50)');
c = c.replace(/dark:bg-gray-900\/100/g, 'op("dark:bg-gray-900",100)');
c = c.replace(/'900\/50'/g, '"900"');
c = c.replace(/'100'/g, '"100"');

fs.writeFileSync('src/app/(dashboard)/api-center/page.tsx', c);
console.log('done');