# =============================================================================
#  EduPlan · ms-auth · Imagen Docker
# =============================================================================
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# 1) Dependencias (capa en caché mientras package*.json no cambie)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Código fuente
COPY src ./src

# No ejecutar como root
USER node

EXPOSE 3001
CMD ["node", "src/server.js"]
