FROM node:20-slim

# Устанавливаем зависимости для сборки (нужны для sqlite3, если он компилируется на лету)
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем сначала файлы зависимостей (лучше для кэширования слоев Docker)
COPY package*.json ./
RUN npm install --production

# Копируем остальной код
COPY . .

EXPOSE 3000

# Запуск
CMD ["sh", "-c", "node main.js"]
