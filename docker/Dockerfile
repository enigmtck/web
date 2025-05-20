FROM node:23-bookworm AS builder
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

RUN mkdir -p /opt/build/enigmatick
WORKDIR /opt/build/enigmatick
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
RUN source /root/.cargo/env && rustup +nightly default
RUN source /root/.cargo/env && cargo install wasm-pack

COPY src /opt/build/enigmatick/src
COPY vendor /opt/build/enigmatick/vendor

COPY static/icons /opt/build/enigmatick/static/icons
COPY static/fontawesome /opt/build/enigmatick/static/fontawesome
COPY static/fonts /opt/build/enigmatick/static/fonts
COPY static/highlight /opt/build/enigmatick/static/highlight
RUN mkdir -p /opt/build/enigmatick/static/media

COPY svelte.config.js /opt/build/enigmatick/
COPY package.json /opt/build/enigmatick/
COPY tsconfig.json /opt/build/enigmatick/
COPY vite.config.ts /opt/build/enigmatick/
COPY yarn.lock /opt/build/enigmatick/
COPY .npmrc /opt/build/enigmatick/

WORKDIR /opt/build/enigmatick/vendor/vite-plugin-wasm-pack
RUN yarn install && yarn build

RUN mkdir -p /opt/build/enigmatick/wasm/enigmatick_wasm
COPY .cargo /opt/build/enigmatick/.cargo
COPY Cargo.lock /opt/build/enigmatick/wasm/enigmatick_wasm/
COPY wasm/enigmatick_wasm/Cargo.toml /opt/build/enigmatick/wasm/enigmatick_wasm/
COPY wasm/enigmatick_wasm/rust-toolchain.toml /opt/build/enigmatick/wasm/enigmatick_wasm/
COPY wasm/enigmatick_wasm/src /opt/build/enigmatick/wasm/enigmatick_wasm/src

WORKDIR /opt/build/enigmatick
RUN source /root/.cargo/env && yarn install && yarn run build

FROM node:23-alpine
RUN apk update && apk --no-cache add ca-certificates nginx certbot
RUN mkdir -p /srv/enigmatick
WORKDIR /srv/enigmatick
COPY --from=builder /opt/build/enigmatick/build ./build
COPY --from=builder /opt/build/enigmatick/package.json ./
COPY --from=builder /opt/build/enigmatick/node_modules ./node_modules

EXPOSE 3000

CMD ["node","build"]
