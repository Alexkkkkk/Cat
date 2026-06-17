FROM node:20-slim

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 3000

# Используем sh -c, чтобы запуск был прямым, 
# это часто обходит автоматические скрипты внедрения Bothost
CMD ["sh", "-c", "node main.js"]
