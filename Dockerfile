FROM node:20-slim

WORKDIR /usr/src/app

# Копируем зависимости и ставим их
COPY package*.json ./
RUN npm install

# Копируем остальной код
COPY . .

# Открываем порт
EXPOSE 3000

# Запуск
CMD ["node", "main.js"]
