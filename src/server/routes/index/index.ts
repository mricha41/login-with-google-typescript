import path from 'path';
//import path, { dirname } from 'path';
//import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import express, { Request, Response, NextFunction } from 'express';
var indexRouter = express.Router();

//const __filename = fileURLToPath(import.meta.url);
//const __dirname = dirname(__filename);

const entrypoint = "src/client/components/index/index";

let viteInject = "";

//this is here for now to support older
//versions of Node that do not provide support
//for loading .env files
if (!process.env.ENV_LEGACY) {
  process.loadEnvFile("./src/server/.env");
}

//console.log(process.env)

if (process.env.NODE_ENV === "development") {
  viteInject = `
    <script type="module" src="https://${process.env.HOST}:${process.env.PORT}/@vite/client"></script>
    <script type="module" src="https://${process.env.HOST}:${process.env.PORT}/${entrypoint}.js"></script>
  `
} else {

    const pathToManifest = path.resolve('./src/server/dist/.vite/manifest.json');
    
    fs.readFile(
      //new URL(pathToManifest),
      pathToManifest,
      'utf-8'
    ).then((file) => {

        const manifest = JSON.parse(
            file
        );

        const index = manifest[`${entrypoint}.ts`];
        //console.log(index)
        
        viteInject = `
            ${index.css.map((href: string) => `<link rel="stylesheet" href="${href}" />`)}
            <script type="module" src="${index.file}"></script>
        `;

    });

}

indexRouter.get('/', (_req: Request, res: Response, _next: NextFunction) => {
  
  res.render('index.ejs', { viteInject: viteInject, canonical: `${process.env.CANONICAL}` });

});

export { indexRouter };
