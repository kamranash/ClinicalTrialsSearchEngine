FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ .

VOLUME /data
EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "index.js"]
