FROM node:22-alpine
WORKDIR /khrum-khrum
COPY package*.json ./
RUN npm ci && npm install -g serve
COPY . .
RUN npm run build -- --base=/
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173", "-n"]
