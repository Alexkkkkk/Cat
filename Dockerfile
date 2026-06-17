FROM node:20-slim

# Создаем папку, как ожидает Bothost
WORKDIR /app

# Копируем всё содержимое
COPY . .

# Устанавливаем зависимости
RUN npm install

# Открываем порт
EXPOSE 3000

# Запуск
CMD ["node", "main.js"]
