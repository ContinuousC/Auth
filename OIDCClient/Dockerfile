# syntax=docker/dockerfile:1.6

FROM node:22-alpine AS builder
WORKDIR /app
COPY --link package.json .
COPY --link package-lock.json .
RUN --mount=type=cache,id=continuousc-oidc-client-node_modules,target=/app/node_modules \
    npm ci --color=always
COPY --link . .

FROM builder AS test
RUN --mount=type=cache,id=continuousc-oidc-client-node_modules,target=/app/node_modules \
    npm run test

FROM builder AS audit
RUN --mount=type=cache,id=continuousc-oidc-client-node_modules,target=/app/node_modules \
    npm audit --color=always

FROM builder AS build
RUN --mount=type=cache,id=continuousc-oidc-client-node_modules,target=/app/node_modules \
    npx tsc --pretty; \ 
    mkdir /app/node_modules_build; \
    cp -r /app/node_modules/* /app/node_modules_build;


FROM node:22-alpine as production
WORKDIR /app
COPY --chown=node:node --link package.json .
COPY --chown=node:node --link package-lock.json .
COPY --chown=node:node --from=build /app/node_modules_build /app/node_modules
COPY --chown=node:node --from=build /app/dist /app/dist
EXPOSE 8080
USER node
CMD ["node", "/app/dist/main.js"]
