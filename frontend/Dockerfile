# Debian rather than Alpine: npm's optional-dependency handling is unreliable on
# musl, which left the Rolldown native binding and vite itself uninstalled.
# Only the build stage - the served image below is still nginx:alpine.
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
# npm install, not npm ci: the lockfile is generated on Windows and omits the
# Linux-only optional deps (@emnapi/core), which npm ci treats as out of sync.
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80