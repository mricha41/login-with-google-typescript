import { SessionData, Store } from "express-session";
import { Pool, PoolOptions } from 'pg';

const ONE_DAY = 86400;

const currentTimestamp = () => Math.ceil(Date.now() / 1000);

type ErrorCallback = (error: any) => any;
type Callback = (error: any, data: any) => any;

type SessionStoreOptions = {
    poolOptions?: PoolOptions,
    ttl?: number
};

class SessionStore extends Store {

    private _options: SessionStoreOptions | null;
    private _pool: Pool;

    constructor (pool: Pool, options?: SessionStoreOptions) {

        super();

        options ? this._options = options : this._options = null;
        this._pool = pool;

    } 

    private getExpireTime (session: SessionData) {

      let expire;

      if (session && session.cookie && session.cookie['expires']) {

        const expireDate = new Date(session.cookie['expires']);
        expire = Math.ceil(expireDate.valueOf() / 1000);

      } else {

        const ttl = this._options && this._options.ttl || ONE_DAY;
        expire = Math.ceil(Date.now() / 1000 + ttl);

      }

      return expire;

    }

    public async all (callback: Callback) {

        try {

            const result = await this._pool.query('SELECT * from sessions');

            if (!result){
                return callback(null, null);
            }

            return callback(null, result);

        } catch (error) {

            return callback(error, null);

        }

    }

    public destroy (sid: string, callback: ErrorCallback) {

        this._pool.query('DELETE FROM sessions WHERE session_id = $1 RETURNING *', [sid], error => { callback && callback(error) });

    }

    public async clear (callback: ErrorCallback) {

        try {

            await this._pool.query('TRUNCATE sessions');

        } catch (error: any) {

            return callback(error);
        }

    }

    public async length (callback: Callback) {

        const result = await this._pool.query('SELECT COUNT(*) as count FROM sessions');

        if (!result){
            return callback(null, null);
        } else {
            const count: number = result.rows[0].count;
            return callback(null, count);
        }

    }

   public get (sid: string, callback: Callback) {

        this._pool.query('SELECT session_data FROM sessions WHERE session_id = $1 AND expiration >= to_timestamp($2)', [sid, currentTimestamp()], (error: any, result) => {

            if (error) {
                
                if (error.code === 'ENOENT') { //SEE https://github.com/expressjs/session#compatible-session-stores
                    return callback(null, null);
                }
                return callback(error, null);
                
            }

            if (!result) {
                return callback(null, null);
            }

            try {
                return callback(null, (typeof result.rows[0].session_data === 'string') ? JSON.parse(result.rows[0].session_data) : result.rows[0].session_data);
            } catch {
                return this.destroy(sid, callback as ErrorCallback);
            }
            
        });

    }

    public set (sid: string, session: SessionData, callback: ErrorCallback) {
        
        const expiration = this.getExpireTime(session);
        const query = 'INSERT INTO sessions (session_data, expiration, session_id) VALUES ($1, to_timestamp($2), $3) ON CONFLICT (session_id) DO UPDATE SET session_data=$1, expiration=to_timestamp($2) RETURNING session_id';

        this._pool.query(query, [session, expiration, sid], error => { callback && callback(error) });

    }

    public touch (sid: string, session: SessionData, callback?: ErrorCallback) {

        const expiration = this.getExpireTime(session);

        this._pool.query(
            'UPDATE sessions SET expiration = to_timestamp($1) WHERE session_id = $2 RETURNING session_id',
            [expiration, sid],
            err => { 
                callback && callback(err);
            }
        );

    }

}

export { SessionStore, SessionStoreOptions };