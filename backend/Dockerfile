# ---- ビルドステージ ----
FROM golang:1.25-alpine AS builder

WORKDIR /src

# 依存だけを先にコピーしてレイヤキャッシュを効かせる。
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# 純Go実装のみを使うため CGO は不要（イメージを小さく保てる）。
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/heron-api ./cmd/server

# ---- 実行ステージ ----
FROM alpine:3.20

# PostgreSQL への TLS 接続とログのタイムスタンプ用。
RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -u 10001 heron

ENV TZ=Asia/Tokyo

COPY --from=builder /out/heron-api /usr/local/bin/heron-api

USER heron
EXPOSE 8080

CMD ["/usr/local/bin/heron-api"]
