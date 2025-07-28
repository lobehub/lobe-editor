const fs = require('node:fs');
const path = require('node:path');

// 定位 lexical 的 package.json 文件
const packageJsonPath = path.resolve(__dirname, '../node_modules/lexical/package.json');

// 读取 package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// 修改 package.json 的内容
const expt = packageJson.exports['.'];
Object.keys(expt).forEach((key) => {
    const obj = expt[key];
    obj.production = obj.development; // 将 development 指向 production
});

// 写回修改后的 package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

console.log('lexical package.json has been patched!');
