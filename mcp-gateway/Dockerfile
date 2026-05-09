# Playwright needs glib, nss, etc. — Railpack’s slim Node image lacks them; this image matches npm playwright 1.59.x.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

COPY package.json package-lock.json ./
# Base image already includes Chromium + OS libs; skip postinstall browser download.
RUN npm ci --omit=dev --ignore-scripts

COPY src ./src

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
