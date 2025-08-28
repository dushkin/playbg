# PlayBG Deployment Guide

## Infrastructure Setup

### 1. MongoDB Atlas Setup
1. Create cluster in MongoDB Atlas
2. Get connection string in format: `mongodb+srv://username:password@cluster.mongodb.net/playbg`
3. Add to Render environment variables as `MONGODB_URI`

### 2. Redis Cloud Setup  
1. Create Redis Cloud database
2. Get connection string in format: `redis://username:password@host:port`
3. Add to Render environment variables as `REDIS_URL`

### 3. Render Deployment

#### Backend Service:
```yaml
Name: playbg-backend
Type: Web Service
Runtime: Node
Build Command: npm run build:backend
Start Command: npm run start:backend
```

**Environment Variables:**
- `NODE_ENV=production`
- `PORT=10000` (Render default)
- `MONGODB_URI=<your-mongodb-connection-string>`
- `REDIS_URL=<your-redis-connection-string>` 
- `JWT_SECRET=<your-secure-jwt-secret>`
- `JWT_EXPIRE=7d`
- `FRONTEND_URL=<your-frontend-domain>`
- `LOG_LEVEL=info`

#### Frontend Static Site:
```yaml
Name: playbg-frontend  
Type: Static Site
Build Command: npm run build:frontend
Publish Directory: apps/frontend/dist
```

**Environment Variables:**
- `VITE_API_URL=<your-backend-domain>/api`
- `VITE_WS_URL=<your-backend-domain>`

### 4. Custom Domain Configuration

#### Backend Domain:
1. In Render dashboard → playbg-backend → Settings → Custom Domains
2. Add your API subdomain: `api.yourdomain.com`
3. Update DNS with CNAME: `api → playbg-backend.onrender.com`

#### Frontend Domain:
1. In Render dashboard → playbg-frontend → Settings → Custom Domains  
2. Add your main domain: `yourdomain.com` and `www.yourdomain.com`
3. Update DNS:
   - A record: `@ → Render IP`
   - CNAME: `www → playbg-frontend.onrender.com`

#### Update Environment Variables After Domain Setup:
- Backend `FRONTEND_URL=https://yourdomain.com`
- Frontend `VITE_API_URL=https://api.yourdomain.com/api`
- Frontend `VITE_WS_URL=https://api.yourdomain.com`

### 5. Deploy Process

1. **Push to GitHub**: Ensure all changes are committed
2. **Connect Render**: Link your GitHub repository to Render services
3. **Set Environment Variables**: Add all required env vars in Render dashboard
4. **Deploy**: Render will automatically build and deploy

### 6. Post-Deployment Verification

#### Health Checks:
- Backend health: `https://api.yourdomain.com/health`
- Frontend loading: `https://yourdomain.com`

#### Database Connections:
- MongoDB connection logs in Render backend logs
- Redis connection logs in Render backend logs

#### Socket.IO Testing:
- Real-time features should work between frontend/backend
- Check browser developer tools for WebSocket connections

## Production Monitoring

### Render Dashboards:
- Monitor service metrics, logs, and deployments
- Set up alerts for service failures

### Database Monitoring:
- MongoDB Atlas monitoring dashboard
- Redis Cloud monitoring dashboard

## Security Checklist

- [ ] JWT secret is secure and unique
- [ ] MongoDB connection uses SSL
- [ ] Redis connection uses TLS
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Helmet security headers active

## Scaling Considerations

### Render Plan Upgrades:
- **Starter Plan**: Basic production deployment
- **Standard Plan**: Better performance and uptime
- **Pro Plan**: High-traffic, mission-critical

### Database Scaling:
- **MongoDB Atlas**: Upgrade cluster tier for more resources
- **Redis Cloud**: Increase memory/throughput limits