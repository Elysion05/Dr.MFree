const keytar = require('keytar');
console.log(keytar);
keytar.getPassword('com.ridi.books','global').then(
    password => {
        console.log(password);
    }
);
