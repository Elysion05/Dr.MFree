const fs = require('fs');
const path = require('path');
function removeDevDependencies(packageJsonPath){
    const package = JSON.parse(fs.readFileSync(packageJsonPath));
    package.devDependencies = {};
    delete package.scripts;
    //console.log(package);
    fs.writeFileSync(packageJsonPath, JSON.stringify(package, null, 2));
}

const packageJsonPath = process.argv[2];
!!packageJsonPath && removeDevDependencies(packageJsonPath);