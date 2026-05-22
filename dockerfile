FROM node:20-slim

# 1. Instalar dependencias del sistema esenciales primero
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    python3 \
    python3-pip \
    curl \
    libfreetype6 \
    libharfbuzz0b \
    libopenjp2-7 \
    && rm -rf /var/lib/apt/lists/*

# 2. Instalar pikepdf ignorando el entorno estricto de python de Debian
RUN pip3 install pikepdf --break-system-packages

WORKDIR /app

# 3. Descargar plantillas de GitHub de forma segura
RUN mkdir -p templates && \
    curl -L -o templates/deed-template.docx https://github.com/opsNesevich/deeds_v3/releases/download/v.1.0/deed-template.docx && \
    curl -L -o templates/affidavit-template.pdf https://github.com/opsNesevich/deeds_v3/releases/download/v.1.0/affidavit-template.pdf && \
    curl -L -o templates/residency-template.pdf https://github.com/opsNesevich/deeds_v3/releases/download/v.1.0/residency-template.pdf

# 4. Instalar dependencias de la aplicación Node.js
COPY package*.json ./
RUN npm install --omit=dev

# 5. Copiar el código fuente
COPY . .
# cache-bust: 2026-05-22
EXPOSE 8080
CMD ["npm", "start"]
