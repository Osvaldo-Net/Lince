FROM python:3.14.6-alpine3.24

ENV PYTHONUNBUFFERED=1

RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        nmap \
        nmap-nselibs \
        iproute2 \
        sqlite && \
    pip install --no-cache-dir --upgrade \
        "pip>=26.1.2" \
        "flask>=3.1.3" \
        "werkzeug>=3.1.8" \
        requests \
        bcrypt \
        flask-wtf \
        flask-limiter \
        flask-talisman \
        Authlib

WORKDIR /app

COPY . .

RUN mkdir -p /app/data

EXPOSE 5555

CMD ["sh", "-c", "python init_db.py && python app.py"]
