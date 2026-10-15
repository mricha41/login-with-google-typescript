import process from 'process';
import fs from 'fs/promises';
import Debug from 'debug';
const debug = Debug('login-with-google-typescript:server');
import https from 'https';
import createError from 'http-errors';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { createServer as viteCreateServer}  from 'vite';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import favicon from 'serve-favicon';
import helmet from 'helmet';
import csrf from '@dr.pogodin/csurf';
import passport from 'passport';
import { Pool, PoolOptions } from 'pg';
import { SessionStore } from './session/session_store.js';

import { indexRouter } from './routes/index/index.js';
import { GoogleLogin } from './routes/login/google/google.js';
import { logger, LogRequest } from './logger.js';

function LogAllRequests (req: LogRequest, res: Response, next: NextFunction) {

  const start = performance.now();
  
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const { method, url, ip, headers } = req;
  const userAgent = headers["user-agent"];

  req.logger = logger.child({
    request_id: requestId,
  });

  req.logger.info(`${method} request to ${url}`, {
    method,
    url,
    ip,
    user_agent: userAgent,
  });

  res.on("finish", () => {

    const { statusCode } = res;

    const logData = {
      duration_ms: performance.now() - start,
      status_code: statusCode,
    };

    if (statusCode >= 500) {
      req.logger.error("server error", logData);
    } else if (statusCode >= 400) {
      req.logger.warn("client error", logData);
    } else {
      req.logger.info("request completed", logData);
    }

  });

  next();
  
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.ENV_LEGACY) {
  process.loadEnvFile(path.join(__dirname, ".env"));
}

console.log(`Running in [${process.env.NODE_ENV}] mode`);

if (process.env.NODE_ENV === "development") {
  
  console.log(`Root folder: ${path.join(__dirname, '../..')}`)
  
  console.log(path.resolve(path.join(__dirname)));
  //console.log(process.env);

}

var port = normalizePort(process.env.PORT || '3000');

let key = await fs.readFile(`${process.env.KEY}`);
let cert = await fs.readFile(`${process.env.CERT}`);

var options = {
  key: key,
  cert: cert
};

var app = express();
app.set('port', port);
var server = https.createServer(options, app);

if (process.env.NODE_ENV === "development") {

    const viteServer = await viteCreateServer({
    appType: 'custom',
    server: {
        middlewareMode: true,
        hmr: {
            server
        }
    }
    });

    app.use(viteServer.middlewares);

}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

//app.use(logger('dev'));

app.use(favicon(path.join(__dirname,'public','images','favicon.ico')));

if (process.env.NODE_ENV === "development") {

  app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        //wss is for vite web socket
        "connect-src": ["'self'", `wss://${process.env.HOST}:${process.env.PORT}`],
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        //unsafe-inline ONLY during development
        //production SHOULD use css LINK tags instead
        //of vite's css ESM style imports 
        //(import "./styles.css" for example)
        "style-src": ["'self'", "'unsafe-inline'"],
        "object-src": ["'none'"],
        "font-src": ["'self'"],
        "frame-src": ["'none'"],
        "frame-ancestors": ["'none'"]
      },
    },
  }),
);

} else {

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          "connect-src": ["'self'"],
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'"],
          "object-src": ["'none'"],
          "font-src": ["'self'"],
          "frame-src": ["'none'"],
          "frame-ancestors": ["'none'"]
        },
      },
    }),
  );

}

app.disable("x-powered-by");

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

function normalizePort(val: number | string) {
  var port = typeof val === "string" ? parseInt(val, 10) : val;

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

function onError(error: NodeJS.ErrnoException) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : addr ? 'port ' + addr.port : null;
  debug('Listening on ' + bind);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));

if (process.env.NODE_ENV === "development") {
  app.use(express.static(path.join(__dirname, '../..')));
}

app.use((req: Request, res: Response, next: NextFunction) => { //log every request

  LogAllRequests(req as LogRequest, res, next);

});

const poolOptions: PoolOptions = {
    host: `${process.env.DATABASE_HOST}`,
    user: `${process.env.DATABASE_USER}`,
    port: normalizePort(`${process.env.DATABASE_PORT}`) as number,
    password: `${process.env.DATABASE_PASSWORD}`,
    database: `${process.env.DATABASE}`,
    max: 20, //https://node-postgres.com/guides/pool-sizing
    maxUses: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    maxLifetimeSeconds: 60,
    allowExitOnIdle: false
};

try {
    
    const pool = new Pool(poolOptions);
    const sessionStore = new SessionStore(pool);
    
    /*console.log("checking session store...");
    sessionStore.all((error, sessions) => {
        if (error) {
            console.log(error);
        }
        if (sessions) {
            console.log(sessions);
        }
    });*/

    /*sessionStore.clear((error) => {
        
        if (error) {
            console.log(error);
        }

    })*/

    /*sessionStore.length((error, length: number) => {
        if (error) {
            console.log(error);
        }
        if (length) {
            console.log(`live sessions: ${length}`);
        }
    })*/

    app.use(session({
        secret: `${process.env.SESSION_SECRET}`,
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' },
        store: sessionStore
    }));

    app.use(csrf());

    //context.express_app.use(passport.initialize());
    app.use(passport.authenticate('session'));

    app.use(function(req, res, next) {
        res.locals.csrfToken = req.csrfToken();
        next();
    });

    app.use(GoogleLogin(pool));

} catch (error) {
    console.log(error)
}

app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function(_req: Request, _res: Response, next: NextFunction) {
  next(createError(404));
});

// error handler
//type ErrorRequestHandler has err: any as its error parameter
app.use(function(err: any, req: Request, res: Response, _next: NextFunction) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({ error: err });
});
