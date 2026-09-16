# Jockey Stock Management System

Starter system with role-based login for Super Admins and Sales Representatives.

## Run it

1. Install and start MongoDB locally, or create a MongoDB Atlas cluster.
2. Copy `Backend/.env.example` to `Backend/.env` and set `MONGODB_URI` with your connection string.
3. Run `npm install` in the project root, `Backend`, and `Frontend` folders.
4. In `Backend`, run `npm run seed` to create the first users.
5. In the project root, run `npm run dev`.
6. Open `http://localhost:5173`.

`npm run dev` starts both services together. Backend changes automatically restart the API and frontend changes update the browser automatically.


Users are stored in MongoDB and their passwords are hashed. The current login token is only a development placeholder; add signed JWTs before production use.

## Install as an app (PWA)

- **Windows:** Open the production site in Microsoft Edge or Chrome. Use the install icon in the address bar, or browser menu → **Install Jockey Stock**.
- **iPhone:** Open the production site in Safari, tap **Share**, then select **Add to Home Screen**.

PWA installation requires the deployed site to use HTTPS. `localhost` also works while developing.
