import express from 'express';
import { Request, Response, NextFunction } from 'express';
import passport from "passport";
import { Strategy } from "passport-google-oauth20";
import { Pool } from 'pg';

//this is here for now to support older
//versions of Node that do not provide support
//for loading .env files
if (!process.env.ENV_LEGACY) {
  process.loadEnvFile("./src/server/.env");
}

function GoogleLogin (pool: Pool) {

  let googleRouter = express.Router();

  const PROVIDER = 'google';

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  
  const GoogleStrategyOptions = {
      clientID: `${GOOGLE_CLIENT_ID}`,
      clientSecret: `${GOOGLE_CLIENT_SECRET}`,
      callbackURL: `https://${process.env.HOST}:${process.env.PORT}/auth/google/callback`,
      //proxy: true,
      //state: true
  };

  const GoogleStrategy = new Strategy(GoogleStrategyOptions,
    (_accessToken, _refreshToken, profile, cb) => {

      pool.query('SELECT * FROM users WHERE provider = $1 AND provider_id = $2', [
        PROVIDER,
        profile.id
      ], function(error, result) {
        if (error) { return cb(error); }
        if (!result.rows.length) {
          pool.query('INSERT INTO users (provider, provider_id, display_name, name, photos, emails) VALUES ($1, $2, $3, $4, $5, $6)', [
              PROVIDER,
              profile.id,
              profile.displayName,
              profile.name || '',
              JSON.stringify(profile.photos) || JSON.stringify([]),
              JSON.stringify(profile.emails) || JSON.stringify([])
            ], function(err) {
              if (err) { return cb(err); }
              var user = {
                id: profile.id,
                name: profile.displayName
              };
              return cb(null, user);
          });
        } else {
          pool.query('SELECT * FROM users WHERE provider_id = $1', [ result.rows[0].provider_id ], function(error, result) {
            if (error) { return cb(error); }
            if (!result) { return cb(null, false); }
            return cb(null, result.rows[0]);
          });
        }
      });

    }
  );

  passport.serializeUser(function(user: Express.User, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

  passport.deserializeUser(function(user: Express.User, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

  passport.use(GoogleStrategy);

  googleRouter.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

  googleRouter.get(
    '/auth/google/callback',
    passport.authenticate('google', { 
      failureRedirect: '/',
      successReturnToOrRedirect: '/'
    })
  );

  googleRouter.get('/auth/google/user', (req: Request, res: Response, _next: NextFunction) => {

    if (req.user) {
      res.send(req.user);
    } else {
      res.status(401).send(null);
    }

  });

  googleRouter.post('/auth/google/logout', function(req: Request, res: Response, _next: NextFunction) {

    req.logout( (err) => {
      if (err) { return _next(err); }
      res.redirect('/');
    });

  });

return googleRouter;

}

export { GoogleLogin };