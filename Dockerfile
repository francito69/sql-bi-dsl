FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN npm --prefix backend install --omit=dev
COPY backend ./backend
COPY frontend ./frontend
EXPOSE 3000
CMD ["node", "backend/src/server.js"]
