const path = require('path');
const fs = require('fs');

const { ipcRenderer } = require('electron');
const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;

const {drmEmitter, removeBookDrms} = require('./drm.js');
const drmEvents = drmEmitter.drmEvents;

const systemUserDataPath = path.dirname(app.getPath('userData'));
const ridiUserDataPath = path.join(systemUserDataPath, "Ridibooks");
const ridiGlobalStatePath = path.join(ridiUserDataPath, "datastores", "global");
const ridiUserStatePath = path.join(ridiUserDataPath, "datastores", "user");


// state
const stateFile = `${app.getPath('userData')}/state.json`;
let state;
const saveState = () => {
    state = {
        outputDir: outputDir,
    }
    fs.writeFileSync(stateFile, JSON.stringify(state));
}
const loadState = () => {
    if (!fs.existsSync(stateFile))
        state = {};
    else
        state = JSON.parse(fs.readFileSync(stateFile))
}
loadState();


// Remove default menu
const menu = electron.Menu.buildFromTemplate([]);
electron.Menu.setApplicationMenu(menu);


// Create & config main window
let mainWindow = null; // #A
const mainWindowConfig = {
    width: 450,
    height: 300,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: false,
    }
};
function initMainWindow(){
    mainWindow = new BrowserWindow(mainWindowConfig);
    mainWindow.webContents.loadURL(`file://${__dirname}/index.html`); // #A
    electron.globalShortcut.register('CommandOrControl+I', ()=>{
        mainWindow.webContents.openDevTools();
    });
}


// Main logic
// select output dir
let outputDir = state.outputDir || app.getPath('userData');
ipcMain.on('select-output-dir', async (event, arg) => {
    const result = await electron.dialog.showOpenDialog(mainWindow, 
                                 {properties: ['openDirectory']});
    if ( !result.canceled && !!result.filePaths[0])
        outputDir = path.resolve(result.filePaths[0]);
        console.log("SELECTED DIR: ", result);
        event.reply('selected-output-dir', outputDir);
});
ipcMain.on('get-output-dir', (event) => {
    event.returnValue = outputDir;
});


// run
const isRidiLaunched = function(){
    const r = fs.existsSync(ridiGlobalStatePath) && fs.existsSync(ridiUserStatePath);
    return r;
};
const taskStartListener = function(userLibrary){
    const users = Object.values(userLibrary);
    const usersCount = users.length;
    const books = users.reduce((result, item) => {
        result.push.apply(result, item.books);
        return result;
    },[]);
    const booksCount = books.length;
    console.log(`[TASK START] ${usersCount} users, ${booksCount} books.`);
    mainWindow.webContents.send(drmEvents.taskStart, usersCount, booksCount);
};
const onNewUserListener = function(userName, books){
    const booksCount = books.length;
    console.log(`[ON NEW USER] ${userName}`);
    mainWindow.webContents.send(drmEvents.onNewUser, userName, booksCount);
};
const onNewBookListener = function(bookFile){
    console.log(`[ON NEW BOOK] ${bookFile}`);
    mainWindow.webContents.send(drmEvents.onNewBook, bookFile);
};
const taskDoneListener = function(){
    console.log(`[TASK DONE]`);
    mainWindow.webContents.send(drmEvents.taskDone, outputDir);
} 
const beforTaskDoneListener = function(){
    console.log(`[BEFORE TASK DONE]`);
    mainWindow.webContents.send(drmEvents.beforeTaskDone);
};
const noDataListener = function(){
    mainWindow.webContents.send(drmEvents.noData);
}
//
drmEmitter.on(drmEvents.taskStart, taskStartListener);
drmEmitter.on(drmEvents.onNewUser, onNewUserListener);
drmEmitter.on(drmEvents.onNewBook, onNewBookListener);
drmEmitter.on(drmEvents.taskDone, taskDoneListener);
drmEmitter.on(drmEvents.beforeTaskDone, beforTaskDoneListener);
drmEmitter.on(drmEvents.noData, noDataListener);
//
const runRemoveDrm = function(event){
    if (!isRidiLaunched()){
        mainWindow.webContents.send(drmEvents.noData);
        return void 0;
    } 
    //drmEmitter.emit(drmEvents.run, ridiUserDataPath, outputDir);
    removeBookDrms(ridiUserDataPath, outputDir);
    console.log("[IM IN MAIN]");
};
ipcMain.on('run', runRemoveDrm);
//
ipcMain.on('show-output-dir', (event) => {
    electron.shell.openPath(outputDir);
});
ipcMain.on('log', (event,...args) => {
    console.log(...args);
});



// App lifecycle
app.on('ready', () => {
    console.log('[ELECTRON READY]');
    initMainWindow();
    drmEmitter.emit(drmEvents.launch, ridiUserDataPath);
});
const finisher = new Promise(res => {
    drmEmitter.on(drmEvents.allDone, res);
});
app.on('window-all-closed', async (event) => {
    //event.preventDefault();
    await finisher;
    saveState();
    app.quit();
});
