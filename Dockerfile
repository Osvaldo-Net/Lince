FROM python:3.14.6-alpine3.24
ENV PYTHONUNBUFFERED=1
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        nmap \
        nmap-nselibs \
        iproute2 \
        sqlite
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt
WORKDIR /app
COPY . .
RUN mkdir -p /app/data
EXPOSE 5555
CMD ["sh", "-c", "python init_db.py && python app.py"]
