# syntax=docker/dockerfile:1.4

# Stage 1: Build SvelteKit Static SPA
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build
# Precompressed (.gz and .br) handled automatically by adapter-static precompress: true

# Stage 2: Build Pure-Rust Static Server (Target: x86_64-unknown-linux-musl)
FROM rust:alpine AS rust-builder
RUN apk add --no-cache musl-dev
WORKDIR /build

COPY server/Cargo.toml server/Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release --target x86_64-unknown-linux-musl || true

COPY server/src ./src
RUN cargo build --release --target x86_64-unknown-linux-musl

# Stage 3: Minimal Unprivileged Runtime (< 20MB FROM scratch)
FROM scratch

# Create synthetic unprivileged user/group 10001:10001
COPY --from=frontend-builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Synthetic passwd and group
# 10001: ferrous
COPY <<EOF /etc/passwd
ferrous:x:10001:10001:Ferrous Frontend User:/:/bin/false
EOF

COPY <<EOF /etc/group
ferrous:x:10001:
EOF

WORKDIR /app

# Copy compiled Rust static server
COPY --from=rust-builder /build/target/x86_64-unknown-linux-musl/release/ferrous-frontend-server /app/server

# Copy pre-built static SPA assets
COPY --from=frontend-builder --chown=10001:10001 /app/build /app/build

USER 10001:10001

EXPOSE 3000

ENV PORT=3000 \
    STATIC_DIR=/app/build

HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD ["/app/server", "--healthcheck", "--port", "3000"]

ENTRYPOINT ["/app/server"]
