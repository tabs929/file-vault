FROM node:20-alpine

WORKDIR /app

# Copy package manifest only — install before copying source for better caching.
# The docker-compose volume mount will overlay /app at runtime, but node_modules
# is preserved by the anonymous volume declared in docker-compose.yml.
COPY package.json package-lock.json ./

RUN npm ci

EXPOSE 3000

CMD ["npm", "run", "dev"]
