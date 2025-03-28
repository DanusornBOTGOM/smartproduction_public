ARG NODE_VERSION=20.14.0

FROM node:${NODE_VERSION} AS base

# สร้างไดเรกทอรีแอปพลิเคชัน
WORKDIR /app

# ติดตั้ง MS SQL Server dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gnupg \
    curl \
    apt-transport-https \
    locales \
    && echo "en_US.UTF-8 UTF-8" > /etc/locale.gen \
    && locale-gen

# ติดตั้ง Microsoft repository
RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update

# ติดตั้ง ODBC Driver for SQL Server
RUN ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql17 \
    && apt-get install -y --no-install-recommends unixodbc-dev

# Install dependencies for production only
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# For development, include all dependencies
FROM base AS dev-deps
COPY package*.json ./
RUN npm install

# Build the app
FROM base AS builder
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .
# Add build steps here if needed for your project

# Production image
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy only necessary files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app ./
COPY --from=builder /app/assets ./assets

# Set proper ownership
RUN chown -R expressjs:nodejs /app

USER expressjs

# Create volume for logs or data that needs to persist
VOLUME ["/app/logs"]

# Expose the port
EXPOSE 5000

# Start the server
CMD ["node", "app.js"]