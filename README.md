# login-with-google-typescript
Minimal example for google login with typescript.

## How to Use

This is a working example of how you might implement Google login with OAuth 2.0 using the Passport library and Postgres databases. I cobbled this together out of the need to address some gaps in both session storage and the lack of a working example provided by Passport docs. While you can certainly use the examples Passport provides and twist them toward your use case, you will likely hit some snags setting up a secure context and getting session storage working. Hopefully this example illustrates how you might get up and running with Google logins and perhaps more generally with accessing and storing user/session information using Passport, Postgres, and Typescript. If this sounds like something you might need, then get to cloning!

## Database

Since we're using Postgres, go ahead and open up pgAdmin and create a database dedicated solely to this project.

### Sessions Table

You'll need to set up a table for sessions. See [https://github.com/mricha41/node-connect-pg-simple-typescript#how-to-use](https://github.com/mricha41/node-connect-pg-simple-typescript#how-to-use) for sessions table setup details. Initialization of the <code>pg.Pool</code> is handled in <code>app.ts</code>. This example uses the session store you'll find there as a drop-in implementation conforming with the [express session store implementation docs](https://github.com/expressjs/session#session-store-implementation).

### Users Table

Set up a table with the name "users" for storing profile details.


Here is what the SQL might look like for setting up the table:

```
CREATE TABLE "users"
(
    user_id BIGSERIAL NOT NULL COLLATE "default",
    provider VARCHAR NOT NULL,
    provider_id VARCHAR NOT NULL,
    display_name VARCHAR NOT NULL,
    name JSONB,
    photos JSONB,
    emails JSONB,
    CONSTRAINT user_pkey PRIMARY KEY (user_id)
)
```

How you create your table makes no difference. However, pay attention to the field names and types, making sure your user_id field is the auto-incrementing primary key for the table. The table itself is based on the [https://www.passportjs.org/reference/normalized-profile/](https://www.passportjs.org/reference/normalized-profile/) docs and the underlying [IETF draft contacts schema](https://tools.ietf.org/html/draft-smarr-vcarddav-portable-contacts-00) for accessing contact information. Under "singular fields" and "plural fields" you'll find all sorts of required and not-so-required fields that you might fetch over HTTP via various APIs. Passport did a fabulous job documenting what they call their "normalized profile", which is their elegant way of abstracting the multitude of APIs you might use Passport to fetch user data from. 

## Environment Variables

The following example <code>.env</code> provides guidance on which environment variables are required:

```
NODE_ENV=development
HOST=your_app_host
PORT=your_app_port
DATABASE_HOST=your_db_host
DATABASE_PORT=your_db_port
DATABASE_USER=your_db_user_name
DATABASE_PASSWORD=your_db_password
DATABASE=your_db_name
SESSION_SECRET=your_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CANONICAL=your_canonical_url
KEY=PATH\TO\YOUR\CERTS\key.pem
CERT=PATH\TO\YOUR\CERTS\cert.pem
```

Typically, Postgres runs on localhost port 5432 by default. Your default app setup probably runs on localhost/127.0.0.1, and <em><u style="color:red">NEEDS to run on port 443</u></em> (or an equally secure port) to support secure connections only.

You'll also need to have followed the instructions provided by [passport-google-oauth20](https://www.passportjs.org/packages/passport-google-oauth20/) to set up a new project in [Google Developers Console](https://console.developers.google.com/). Once you get a client ID and client secret, add it to the <code>.env</code> above. You'll need to expose the callback URL in the Google project. For example, assuming you're running on 127.0.0.1:443 your callback would be <code>https://127.0.0.1:443/auth/google/callback</code>. Should you like to make substantive changes, you can find the source in <code>./src/server/routes/login/google/google.ts</code>.

## Notes on Setting up a Secure Context

The features used to set up sessions and logins with Google require you to set up a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts). This means you'll need a proper certificate signed by a certificate authority (CA) recognized by browsers. It can be a bit of a pain to get working in a way browsers will permit for your local development setup. If you are on a corporate network, you likely have an IT pro who can supply you with a certificate signed by a CA that browsers recognize as legitimate.

Should you be on your home network, you will need to establish your own CA. To support you in this task, and particularly on Windows, I recommend installing Git bash if you have not already. Mostly because Windows users probably don't have openssl installed by default, and because Git bash ships with this as well as other tools you'd find on Linux.

The following bash script can be run to set up a local development CA, taking care to run the script with its two positional arguments (assigned to $CA and $CA_DNS, respectively):

```
#!/bin/sh
#CA is whatever your root certificate authority should be called
CA=$1
#CA_DNS is the address you are running apps on using this certificate authority
CA_DNS=$2
openssl genrsa -des3 -out $CA.key 2048
openssl req -x509 -new -nodes -key $CA.key -sha256 -days 1825 -out $CA.pem
cat > $CA.ext << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names
[alt_names]
IP = $CA_DNS
EOF
```

Follow the prompts and you should end up with a valid CA. I also recommend giving the first positional argument "$CA" a solid name ("nodejs_localhost_ca" for example) that makes it clear that the output files belong to a CA and not just any old ssl keys/certs. Set the second positional argument "$CA_DNS" to the address you'll be using ("127.0.0.1" for example). So, if you saved the script as "create_certificate_authority.sh", you might run it as follows:

```
./create_certificate_authority.sh nodejs_localhost_ca 127.0.0.1
```

Now, if you are using Firefox, you should be able to find certificate settings under "Privacy and Security --> Connection Security". Go to "Manage Certificates" and "Import..." your CA file. On Windows, you will also need to add the CA to "Trusted Root Certificate Authorities" using the "Certificate Manager", which you should be able to find using your startup search bar.

Next, you will need to generate a certificate signed by your newly minted CA. Here is another bash script you can use to generate certificates for your NodeJS apps:

```
#!/bin/sh
#script argument should be your server or app name for this particular application
CA=$1
NAME=$2
HOST=$3
openssl genrsa -out $NAME.key 2048
openssl req -new -key $NAME.key -out $NAME.csr
cat > $NAME.ext << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names
[alt_names]
IP = $HOST
EOF
openssl x509 -req -in $NAME.csr -CA $CA.pem -CAkey $CA.key -CAcreateserial -out $NAME.crt -days 825 -sha256 -extfile $NAME.ext
```

Again, just pay attention to the positional arguments (assigned to $CA, $NAME, and $HOST) and set them according to your needs considering how you chose to set up your CA. $NAME is what you want to call your app certificate and $HOST is the address the app runs on while $CA is the name you gave your CA in the previous step. If you saved the script as "create_signed_certificate.sh", you might run it as follows:

```
./create_signed_certificate.sh nodejs_localhost nodejs_localhost_ca 127.0.0.1
```

## Mission Accomplished?!?

When all is right, you won't see much. Just the name of the logged in user and a logout button. Your session table should update according to whether the user is logged in or logged out. You'll see a Passport profile in the session_data while the user is logged in, otherwise the session will be anonymous (no user profile info in session_data). You should always see a cookie and csrfSecret tied to the session, however.

Anonymous session:
```
{
  "cookie": {
    "originalMaxAge": 2592000000,
    "expires": "2026-10-15T20:02:40.025Z",
    "httpOnly": true,
    "path": "/"
  },
  "csrfSecret": "garbled_stuff"
}
```

Logged in session:
```
{
  "cookie": {
    "originalMaxAge": 2592000000,
    "expires": "2026-10-15T20:04:10.821Z",
    "httpOnly": true,
    "path": "/"
  },
  "passport": {
    "user": {
      "provider": "google",
      "provider_id": "the provider id",
      "display_name": "Some name",
      "name": {
        "givenName": "Some name"
      },
      "photos": [
        {
          "value": "a link to a photo"
        }
      ],
      "emails": [],
      "user_id": "some user id"
    }
  },
  "csrfSecret": "garbled_stuff"
}
```