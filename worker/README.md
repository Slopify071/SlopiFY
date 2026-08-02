# SlopiFY Cloudflare Worker API & R2 Storage Setup Guide

This subproject contains the Cloudflare Worker microservice that connects SlopiFY to Cloudflare R2 for zero-egress cost audio file storage and HTTP range streaming.

## 🚀 Setup Steps

### 1. Install Dependencies
```bash
cd worker
npm install
```

### 2. Log in to Cloudflare CLI
```bash
npx wrangler login
```

### 3. Create the Cloudflare R2 Bucket
Run the following command to create the `slopify-audio` R2 bucket in your Cloudflare account:
```bash
npx wrangler r2 bucket create slopify-audio
```

### 4. Test Locally with Wrangler Dev
Start the local worker API server:
```bash
npx wrangler dev
```
By default, this runs at `http://127.0.0.1:8787`.

### 5. Deploy to Production
Deploy the worker to your Cloudflare network:
```bash
npx wrangler deploy
```

Once deployed, copy your deployed Worker URL (e.g. `https://slopify-worker.<your-subdomain>.workers.dev`) and paste it into your root `.env.local` file:
```env
VITE_CLOUDFLARE_WORKER_URL=https://slopify-worker.<your-subdomain>.workers.dev
```

---

## 📡 Available Endpoints

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/upload` | Yes (Firebase Bearer JWT) | Streams audio file directly into Cloudflare R2 bucket. |
| `GET` | `/api/audio/:r2Key` | No | Streams audio file with HTTP `Range` header support (`206 Partial Content`) for rapid seeking. |
| `DELETE` | `/api/audio/:r2Key` | Yes (Firebase Bearer JWT) | Deletes audio object from Cloudflare R2 bucket. |
| `GET` | `/api/storage-info` | No | Returns calculated storage byte usage and total file count in R2 bucket. |
