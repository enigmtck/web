FROM node:18-bullseye AS builder
# Use bash for the shell
SHELL ["/bin/bash", "-c"]
RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
  libpq-dev \
  ssl-cert \
  ca-certificates \
  curl \
  apt-transport-https \
  lsb-release \
  file \
  git-core \
  build-essential \
  libssl-dev \
  pkg-config \
  emscripten \
  llvm \
  libolm-dev \
  cmake

RUN emcc
RUN mkdir -p /opt/build/src
WORKDIR /opt/build/src
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
RUN source /root/.cargo/env && rustup +nightly default
RUN source /root/.cargo/env && cargo install wasm-pack

COPY src /opt/build/src/src

COPY static/icons /opt/build/src/static/icons
COPY static/fontawesome /opt/build/src/static/fontawesome
COPY static/fonts /opt/build/src/static/fonts
COPY static/highlight /opt/build/src/static/highlight
RUN mkdir -p /opt/build/src/static/media

COPY svelte.config.js /opt/build/src/
COPY package.json /opt/build/src/
COPY tsconfig.json /opt/build/src/
COPY vite.config.js /opt/build/src/
COPY yarn.lock /opt/build/src/
COPY .npmrc /opt/build/src/
COPY wasm /opt/build/src/wasm

RUN source /root/.cargo/env && yarn install && yarn run build

FROM node:18-alpine
RUN apk update && apk --no-cache add ca-certificates nginx certbot
RUN mkdir -p /srv/enigmatick
WORKDIR /srv/enigmatick
COPY --from=builder /opt/build/src/build ./build
COPY --from=builder /opt/build/src/package.json ./
COPY --from=builder /opt/build/src/node_modules ./node_modules

EXPOSE 3000

CMD ["node","build"]
