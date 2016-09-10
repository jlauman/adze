

const APP_NAME    = "demo";
const APP_VERSION = "1.0.0";
const APP_PORT    = 8080;


const fs   = require('fs');
const http = require('http');
const os   = require('os');
const path = require('path');
const url  = require('url');


const BIN_FOLDER = path.resolve(__dirname, 'bin');
const ELM_FOLDER = path.resolve(__dirname, 'elm');
const LOG_FOLDER = path.resolve(__dirname, 'log');
const OUT_FOLDER = path.resolve(__dirname, 'out');
const TMP_FOLDER = path.resolve(__dirname, 'tmp');
const WEB_FOLDER = path.resolve(__dirname, 'web');


const ELM_MAKE = path.resolve(__dirname, 'bin', (os.platform() == 'win32' ? 'elm-make.exe' : 'elm-make'));

const FILES = {};

const exec = require('child_process').exec;


const cmdHelp = function (name, mesg) {
  if (mesg) { console.log('adze: ' + mesg); }
  console.log(`
node adze.js <command>

  help  Print help information for the adze.js tool.
  init  Initialize Elm project folder inside 'elm' folder.
  make  Start make tool to watch and compile Elm files.
  pack  Package Elm projects into single JavaScript file.
  host  Start host mode to serve packaged projects.
  `);
  process.exit(0);
};


/**
 * @function errorExit
 * @param message the message to print before existing
 * @returns exists process (no return)
 * The errorExit functions is called for JavaScript errors and exceptions.
 */
const errorExit = function (message) {
  console.error('ERROR ', message);
  process.exit(1);
};


let cmd = [];
process.argv.forEach((arg, i) => {
  if (i <= 1) {
    let name = arg.split(path.sep).pop();
    if (i == 0) { return true; }
    else if (i == 1 && name == 'adze.js') { return true; }
    else { cmd.push('host'); return true }
  }
  else if (arg == 'help') { cmd.push('help'); return true; }
  else if (cmd[0] == 'help') { cmd.push(arg); return false; }
  else if (arg == 'init') { cmd.push('init'); return true; }
  else if (cmd[0] == 'init') { cmd.push(arg); return false; }
  else if (arg == 'make') { cmd.push('make'); return true; }
  else if (cmd[0] == 'make') { cmd.push(parseInt(arg, 10)); return false; }
  else if (arg == 'pack') { cmd.push('pack'); return true; }
  else if (cmd[0] == 'pack') { cmd.push(arg); return false; }
  else if (arg == 'host') { cmd.push('host'); return true; }
  else if (cmd[0] == 'host') { cmd.push(arg); return false; }
  else { cmdHelp(null, 'no command "' + arg + '"'); process.exit(1); }
});



//
// Check working folders and create if missing.
//
// FIXME: When in production mode only prod folders should be created.
//
let FOLDERS = [BIN_FOLDER, ELM_FOLDER, LOG_FOLDER, OUT_FOLDER, TMP_FOLDER, WEB_FOLDER];
if (cmd[0] == 'host') { FOLDERS = [LOG_FOLDER]; }

FOLDERS.forEach((folder) => {
  try {
    let s = fs.statSync(folder);
    if (s.isFile()) { errorExit('expected folder, but found file for: ' + folder); }
  } catch (err) {
    fs.mkdirSync(folder);
    let s = fs.statSync(folder);
    if (!s.isDirectory()) { errorExit('failed to make folder for: ' + folder); }
  }
});


setTimeout(() => {
  if (cmd[0] == 'help') { cmdHelp(cmd[1]); }
  else if (cmd[0] == 'make') { cmdMake(cmd[1]); }
  else if (cmd[0] == 'init') { cmdInit(cmd[1]); }
  else if (cmd[0] == 'pack') { cmdPack(cmd[1]); }
  else if (cmd[0] == 'host') { cmdHost(cmd[1]); }
  else { errorExit('bad cmd: ' + JSON.stringify(cmd)); }
}, 0);


const cmdInit = function (name) {
  console.log('adze init ' + name);
  try {
    let f1 = path.resolve(ELM_FOLDER, name);
    try { fs.statSync(f1); } catch (err) { 
      fs.mkdirSync(f1); fs.statSync(f1); 
      fs.writeFileSync(path.resolve(f1, 'main.elm'), FILES['/demo/main.elm']()); 
    }
    let f3 = path.resolve(TMP_FOLDER, name);
    try { fs.statSync(f3); } catch (err) { 
      fs.mkdirSync(f3); fs.statSync(f3); 
    }
    let f4 = path.resolve(WEB_FOLDER, name);
    try { fs.statSync(f4); } catch (err) { 
      fs.mkdirSync(f4); fs.statSync(f4); 
      fs.writeFileSync(path.resolve(f4, 'index.html'), FILES['/demo/index.html'](name)); 
      fs.writeFileSync(path.resolve(f4, 'index.css'), FILES['/demo/index.css'](name)); 
    }
    console.log('elm-init: preparing elm packages\nelm-init: please wait...');
    const execSync = require('child_process').execSync;
    let stdout = execSync(ELM_MAKE + ' --yes', { cwd: f3, encoding: 'utf8' });
    console.log(stdout);
    console.log('elm-init: done');
  } catch (err) {
    errorExit(err);
  }
}


//
// HTTP SERVER
//

const cmdMake = function (port) {
  try {
     // windows behaves like F_OK; must just try exec...
    fs.accessSync(ELM_MAKE, fs.constants.X_OK);
    const execSync = require('child_process').execSync;
    const line0 = 'elm-make 0.17.1 (Elm Platform 0.17.1)';
    let stdout = execSync(ELM_MAKE + ' --help', { cwd: TMP_FOLDER, encoding: 'utf8' });
    let lines = stdout.split('\n').map((line) => line.trim());
    if (lines[0] !== line0) {
      errorExit('unexpected elm-make version: ' + lines[0]);
    }
  } catch (err) {
    errorExit(err);
  }  

  let server = cmdHost(port);

  let ws = null;
  let wss = new WebSocketServer({ server: server });  
  wss.on('connection', function (ws2) {
    ws2.on('message', function (message) {
      if (message === 'ready') { ready = true; }
      console.log('wss received: %s', message);
      // ws.send('wss received ' + message);
    });
    ws = ws2;
  });

  const exec = require('child_process').exec;

  let compileElm = (filename) => {
    let srcelm = path.resolve(ELM_FOLDER, filename);
    let dstelm = path.resolve(TMP_FOLDER, filename);      
    fs.writeFileSync(dstelm, fs.readFileSync(srcelm));
    let webjs  = path.resolve(WEB_FOLDER, filename.replace('.elm', '.js'));
    let dstdir = path.dirname(dstelm);
    exec(ELM_MAKE + ' main.elm --output ' + webjs, { cwd: dstdir}, (err, stdout, stderr) => {
      if (err && !(stderr || stdout)) { console.error(err); }
      if (stderr) { console.error(stderr); }
      else { console.log(stdout); }
      if (ws && stderr) { ws.send(JSON.stringify({'error':stderr})); }
      else if (ws) { ws.send(JSON.stringify({'reload':true})); }
    });
  };

  let watchTimeoutId = null;
  fs.watch(ELM_FOLDER, {recursive: true}, (eventType, filename) => {
    if (!filename.startsWith('elm-stuff') && filename.endsWith('.elm')) {
      if (watchTimeoutId) clearTimeout(watchTimeoutId);
      watchTimeoutId = setTimeout(() => {
        console.log('  eventType=' + JSON.stringify(eventType));
        console.log('  filename=' + JSON.stringify(filename));
        compileElm(filename);
      }, 250);
    }
  });
}


const cmdHost = function (port) {
  if (port == 'NaN') { errorExit('expected integer for port, but found: ' + port); }
  if (!port) { port = 8080; }

  const CONTENT_TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
  const contentType = (fileName) => {
    let ext = path.extname(fileName);
    return CONTENT_TYPES[ext];
  };

  let server = http.createServer((request, response) => {
    let name;
    let pathname = path.posix.normalize(url.parse(request.url).pathname);
    let parts = pathname.split('/').filter((str) => str != '');
    if (parts.length == 0) {
      name = 'root';
      pathname = '/root';
    } else {
      name = parts[0];
    }
    let extname = path.extname(pathname);
    if (extname == '') { pathname = path.posix.join(pathname, 'index.html'); }
    console.log('pathname=' + pathname);
    fileHandler(pathname, (error, filename, content) => {
      if (error) {
        response.writeHead(500, {'Content-Type': 'text/plain'});
        response.write(err + '\n');
        response.end();
      } else if (content) {
        if (pathname.endsWith('/index.html')) {
          content = content.replace('<head>', '<head>\n    <base href="/' + name + '/index.html">');
          if (cmd[0] == 'make') {
            // content = content.replace('</body>', '\n<script>' + FILES['/reload.js']() + '</script>\n  </body>');
            content = content.replace('</body>', '\n    <script src="/reload.js"></script>\n  </body>');
          }
        }
        var headers = {
          'Content-Type': contentType(filename)
        };
        response.writeHead(200, headers);
        response.write(content, 'binary');
        response.end();
      } else {
        response.writeHead(404, {'Content-Type': 'text/plain'});
        response.write('404 Not Found\n');
        response.end();        
      }
    });
  }).listen(port);

  console.log('adze start ' + port + '\npress ctrl+c to exit');

  return server;
}


let fileHandler = null;
if (cmd[0] == 'host') {
  fileHandler = (filename, callback) => {
    let content = FILES[filename];
    if (typeof(content) == 'string') {
      callback(null, filename, content);
    } else if (typeof(content) == 'function') {
      callback(null, filename, content());
    } else {
      callback(null, null, null);
    }
  };  
} else {
  fileHandler = (pathname, callback) => {
    if (pathname == '/reload.js') {
      callback(null, pathname, FILES['/reload.js']());
    } else {
      let filename = path.join(WEB_FOLDER, pathname);
      let s = fs.statSync(filename);
      if (s.isFile()) {
        fs.readFile(filename, 'binary', function(error, content) {
          callback(error, filename, content)
        });
      } else {
        callback(null, null, null);
      }
    }
  };
}


const cmdPack = function (port) {
  const ADZE_FILES = "//--adze--files--//";
  const ADZE_MODULES = "//--adze--modules--//";
  let src1 = fs.readFileSync('./adze.js', { encoding: 'utf8' });
  let lines1 = src1.split('\n').map((line) => line.replace(/\s+$/g, '')); // rtrim
  let adze_files = true;
  lines1 = lines1.filter((line) => line.startsWith(ADZE_FILES) ? adze_files = false : adze_files);
  lines1.push(ADZE_FILES); lines1.push('');
  // read each file in web folder into encoded sring in FILES
  let dirs = fs.readdirSync(WEB_FOLDER);
  let lines2 = dirs.map((dirname) => {
    files1 = fs.readdirSync(path.join(WEB_FOLDER, dirname));
    return files1.map((filename) => {
      let filepath = path.join(WEB_FOLDER, dirname, filename);
      let str1 = fs.readFileSync(filepath, { encoding: 'utf8' });
      let buf1 = Buffer.from(str1, 'utf8');
      let str2 = buf1.toString('base64'); //.replace(/(\n|\r|\+)/gm, ' ');
      let str3 = `
FILES['/${dirname}/${filename}'] = () => (new Buffer("${str2}", "base64")).toString("utf8");
`;
      return str3;      
    });
  });
  lines2 = Array.prototype.concat.apply([], lines2); // simple 1-level array flatten
  // append browserified websocket module
  let wsCode = null;
  if (fs.statSync(path.join(TMP_FOLDER, 'ws.js')).isFile()) { 
    wsCode = fs.readFileSync(path.join(TMP_FOLDER, 'ws.js'), { encoding: 'utf8' });
  }
  // write packaged application file
  let lines3 = lines1.concat(lines2);
  if (wsCode) { lines3.push(''); lines3.push(ADZE_MODULES); lines3.push(''); lines3.push(wsCode); }
  let src3 = lines3.join('\n');
  let outname = `${APP_NAME}-${APP_VERSION}.js`;
  let outpath = path.join(OUT_FOLDER, outname);
  fs.writeFileSync(outpath, src3);
};


//--adze--files--//


FILES['/reload.js'] = () => `
(function (port) {
  let connect = function () {
    let ws = new WebSocket('ws://127.0.0.1:' + port);
    ws.onopen = function () { 
      ws.send('ready');
      let div = document.createElement('div');
      div.setAttribute('style', '' +
        'position:fixed; left:40%; top:0px; width:20%; background-color:#EEE; ' +
        'border:2px solid #666; padding-top:0.12em; text-align:center; ' +
        'font-size: 1.5em; opacity:0.0;');
      div.appendChild(document.createTextNode('RELOAD'));
      document.body.appendChild(div);
      let opacity1 = 0.0; let opacity2 = 1.1;
      let t = setInterval(function (div) {
        let opacity = (opacity1 < 1.0 ? opacity1 += 0.05 : opacity2 -= 0.1);
        if (opacity2 < 0 ) { clearTimeout(t); document.body.removeChild(div); }
        div.style.opacity = opacity;
      }.bind(this, div), 50);
    };
    let div2 = document.createElement('div');
    div2.setAttribute('style', '' +
      'box-sizing:border-box; position:fixed; left:0px; top:0px; width:100vw; height:100vh; ' +
      'border:2px solid #E00; padding:1em; background-color:#EFEFEF; font-size:1em; opacity:0; ');
    let pre2 = document.createElement('pre');
    div2.appendChild(pre2);
    document.body.appendChild(div2);
    ws.onclose = function () { setTimeout(connect, 3000); };
    ws.onmessage = function (event, flags) {
      var data = JSON.parse(event.data);
      if (data.reload) { 
        location.reload(true);
      } else if (data.error) {
        if (pre2.firstChild) { pre2.removeChild(pre2.firstChild); }
        pre2.appendChild(document.createTextNode(data.error));
        div2.style.opacity = 1; 
      }
    };
  };
  connect();
}(location.port));
`;


FILES['/demo/index.html'] = () => `
<!doctype html>
<html lang="">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="description" content="">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>demo</title>
    <base href="/demo">
    <link rel="stylesheet" href="index.css">
  </head>
  <body>
    <div id="main"></div>
    <script src="main.js"></script>
    <script>
      var elt = document.getElementById('main');
      var app = Elm.Main.embed(elt);
    </script>
  </body>
</html>
`;


FILES['/demo/index.css'] = (name) => `
body {
  margin: 0;
  font-family: monospace;
}
`;


FILES['/demo/main.elm'] = () => `
import Html exposing (div, button, text)
import Html.App exposing (beginnerProgram)
import Html.Events exposing (onClick)

main =
  beginnerProgram { model = 0, view = view, update = update }

view model =
  div []
    [ div [] [ text "hello110!" ]
    , div [] [ text "this is a message!" ]
    , button [ onClick Decrement ] [ text "-" ]
    , div [] [ text (toString model) ]
    , button [ onClick Increment ] [ text "+" ]
    ]

type Msg = Increment | Decrement

update msg model =
  case msg of
    Increment ->
      model + 1
    Decrement ->
      model - 1
`;


FILES['/demo/main.js'] = () => ``;


//--adze--modules--//


let WebSocketServer = require('ws').Server;
