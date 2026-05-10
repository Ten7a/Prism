FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --include=dev
COPY . .
# SvelteKit's $env/static/public needs PUBLIC_* defined at build time;
# real values are supplied at runtime via env_file.
ENV PUBLIC_ADSENSE_CLIENT_ID="" \
	PUBLIC_ADSENSE_SLOT_LIBRARY_TOP="" \
	PUBLIC_ADSENSE_SLOT_LANDING_FOOTER="" \
	PUBLIC_APP_NAME="Prism"
RUN BUILD_TARGET=node npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/bin ./bin
EXPOSE 3000
CMD ["node", "build"]
