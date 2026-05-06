FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine

# Remove default static files and copy Angular build artifacts.
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/proyecto-software-front/browser /usr/share/nginx/html

# Let nginx official entrypoint render the template with env vars.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_URL=https://api.keystudios.app

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
