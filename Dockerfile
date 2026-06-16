# Используем новейший образ Python 3.13
FROM python:3.13-slim

WORKDIR /app

# Копируем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальной код
COPY . .

# Открываем порт для FastAPI
EXPOSE 3000

# Запуск вашего основного файла
CMD ["python", "main.py"]
