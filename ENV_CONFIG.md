# Environment Configuration Guide

## 📁 Environment Files

The frontend uses environment variables for configuration. Two files are provided:

- **`.env.local`** - Your local development configuration (not committed to git)
- **`.env.example`** - Template file showing available variables (committed to git)

## 🔧 Available Variables

### `NEXT_PUBLIC_API_URL`

The backend API server URL.

**Default:** `http://localhost:3005`

**Example:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3005
```

To change the backend port, update this value in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🚀 Changing Ports

### Backend Port

1. Open `frontend/.env.local`
2. Change `NEXT_PUBLIC_API_URL` to match your backend port:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3005
   ```
3. Restart the frontend server

### Frontend Port

The frontend port can be changed in several ways:

**Option 1: Command line**

```bash
npm run dev -- -p 3000
```

**Option 2: Update package.json**

```json
{
  "scripts": {
    "dev": "next dev -p 3000"
  }
}
```

**Option 3: Environment variable**

```bash
PORT=3000 npm run dev
```

## 📝 Setup Instructions

1. Copy `.env.example` to `.env.local` (if not already created):

   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your configuration:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3005
   ```

3. Restart the development server:
   ```bash
   npm run dev
   ```

## ⚠️ Important Notes

- **`.env.local`** is in `.gitignore` and will not be committed to git
- Variables prefixed with `NEXT_PUBLIC_` are available in client-side code
- Changes to `.env.local` require a server restart to take effect
- The backend port is currently set to **3005** (check `node server/config/constants.js`)

## 🔍 Current Configuration

- **Backend Port:** 3005 (configured in `node server/config/constants.js`)
- **Frontend Port:** 3000 (default Next.js port)
- **API URL:** `http://localhost:3005` (set in `.env.local`)
