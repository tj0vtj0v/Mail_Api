FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY server.mjs config.js ./
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server.mjs"]

