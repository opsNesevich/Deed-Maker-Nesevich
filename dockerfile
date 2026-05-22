FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    python3 \
    python3-pip \
    curl \
    libfreetype6 \
    libharfbuzz0b \
    libopenjp2-7 \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install pikepdf --break-system-packages

WORKDIR /app

# cache-bust: 2026-05-22
RUN curl -L -o templates/deed-template.docx https://github.com/opsNesevich/deeds_v3/releases/download/v.1.0/deed-template.docx && \
    curl -L -o templates/affidavit-template.pdf https://github.com/opsNesevich/deeds_v3/releases/download/v.1.0/affidavit-template.pdf && \
    curl -L -o templates/residency-template.pdf https://github.com/opsNesevich/deeds_v3/releases/download/v.1.0/residency-template.pdf

COPY package*.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 8080
CMD ["npm", "start"]
