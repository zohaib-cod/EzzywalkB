# Ezzywalk - Backend API

This repository contains the Node.js/Express backend for Ezzywalk, built with Prisma and MongoDB.

## Deployment Ready (Vercel)
The backend has been configured to be deployed natively on Vercel as serverless functions.
- `vercel.json` included for routing.
- `index.js` exports the `app` instance.
- `"postinstall": "prisma generate"` added to `package.json` to ensure the Prisma Client is generated during deployment.

## Features
- Dynamic JWT Auth and Role Management
- Prisma integration for MongoDB
- Slider/Banner CRUD APIs
- Product and Order Management APIs
