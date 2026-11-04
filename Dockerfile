FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN for attempt in 1 2 3; do \
      npm ci --prefer-offline --no-audit --no-fund --fetch-retries=5 && break; \
      if [ "$attempt" = 3 ]; then exit 1; fi; \
      echo "Dependency download failed; retrying ($attempt/3)..."; \
      sleep 5; \
    done

COPY . .
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN for attempt in 1 2 3; do \
      npm ci --omit=dev --prefer-offline --no-audit --no-fund --fetch-retries=5 && break; \
      if [ "$attempt" = 3 ]; then exit 1; fi; \
      echo "Dependency download failed; retrying ($attempt/3)..."; \
      sleep 5; \
    done

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

EXPOSE 3000

CMD ["npm", "run", "start"]
