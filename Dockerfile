# Используем официальный образ Node.js, так как BotHost ждет его
FROM node:20-slim

# Устанавливаем Python
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

# Создаем виртуальное окружение и ставим Python зависимости
WORKDIR /usr/src/app
RUN python3 -m venv venv
ENV PATH="/usr/src/app/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальной код
COPY . .

# Порт
EXPOSE 3000

# Запуск через npm start (который вызывает python main.py)
CMD ["npm", "start"]
