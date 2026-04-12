FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

FROM nginx:1.27-alpine

# Remove default static files and copy Angular build artifacts.
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/proyecto-software-front/browser /usr/share/nginx/html

# Minimal SPA fallback to avoid 404 on refresh.
# Angular uses client-side routing, so we need to serve index.html for all routes.
RUN echo 'server { \
	listen 80; \
	location / { \
		root /usr/share/nginx/html; \
		index index.html index.htm; \
		try_files $uri $uri/ /index.html; \
	} \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
