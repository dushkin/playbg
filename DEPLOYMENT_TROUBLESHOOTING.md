# PlayBG Deployment Troubleshooting Guide

## Current Status: Backend Returning 502 Error

### ✅ What's Working
- Frontend is deployed and accessible at: https://playbg-frontend.onrender.com
- Build configuration is correct in render.yaml
- All required files are present
- Local build commands work successfully

### ❌ Issues Identified
1. **Backend service returning 502 error** at https://playbg-backend.onrender.com
2. **No git remote repository configured** - Render needs GitHub connection for auto-deployment
3. **Environment variables may not be properly set** in Render dashboard

## Immediate Fixes Required

### 1. Connect GitHub Repository
```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/your-username/playbg-platform.git

# Push to GitHub
git push -u origin dev
```

### 2. Verify Environment Variables in Render Dashboard
Go to Render dashboard → playbg-backend → Environment:
- ✅ `NODE_ENV=production`
- ✅ `PORT=10000`
- ❌ `MONGODB_URI` - Must be set to your MongoDB Atlas connection string
- ❌ `REDIS_URL` - Must be set to your Redis Cloud connection string  
- ❌ `JWT_SECRET` - Must be set to a secure random string
- ✅ `FRONTEND_URL=https://playbg-frontend.onrender.com`

### 3. Check Render Service Logs
In Render dashboard → playbg-backend → Logs, look for:
- Database connection errors
- Missing environment variable errors
- Build failures
- Port binding issues

## Database Setup Required

### MongoDB Atlas
1. Create a cluster at https://cloud.mongodb.com
2. Create database user with read/write access
3. Whitelist Render's IP addresses (or use 0.0.0.0/0 for all IPs)
4. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/playbg`

### Redis Cloud  
1. Create database at https://redis.com/try-free/
2. Get connection string: `redis://username:password@host:port`

## Deployment Steps

1. **Setup Databases** (if not done)
   - MongoDB Atlas cluster
   - Redis Cloud database

2. **Configure Repository**
   ```bash
   git remote add origin https://github.com/your-username/playbg-platform.git
   git push -u origin dev
   ```

3. **Update Render Services**
   - Connect GitHub repository to both services
   - Set all required environment variables
   - Trigger manual deploy

4. **Verify Deployment**
   ```bash
   curl https://playbg-backend.onrender.com/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

## Additional Optimizations

### render.yaml Improvements (✅ Already Fixed)
- Simplified build commands to use npm scripts
- Corrected start command path
- Maintained proper environment variable structure

### Health Check Endpoint
The backend includes `/health` endpoint for monitoring. Test with:
```bash
curl https://playbg-backend.onrender.com/health
```

### Build Performance
Current build time can be improved by:
- Using npm workspaces properly (already implemented)
- Caching dependencies in Render (automatic)
- Optimizing TypeScript compilation

## Common Issues & Solutions

### 502 Bad Gateway
- Service failed to start
- Check environment variables are set
- Verify database connections
- Review service logs

### Build Failures  
- Missing dependencies
- TypeScript compilation errors
- Workspace resolution issues

### Runtime Errors
- Database connection failures
- Missing environment variables
- Port binding conflicts

## Next Steps
1. Configure GitHub repository connection
2. Set up MongoDB Atlas and Redis Cloud
3. Update Render environment variables
4. Monitor deployment logs
5. Test all endpoints after successful deployment