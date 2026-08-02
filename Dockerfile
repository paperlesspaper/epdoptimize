FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY examples ./examples
COPY src ./src
COPY tsconfig.json tsconfig.build.json ./
COPY vite.config.js ./

RUN npm ci

ARG EXAMPLES_BASE_PATH=/
ENV EXAMPLES_BASE_PATH=${EXAMPLES_BASE_PATH}
RUN npm run build:examples:docker

FROM nginx:1.29-alpine AS runtime
COPY docker/nginx-editor.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/examples /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
