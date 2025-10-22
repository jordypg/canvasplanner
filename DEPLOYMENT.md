# Canvas Planner - EC2 Deployment Guide

## Server Information

**Domain:** https://jordypg.com/canvasplanner
**EC2 IP:** 18.118.109.247
**SSH Key:** canvas-app-key.pem (in project root)
**Server User:** ubuntu
**App Location:** ~/apps/figma-app

---

## Connecting to the Server

### From Your Local Machine

```bash
# Navigate to project directory
cd /Users/jordy/dev/figmaApp

# Connect via SSH
ssh -i canvas-app-key.pem ubuntu@18.118.109.247
```

**Troubleshooting Connection Issues:**
- If you get "permissions too open" error:
  ```bash
  chmod 400 canvas-app-key.pem
  ```
- If connection times out, check AWS Security Group allows SSH (port 22) from your IP

---

## Deployment Process (On Remote Server)

### Quick Deployment (Most Common)

After connecting to the server, run these commands:

```bash
# Navigate to app directory
cd ~/apps/figma-app

# Pull latest code from GitHub
git pull origin master

# Install any new dependencies (if package.json changed)
npm install

# Rebuild the Next.js application
npm run build

# Restart the app with PM2
pm2 restart figma-app

# Check the app is running
pm2 status

# View logs to verify successful restart
pm2 logs figma-app --lines 50
```

### One-Line Deployment Command

```bash
cd ~/apps/figma-app && git pull origin master && npm install && npm run build && pm2 restart figma-app && pm2 logs figma-app --lines 20
```

---

## PM2 Process Manager Commands

### Check App Status
```bash
pm2 status                    # View all processes
pm2 logs figma-app           # View live logs (Ctrl+C to exit)
pm2 logs figma-app --lines 50 # View last 50 log lines
pm2 monit                    # Real-time monitoring dashboard
```

### Restart/Stop/Start App
```bash
pm2 restart figma-app        # Restart the application
pm2 stop figma-app          # Stop the application
pm2 start figma-app         # Start the application
pm2 reload figma-app        # Reload with zero-downtime
```

### View Detailed Info
```bash
pm2 show figma-app          # Show detailed process information
pm2 env 0                   # Show environment variables
```

---

## Nginx Web Server Commands

### Check Nginx Status
```bash
sudo systemctl status nginx     # Check if nginx is running
sudo nginx -t                   # Test configuration syntax
```

### Restart/Reload Nginx
```bash
sudo systemctl restart nginx    # Full restart
sudo systemctl reload nginx     # Reload config without downtime
```

### View Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log   # View access logs
sudo tail -f /var/log/nginx/error.log    # View error logs
```

### Edit Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/jordypg.com
# After editing, test and reload:
sudo nginx -t && sudo systemctl reload nginx
```

---

## SSL Certificate Management

### Check Certificate Status
```bash
sudo certbot certificates      # View all certificates
```

### Renew Certificate Manually
```bash
sudo certbot renew            # Renew if expiring soon
sudo certbot renew --dry-run  # Test renewal process
```

### Auto-Renewal Status
```bash
systemctl status certbot.timer   # Check auto-renewal timer
```

**Note:** Certificates auto-renew automatically. No manual intervention needed!

---

## System Monitoring

### Check System Resources
```bash
htop                   # Interactive process viewer (q to quit)
df -h                  # Disk space usage
free -h                # Memory usage
uptime                 # System uptime and load
```

### Check Running Services
```bash
systemctl status nginx
systemctl status pm2-ubuntu
```

---

## Troubleshooting

### App Won't Start
```bash
# Check PM2 logs for errors
pm2 logs figma-app --err

# Check if port 3000 is in use
sudo lsof -i :3000

# Restart PM2
pm2 restart figma-app
```

### Website Not Loading
```bash
# Check nginx is running
sudo systemctl status nginx

# Check app is running
pm2 status

# View nginx error logs
sudo tail -50 /var/log/nginx/error.log
```

### After Code Changes Not Appearing
```bash
# Make sure you rebuilt
npm run build

# Hard restart PM2
pm2 delete figma-app
cd ~/apps/figma-app
pm2 start ecosystem.config.js

# Clear browser cache or try incognito mode
```

### Out of Disk Space
```bash
# Check disk usage
df -h

# Clean PM2 logs
pm2 flush

# Clean npm cache
npm cache clean --force

# Remove old build files
rm -rf .next
npm run build
```

---

## Environment Variables

Environment variables are stored in:
```bash
~/apps/figma-app/.env
```

To edit:
```bash
cd ~/apps/figma-app
nano .env
# After editing, restart app:
pm2 restart figma-app
```

**Current variables:**
- `NEXT_PUBLIC_CONVEX_URL` - Convex backend URL
- `NODE_ENV` - Set to "production"
- `PORT` - App port (3000)

---

## Git Operations

### View Current Branch/Status
```bash
cd ~/apps/figma-app
git status
git log --oneline -10
```

### Switch Branches (if needed)
```bash
git fetch origin
git checkout branch-name
npm install
npm run build
pm2 restart figma-app
```

### Discard Local Changes
```bash
git reset --hard origin/master
npm install
npm run build
pm2 restart figma-app
```

---

## Backup and Rollback

### Create Manual Backup
```bash
cd ~
tar -czf figma-app-backup-$(date +%Y%m%d).tar.gz apps/figma-app/
```

### Rollback to Previous Commit
```bash
cd ~/apps/figma-app
git log --oneline -10              # Find commit hash
git checkout <commit-hash>
npm install
npm run build
pm2 restart figma-app
```

---

## Adding Another App to the Same Server

1. **Deploy new app on different port (e.g., 3001)**

2. **Update Nginx configuration:**
```bash
sudo nano /etc/nginx/sites-available/jordypg.com
```

Add new location block:
```nginx
location /anotherapp {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

3. **Test and reload:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Emergency Contacts & Resources

**Server Restart (if completely frozen):**
- Go to AWS Console → EC2 → Instances
- Select instance → Instance State → Reboot

**After server reboot:**
- PM2 auto-starts (configured via systemd)
- Nginx auto-starts (configured via systemd)
- No manual intervention needed

**Useful Resources:**
- PM2 Docs: https://pm2.keymetrics.io/docs/usage/quick-start/
- Nginx Docs: https://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/docs/
- Next.js Deployment: https://nextjs.org/docs/deployment

---

## Quick Reference Card

```bash
# Connect to server
ssh -i canvas-app-key.pem ubuntu@18.118.109.247

# Deploy updates
cd ~/apps/figma-app && git pull && npm install && npm run build && pm2 restart figma-app

# Check status
pm2 status
pm2 logs figma-app

# View website
https://jordypg.com/canvasplanner

# Emergency restart
pm2 restart figma-app
sudo systemctl restart nginx
```

---

**Last Updated:** October 22, 2025
**Deployed By:** Claude Code & Jordy
