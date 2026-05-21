# Stage 1: Build React assets
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install npm packages
RUN npm ci --silent

# Copy project files and build
COPY . .
RUN npm run build

# Stage 2: Serve using Alpine Nginx
FROM nginx:1.25-alpine

# Copy static build to Nginx serving directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy a simple internal nginx config for the frontend routing (if needed for index.html fallbacks)
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
