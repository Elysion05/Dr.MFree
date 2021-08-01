const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const keytar = require('keytar');
const fs = require('fs');
const path = require('path');
const events = require('events');
let hardkey;

const getDirectories = source =>
    fs.readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

const defineProp = function(e, t, r) {
        //console.log(t)
        return t in e ? Object.defineProperty(e, t, {
            value: r,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[t] = r, e
    };

const getExtendedObjKeys = function(e, t) {
        var r = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
            var n = Object.getOwnPropertySymbols(e);
            t && (n = n.filter((function(t) {
                return Object.getOwnPropertyDescriptor(e, t).enumerable
            }))), r.push.apply(r, n)
        }
        return r
    };

const mergeObjects =  function(e) {
        for (var t = 1; t < arguments.length; t++) {
            var r = null != arguments[t] ? arguments[t] : {};
            t % 2 ? Object.keys(r).forEach((function(t) {
                defineProp(e, t, r[t])
            })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) 
                    : getExtendedObjKeys(Object(r)).forEach((function(t) {
                        Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(r, t))
            }))
        }
        return e
    };



const globalStateKeys = ['auth', 'device', 'setting'];
const userStateKeys = ['book', 'download', 'userSetting', 'bookUnit'];

class StateManager{

    constructor(userDataPath){
        this.userDataPath = userDataPath;
        this.datastoresPath = path.join(this.userDataPath, "datastores");
        this.state = {};
        this.initialize();
    }

    initialize(){
        this.getGlobalState();
        this.getUserState();
    }

    getGlobalState(){
        if (this.state.global) return this.state.global;
        this.state.global = {};
        var dpath = path.join(this.datastoresPath, "global"); 
        globalStateKeys.forEach( key => {
            var fpath = path.join(dpath, key);
            mergeObjects(this.state.global, StateManager.loadStateFile(fpath, "global"));
        } );
        //console.log(this.state.global);
        return this.state.global;
    } 

    getUserState(){
        if (this.state.user) return this.state.user;
        const rpath = path.join(this.datastoresPath, "user"); 
        const users = getDirectories(rpath);
        this.state.user = {};
        users.forEach(user => {
            this.state.user[user] = {};
            userStateKeys.forEach(key => {
                var fpath = path.join(rpath, user, key);
                this.state.user[user][key] = StateManager.loadStateFile(fpath,"user")
            })
        });
        //console.log(this.state.user);
        return this.state.user;
    }

    static loadStateFile(fpath, mode, data){
        const fbuffer = fs.readFileSync(fpath).slice(256),
            ciphertext = CryptoJS.lib.WordArray.create(fbuffer);
        let deserialized,
            key;
        switch(mode){
            case 'global':           
                //const hardkey = data;
                key = CryptoJS.enc.Utf8.parse(hardkey);
                CryptoJS.pad.Pkcs7.pad(key, 4);
                //console.log(key);
                //console.log(Buffer.from(key.toString(CryptoJS.enc.Hex),'hex'));
                break;
            case 'user':
                const sys_sep = fpath.indexOf('/') > -1 ? '/': '\\',
                    l = fpath.split(sys_sep),
                    ll = l.length;
                key = CryptoJS.SHA1(`${l[ll-1]}-${l[ll-2]}`)
                              .toString(CryptoJS.enc.Hex).substr(2,16);
                //console.log(key);
                key = CryptoJS.enc.Utf8.parse(key);
                break;
        }
        deserialized = CryptoJS.AES.decrypt(
            { ciphertext:ciphertext},
            key,
            {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7,
            }).toString(CryptoJS.enc.Utf8);
        deserialized = JSON.parse(deserialized);
        return deserialized
    }


    static loadStateFile0(fpath, mode, data){
        console.log('haha');
        const fbuffer = fs.readFileSync(fpath).slice(256);
        let deserialized, serialized,
            key, algo;
        switch(mode){
            case 'global': 
            case 'store':         
                key = Buffer.from(hardkey, 'utf8');
                const distLen = ((hardkey.length >>> 4) + 1) << 4;
                const padInt = distLen - hardkey.length; 
                const padBuffer = Buffer.alloc(padInt,padInt);
                key = Buffer.concat([key, padBuffer]);
                break;
            case 'user':
                const sys_sep = fpath.indexOf('/') > -1 ? '/': '\\',
                    paths = fpath.split(sys_sep),
                    pathsLen = paths.length;
                key = `${paths[pathsLen-1]}-${paths[pathsLen-2]}`;
                key = crypto.createHash('sha1').update(key).digest('hex').substr(2,16);
                key = Buffer.from(key, 'utf8');
                break;
        }
        algo = `aes-256-ecb`;

        if (mode === "store"){
            //prepare file headers
            const paths = fpath.split(path.sep);
            const base = paths.slice(-1)[0];
            const dir = paths.slice(-2)[0];  
            let header = new Buffer.alloc(256);
            header.writeUInt32BE(1684108385, 0); // index 0 signature
            header.writeUInt32BE(3,4); // index 4 schema version 1,2,3
            header.write(base, 8, base.length, 'utf8'); // index 8 
            header.write(dir, 74, dir.length, 'utf8'); // index 74
            header.writeUInt16BE(dir.length,106); // index 106-107
            header.writeUInt16BE(base.length,72); // index 72-73      
            //encrypt data
            const dataBuf = new Buffer.from(JSON.stringify(data),'utf8');
            const encipher = crypto.createCipheriv(algo, key, "");
            serialized = [encipher.update(dataBuf),encipher.final()];
            serialized = Buffer.concat(serialized);
            //add header
            const shaHash = crypto.createHash('sha1').update(serialized).digest('hex');
            header.write(shaHash, 108, 40, 'utf8'); // index 108-147
            serialized = Buffer.concat([header, serialized]);
            //write to file
            fs.writeFileSync(fpath, serialized);
            return fpath
        }   
        const decipher = crypto.createDecipheriv(algo, key.slice(0,32), "");
        deserialized = decipher.update(fbuffer).toString('utf8');
        deserialized += decipher.final();
        deserialized = JSON.parse(deserialized); 
        console.log(deserialized);   
        return deserialized
    }

    getDeviceId(){
        return this.getGlobalState().device.deviceId;
    }

    getUserBookItems(){
        let userBookItems = {};
        for (const [user, state] of Object.entries(this.getUserState())){
            userBookItems[user] = Object.entries(state.download.downloadMap)
                            .map(
                                ([bid,b]) => {
                                    return {
                                        bId: bid,
                                        title: b.title.main,
                                        fileSize: b.fileSize
                                    }      
                                }
                            );
        }
        return userBookItems
    }

    getUserLibrary(){
        this.initialize();
        let userLibrary = {};
        let upath, bpath, kpath, title, author;
        for(const [user,state] of Object.entries(this.state.user)){
            upath = !state.userSetting.filePath ? 
                                        path.join(this.userDataPath, "library", user)
                                        : state.userSetting.filePath;
            if (!fs.existsSync(upath) || !getDirectories(upath)) continue;
            userLibrary[user] = {};
            userLibrary[user].path = upath;
            userLibrary[user].books = []
            for(const [bid, book] of Object.entries(state.book.downloaded)){
                //TMP: only allow epub
                if (book.format !== "epub" && book.format !== "pdf") continue;
                bpath = path.join(upath, bid, bid.concat('.', book.format));
                kpath = path.join(upath, bid, bid.concat(".dat"));
                if (!fs.existsSync(bpath) || !fs.existsSync(kpath)) continue;
                title = book.title.main;
                author = book.authors.slice(0,3).map(a => a.name).join(",");
                userLibrary[user].books.push({
                    title: title,
                    author: author,
                    bookFile: bpath,
                    keyFile: kpath,
                    format: book.format
                });
            }
        }
        return userLibrary;
    }
}




class BookCryptoProvider{
    
    get bufferSize() {
        return this.fileFormat === 'pdf' ? 1024 * 1024 * 1024 : null
    }

    constructor(deviceId) {
        this.deviceId = deviceId;
    }

    async getContentKey(keyFile, format) {
        const deviceId = this.deviceId;
        if (format === 'zip')
            return deviceId.substr(2, 16);

        else {
            const deviceIdHead = deviceId.substr(0, 16); 
            const decrypted = await this.decryptFileStream(keyFile, deviceIdHead, 'utf8');
            return decrypted.substr(deviceId.length + 32, 16);
        }
    }

    wordArrayToBuffer(wordArray){
        let buffer = Buffer.alloc(wordArray.sigBytes);
        let bite;
	    for (var i = 0; i < wordArray.sigBytes; i++) {
	            bite = (wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                buffer.writeUInt8(bite, i);
	        }
        return buffer;
    }

    async decryptFileStream(input, contentKey, mode = "file", outputFile){
        const key = Buffer.from(contentKey, 'binary');
        const headerStream = fs.createReadStream(input, {start: 0, end: 15});
        const ivBuffers = [];
        await new Promise(
            res => {
                headerStream.on('data', chunck => ivBuffers.push(chunck));
                headerStream.on('end', res);
            }
        );
        const iv = Buffer.concat(ivBuffers);
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        const inputStream = fs.createReadStream(input, {start: 16}).pipe(decipher);
        switch (mode){
            case "file":
                const outputStream = fs.createWriteStream(outputFile);
                inputStream.pipe(outputStream);
                return await new Promise(
                    res => {
                        outputStream.on('finish', () => {
                            console.log("[DECRYPTED]", fs.statSync(outputFile).size);
                            res(outputFile)
                        });
                        inputStream.on('error',(err)=>{
                            fs.existsSync(outputFile) && fs.rmSync(outputFile);
                            console.log("[DECRYPT ERROR]");
                            console.log(err);
                            //outputStream.write(decipher.final());
                            res(void 0);
                        })
                    }
                )
            case "utf8":
                const outputBuffers = [];     
                inputStream.on('data', chunck => {outputBuffers.push(chunck)});
                await new Promise(res => inputStream.on('end', res));
                return Buffer.concat(outputBuffers).toString('utf8');
        }     
    }

    async decryptBook(book, outputDir) {
        const contentKey = await this.getContentKey(book.keyFile, book.format);
        let outputFile, output;
        const title = book.title.replace(/[/\\?%*:|"<>]/g, '-');
        switch(book.format){
            case 'epub':
            case 'pdf':
                outputFile = path.join(outputDir, `${title}.${book.format}`);
                outputFile = await this.decryptFileStream(book.bookFile, 
                                            contentKey, "file", outputFile);
                break;
            case 'zip':
                break;
        }
        return outputFile;
    }

}



class DRMEmitter extends events {};
const drmEmitter = new DRMEmitter();
drmEmitter.drmEvents = {
    launch: 'launch',
    run: 'run',
    taskStart: 'task-start',
    onNewUser: 'on-new-user',
    onNewBook: 'on-new-book',
    beforeTaskDone: 'before-task-done',
    taskDone: 'task-done',
    noData: 'no-data',
    allDone: 'all-done'
};
drmEmitter.on(drmEmitter.drmEvents.run, (userDataPath, outputDir) => {
    removeBookDrms(userDataPath, outputDir);
});


const onLaunchListener = async (userDataPath) => {
    if (fs.existsSync(userDataPath)){     
        console.log("[RIDIBOOKS FOUND]", userDataPath);
        hardkey = await keytar.getPassword('com.ridi.books','global');
        hardkey = Buffer.from(hardkey, "base64").toString('utf8');
        drmEmitter.emit(drmEmitter.drmEvents.allDone);
    }
};
const initializer = new Promise(res => {
    drmEmitter.on(drmEmitter.drmEvents.allDone, res);
})
drmEmitter.on(drmEmitter.drmEvents.launch, onLaunchListener);


async function removeBookDrms(userDataPath, outputDir){
    let stateManager, deviceId;
    await initializer;
    !fs.existsSync(outputDir) && fs.mkdirSync(outputDir, {recursive:true});
    try{
        stateManager = new StateManager(userDataPath);
        deviceId = stateManager.getDeviceId();
    }catch{
        drmEmitter.emit(drmEmitter.drmEvents.noData);
        return void 0;
    }
    const userLibrary = stateManager.getUserLibrary();
    const cryptoProvider = new BookCryptoProvider(deviceId);
    let upath;
    let parsed = 0;
    drmEmitter.emit(drmEmitter.drmEvents.taskStart, userLibrary);
    for (const [user, lib] of Object.entries(userLibrary)){
        drmEmitter.emit(drmEmitter.drmEvents.onNewUser, user, lib.books);
        upath = path.join(outputDir, user);
        !fs.existsSync(upath) && fs.mkdirSync(upath);
        for (const book of lib.books){
            drmEmitter.emit(drmEmitter.drmEvents.onNewBook, `${book.title}.${book.format}`);
            bpath = await cryptoProvider.decryptBook(book, upath); 
            parsed += 1;
        }
    }
    drmEmitter.emit(drmEmitter.drmEvents.taskDone);
}



module.exports = {
    StateManager,
    removeBookDrms,
    drmEmitter,
}

