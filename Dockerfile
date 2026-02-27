# ─── Aşama 1: Frontend build ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
# VITE_API_URL boş bırakılırsa window.location.origin kullanılır (aynı origin)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ─── Aşama 2: Go backend build ────────────────────────────────────────────────
FROM golang:1.22 AS go-build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/api ./cmd/api

# ─── Aşama 3: Çalışma zamanı ──────────────────────────────────────────────────
FROM gcr.io/distroless/base-debian12
COPY --from=go-build /bin/api /api
COPY --from=frontend-build /app/frontend/dist /frontend/dist
ENV HTTP_ADDR=:8080
ENV FRONTEND_DIR=/frontend/dist
EXPOSE 8080
ENTRYPOINT ["/api"]
