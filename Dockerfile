FROM golang:1.22 AS build
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/api ./cmd/api

FROM gcr.io/distroless/base-debian12
COPY --from=build /bin/api /api
ENV HTTP_ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["/api"]
