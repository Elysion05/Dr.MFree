const { ipcMain } = require('electron');
const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const app = electron.app;

// Get element objects
const body = document.getElementsByTagName('body')[0];
const outputDirConfig =  document.getElementById('output-dir-config');
const outputDirValue = document.getElementById('output-dir-value');
const mainLogEntry = document.getElementById('main-log-entry');
const mainLogText = document.getElementById('main-log-text');
const mainLogSub = document.getElementById('main-log-sub');
const runProgress = document.getElementById('run-progress')
const runButton = document.getElementById('run-button');


//body.addEventListener('mouseover',(event) => {
//    ipcRenderer.send('log','[MOUSE OVER]');
//    electron.remote.app.focus();
//});


// Initialize contents
const switchMainLogEntry = (mode)=>{
    if (mode === "on")
        mainLogEntry.style.display = "flex";
    else
        mainLogEntry.style.display = "none";
};
outputDirValue.innerHTML = ipcRenderer.sendSync('get-output-dir');
//switchMainLogEntry("off");


// Interaction logic
const makeUnclickable = (item, clickListener) =>{
    item.removeEventListener('click', clickListener);
    item.classList.remove("clickable");
}
const makeClickable = (item, clickListener) =>{
    item.addEventListener('click', clickListener);
    item.classList.add("clickable");
}
const getFirstTextChild = (item) => {
    let childNodes = item.childNodes;
    for (const n of childNodes){
        if (n.nodeName === "#text")
            return n;
    }
    return void 0
};
const getFirstDivChild = (item) => {
    let childNodes = item.childNodes;
    for (const n of childNodes){
        if (n.nodeName === "DIV")
            return n;
    }
    return void 0
};
const setTextChildText = (item, str) => {
    const firstChildNode = getFirstTextChild(item);
    if (!!firstChildNode)
        firstChildNode.nodeValue = str;
};
const setDivChildText = (item, str) => {
    const firstChildNode = getFirstDivChild(item);
    str = str.length >= 60 ? str.slice(0,60).concat("...") : str;
    if (!!firstChildNode)
        firstChildNode.innerHTML = str;
};
// select output dir
const setOutputDir = (outputDir) =>{
    outputDirValue.innerHTML = outputDir;
};
const clickOutputDirConfig = async (event) => {
    event.preventDefault();
    ipcRenderer.send('select-output-dir');  
};
ipcRenderer.on('selected-output-dir', (event, outputDir) =>{
    setOutputDir(outputDir);
});
makeClickable(outputDirConfig, clickOutputDirConfig);


// run
let runProcess;
class RunProcess{
    constructor(usersCount, booksCount){
        this.usersCount = usersCount;
        this.booksCount = booksCount;
        this.processedBooksCount = 0;
        this.processedUsersCount = 0;
        this.percent = "0".concat("%");
    
    }
    addOneBook(){
        this.processedBooksCount += 1;
    }
    addOneUser(){
        this.processedUsersCount += 1;
    }
    getPercent(){
        if (this.booksCount !== 0) 
            this.percent = Math.floor(this.processedBooksCount/this.booksCount*100)
                            .toFixed(0).concat("%");
        return this.percent;
    }
}
const clickMainLogEntry = function(event){
    ipcRenderer.send('show-output-dir');
}
const renderTaskStart = function(event, usersCount, booksCount){
    setTextChildText(mainLogText, "Started");
    setDivChildText(mainLogText, "Loading local library...");
    runProcess = new RunProcess(usersCount, booksCount);
};
const renderOnNewUser = function(event, userName, booksCount){
    setTextChildText(mainLogText, userName);
    runProcess.addOneUser()
    switchMainLogEntry("on");
};
const renderOnNewBook = function(event, bookFile){
    runProcess.addOneBook()
    runProgress.innerHTML = runProcess.getPercent();
    setDivChildText(mainLogText, bookFile);   
};
const renderBeforeTaskDone = function(event){
    setTextChildText(mainLogText, "Pending");
    setDivChildText(mainLogText, "Preparing book files...");
}
const renderNoRidibooksData = function(){
    runProgress.style.visibility = "hidden";
    setTextChildText(mainLogText, "Oops! Can't find any local data.");
    let info = `Please download some books in Ridibooks app and try again.`
    setDivChildText(mainLogText, info);
    runButton.innerHTML = "ReRUN";
    makeClickable(runButton, clickRunButton);
    makeClickable(outputDirConfig, clickOutputDirConfig);
};
const renderTaskDone = function(event, outputDir){
    runProgress.style.visibility = "hidden";
    if (runProcess.processedBooksCount > 0){
        setTextChildText(mainLogText, "All done! Click to check your output directory.");
        let info = `Processed ${runProcess.usersCount} users, ${runProcess.booksCount} books.`
        setDivChildText(mainLogText, info);
        makeClickable(mainLogEntry, clickMainLogEntry);
    }else{
        setTextChildText(mainLogText, "Oops! Seems like you didn't download any books.");
        let info = `Please download some books in Ridibooks app and try again.`
        setDivChildText(mainLogText, info);
    }
    runButton.innerHTML = "ReRUN";
    makeClickable(runButton, clickRunButton);
    makeClickable(outputDirConfig, clickOutputDirConfig);
};
const {drmEmitter} = require('./drm.js');
const drmEvents = drmEmitter.drmEvents;
ipcRenderer.on(drmEvents.taskStart, renderTaskStart);
ipcRenderer.on(drmEvents.onNewUser, renderOnNewUser);
ipcRenderer.on(drmEvents.onNewBook, renderOnNewBook);
ipcRenderer.on(drmEvents.taskDone, renderTaskDone);
ipcRenderer.on(drmEvents.beforeTaskDone, renderBeforeTaskDone);
ipcRenderer.on(drmEvents.noData, renderNoRidibooksData);
const clickRunButton = (event) => {
    //event.preventDefault();
    makeUnclickable(runButton, clickRunButton);
    makeUnclickable(outputDirConfig, clickOutputDirConfig);
    makeUnclickable(mainLogEntry, clickMainLogEntry);
    mainLogText.classList.remove('init');
    runProgress.innerHTML = "0%";
    runProgress.style.visibility = "visible";
    process.nextTick(ipcRenderer.send, "run");
    ipcRenderer.send('log', '[IM IN RENDERER]');
};
makeClickable(runButton, clickRunButton);




