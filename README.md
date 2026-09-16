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

## Product image storage (Cloudinary)

Product images are optional and are uploaded through the backend so the Cloudinary API secret is never exposed to the browser.

1. Create a free Cloudinary account at `https://cloudinary.com/users/register_free`.
2. Copy the Cloud Name, API Key, and API Secret from the Cloudinary dashboard.
3. Add them to `Backend/.env`:

```text
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

4. Restart the backend. Each product can have up to 6 optional JPG, PNG, or WebP images, with a 5 MB limit per image.

Never add `CLOUDINARY_API_SECRET` to `Frontend/.env` or commit `Backend/.env`.

## Install as an app (PWA)

- **Windows:** Open the production site in Microsoft Edge or Chrome. Use the install icon in the address bar, or browser menu → **Install Jockey Stock**.
- **iPhone:** Open the production site in Safari, tap **Share**, then select **Add to Home Screen**.

PWA installation requires the deployed site to use HTTPS. `localhost` also works while developing.

## Vercel deployment

Deploy the frontend and backend separately, then connect them using environment variables.

1. Deploy the backend to a Node.js-capable host and set its `MONGODB_URI` environment variable.
2. Deploy the `Frontend` folder to Vercel (Vite preset; build command: `npm run build`; output: `dist`).
3. In the Vercel frontend project, open **Settings → Environment Variables** and add:

```text
VITE_API_URL=https://your-backend-domain.com/api
```

4. Redeploy the frontend after adding or changing `VITE_API_URL`.

For local development, copy `Frontend/.env.example` to `Frontend/.env`.
