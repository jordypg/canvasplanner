# Deployment Guide

Production deployment guide for Canvas Planner on AWS EC2 with Nginx and PM2.

## Server Information

| Item | Value |
|------|-------|
| **Domain** | https://jordypg.com/canvasplanner |
| **EC2 IP** | 18.118.109.247 |
| **Server User** | ubuntu |
| **App Location** | ~/apps/figma-app |
| **SSH Key** | canvas-app-key.pem |

## SSH Access

```bash
ssh -i canvas-app-key.pem ubuntu@18.118.109.247
```

**First-time setup:**
```bash
chmod 400 canvas-app-key.pem
```

## Quick Deploy

Standard deployment workflow after connecting to server:

```bash
cd ~/apps/figma-app
git pull origin master
npm install
npm run build
pm2 restart figma-app
pm2 logs figma-app --lines 20
```

**One-line version:**
```bash
cd ~/apps/figma-app && git pull && npm install && npm run build && pm2 restart figma-app
```

## Process Management (PM2)

### Status & Monitoring

```bash
pm2 status                      # View all processes
pm2 logs figma-app             # Live log stream
pm2 logs figma-app --lines 50  # Last 50 lines
pm2 monit                      # Real-time dashboard
```

### Control Commands

```bash
pm2 restart figma-app          # Restart application
pm2 stop figma-app            # Stop application
pm2 start figma-app           # Start application
pm2 reload figma-app          # Zero-downtime reload
```

## Web Server (Nginx)

### Configuration

```bash
# Edit configuration
sudo nano /etc/nginx/sites-available/jordypg.com

# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx
```

### Logs

```bash
sudo tail -f /var/log/nginx/access.log    # Access logs
sudo tail -f /var/log/nginx/error.log     # Error logs
```

### Service Control

```bash
sudo systemctl status nginx     # Check status
sudo systemctl restart nginx    # Restart service
sudo systemctl reload nginx     # Reload config
```

## SSL Certificates

Certificates are managed by Let's Encrypt and auto-renew via certbot.

```bash
sudo certbot certificates              # View certificates
sudo certbot renew --dry-run          # Test renewal
systemctl status certbot.timer        # Check auto-renewal status
```

## Environment Variables

Located at `~/apps/figma-app/.env`:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NODE_ENV=production
PORT=3000
```

**Update variables:**
```bash
nano ~/apps/figma-app/.env
pm2 restart figma-app
```

## System Monitoring

```bash
htop                 # Process viewer
df -h                # Disk usage
free -h              # Memory usage
uptime               # System load
```

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs figma-app --err

# Verify port availability
sudo lsof -i :3000

# Hard restart
pm2 delete figma-app
cd ~/apps/figma-app
pm2 start ecosystem.config.js
```

### Website Not Loading

```bash
# Verify services
sudo systemctl status nginx
pm2 status

# Check nginx errors
sudo tail -50 /var/log/nginx/error.log
```

### Changes Not Appearing

```bash
# Ensure clean build
npm run build
pm2 restart figma-app

# Clear client cache
# Use browser incognito mode
```

### Disk Space Issues

```bash
df -h                          # Check usage
pm2 flush                      # Clear PM2 logs
npm cache clean --force        # Clear npm cache
rm -rf .next && npm run build  # Rebuild
```

## Git Operations

### Branch Management

```bash
cd ~/apps/figma-app
git status
git log --oneline -10
git fetch origin
git checkout branch-name
```

### Rollback

```bash
cd ~/apps/figma-app
git log --oneline -10
git checkout <commit-hash>
npm install
npm run build
pm2 restart figma-app
```

### Reset to Remote

```bash
git reset --hard origin/master
npm install
npm run build
pm2 restart figma-app
```

## Backup

```bash
cd ~
tar -czf figma-app-backup-$(date +%Y%m%d).tar.gz apps/figma-app/
```

## Adding Additional Applications

To deploy another app on the same server:

1. **Deploy app on different port** (e.g., 3001)

2. **Update Nginx configuration:**
```bash
sudo nano /etc/nginx/sites-available/jordypg.com
```

Add location block:
```nginx
location /otherapp {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

3. **Apply changes:**
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Auto-Start Configuration

Both PM2 and Nginx are configured to auto-start on server reboot via systemd. No manual intervention required after system restarts.

## Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Production URL:** https://jordypg.com/canvasplanner
