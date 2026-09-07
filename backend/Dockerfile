FROM node:22-alpine

WORKDIR /app

ARG DATABASE_URL=postgresql://oviapp:oviapp@db:5432/oviapp?schema=public
ENV DATABASE_URL=${DATABASE_URL}

COPY package*.json ./
RUN npm install --include=dev

COPY . .

RUN ./node_modules/.bin/prisma generate
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=development

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/server.js"]