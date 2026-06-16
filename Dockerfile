# Используем Python 3.13
FROM python:3.13-slim

# Указываем рабочую директорию, отличную от /app, чтобы избежать 
# конфликтов с системным монтированием Bothost
WORKDIR /usr/src/app

# Копируем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальной код
COPY . .

# Порт
EXPOSE 3000

# Запуск
CMD ["python", "main.py"]
