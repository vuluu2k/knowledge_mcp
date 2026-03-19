# Docker

## Các lệnh cơ bản

```bash
docker build -t myapp .           # build image
docker run -d -p 3000:3000 myapp  # chạy container
docker ps                         # xem container đang chạy
docker logs <container_id>        # xem logs
docker exec -it <id> sh           # vào trong container
docker stop <id>                  # dừng container
```

## Dockerfile tối ưu cho Node.js

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Tips:
- Dùng `alpine` để image nhỏ
- Copy `package.json` trước → tận dụng layer cache
- `npm ci` thay vì `npm install` cho reproducible builds
- Chỉ copy `dist/` — không copy source code

## Docker Compose chạy multi-service

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://db:5432/mydb
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=mydb
      - POSTGRES_PASSWORD=secret
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

```bash
docker compose up -d      # chạy background
docker compose down        # dừng + xoá container
docker compose logs -f     # theo dõi logs
```

## Dọn dẹp Docker

```bash
docker system prune -a     # xoá tất cả unused (images, containers, networks)
docker volume prune         # xoá unused volumes
```
