# 🔒 Private Chat App

A secure, real-time, self-destructing chat application built with Next.js, Elysia.js, and Upstash. Create private chat rooms that automatically expire after 10 minutes, with support for up to 10 members per room.

## ✨ Features

- **🔐 Secure Rooms**: Each room has a unique ID for private conversations
- **⏱️ Self-Destruct Timer**: Rooms automatically expire after 10 minutes
- **👥 Multi-User Support**: Up to 10 members per room
- **⚡ Real-Time Messaging**: Instant message delivery using Upstash Realtime
- **💣 Manual Destruction**: Destroy rooms instantly with the "Destroy Now" button
- **🎨 Modern UI**: Dark theme with a sleek, minimalist design
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **🔄 Optimistic Updates**: Fast, responsive UI with client-side optimizations

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Elysia.js (Bun-compatible web framework)
- **Database**: Upstash Redis (serverless Redis)
- **Realtime**: Upstash Realtime
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Type Safety**: TypeScript, Zod

## 📋 Prerequisites

- Node.js 18+ or Bun
- Upstash account (for Redis and Realtime)
- npm, yarn, pnpm, or bun

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd realtime_chat
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
# Upstash Redis
UPSTASH_REDIS_REST_URL=your_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_redis_rest_token

# Upstash Realtime
UPSTASH_REALTIME_REST_URL=your_realtime_rest_url
UPSTASH_REALTIME_REST_TOKEN=your_realtime_rest_token
```

**How to get Upstash credentials:**
1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a Redis database
3. Create a Realtime database
4. Copy the REST URL and REST Token from each database

### 4. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
realtime_chat/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── [[...slugs]]/
│   │   │       └── route.ts          # Elysia API routes
│   │   ├── room/
│   │   │   └── [roomId]/
│   │   │       └── page.tsx          # Room page
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Home page
│   ├── api/
│   │   └── [[..slugs]]/
│   │       ├── auth.ts               # Authentication middleware
│   │       └── route.ts              # Legacy route (if exists)
│   ├── components/
│   │   └── provider.tsx              # React Query & Realtime providers
│   ├── hooks/
│   │   └── use-username.ts           # Username generation hook
│   ├── lib/
│   │   ├── client.ts                 # Treaty API client
│   │   ├── redis.ts                  # Redis client
│   │   ├── realtime.ts               # Realtime client & schema
│   │   └── realtime-client.ts        # Realtime React hook
│   └── proxy.ts                      # Next.js middleware for room access
├── public/
│   └── favicon.svg                   # App favicon
├── package.json
└── README.md
```

## 🎯 How It Works

1. **Room Creation**: Users click "Create Secure Room" to generate a unique room ID
2. **Room Access**: Users can share the room URL to invite others (max 10 members)
3. **Messaging**: Real-time messages are stored in Redis and broadcast via Upstash Realtime
4. **Auto-Expiration**: Rooms automatically expire after 10 minutes
5. **Manual Destruction**: Any user can destroy the room instantly, deleting all data

## 🔧 Configuration

### Room Settings

- **Max Members**: 10 users per room (configurable in `src/proxy.ts` and `src/api/[[..slugs]]/auth.ts`)
- **TTL**: 10 minutes (configurable in `src/app/api/[[...slugs]]/route.ts`)
- **Username Format**: `anonymous_{animal}-{randomId}` (10 different animals)

### Performance Optimizations

- React Query caching (30s staleTime, 5min cacheTime)
- Optimistic message updates
- Client-side countdown timer (syncs every 5 seconds)
- Parallel Redis operations
- Reduced API polling frequency

## 🚢 Deployment

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your repository
   - Vercel will auto-detect Next.js

3. **Add Environment Variables**
   In Vercel project settings, add:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `UPSTASH_REALTIME_REST_URL`
   - `UPSTASH_REALTIME_REST_TOKEN`

4. **Deploy**
   - Click "Deploy"
   - Your app will be live at `your-app.vercel.app`

### Other Platforms

This app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- Render
- AWS Amplify
- Cloudflare Pages

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🔒 Security Features

- Unique room IDs (nanoid)
- Token-based authentication
- Room access validation
- Automatic data expiration
- Secure cookie handling

## 🐛 Troubleshooting

**Messages not appearing?**
- Check Upstash Realtime connection
- Verify Redis credentials
- Check browser console for errors

**Room not found?**
- Ensure room hasn't expired (10 minutes)
- Check if room was manually destroyed
- Verify Redis connection

**Build errors?**
- Ensure all environment variables are set
- Check Node.js version (18+)
- Clear `.next` folder and rebuild

## 📄 License

This project is private and proprietary.

## 👨‍💻 Development

Built with ❤️ using Next.js, Elysia.js, and Upstash.

---

**Note**: Make sure to keep your environment variables secure and never commit them to version control.
