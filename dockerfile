FROM node:20.14-slim

# ติดตั้ง ODBC Driver สำหรับ SQL Server
RUN apt-get update && apt-get install -y gnupg curl
RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
RUN curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list
RUN apt-get update && ACCEPT_EULA=Y apt-get install -y msodbcsql17 unixodbc-dev

WORKDIR /usr/src/app

COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install

COPY . .

EXPOSE 5000

CMD ["node", "app.js"]
