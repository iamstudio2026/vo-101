# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use ci for deterministic builds from lock file)
RUN npm ci

# Copy source code
COPY . .

# Build the application
# Note: Ensure all VITE_ environment variables are available during build time
ARG VITE_OPENROUTER_API_KEY
ARG VITE_GEMINI_API_KEY
ENV VITE_OPENROUTER_API_KEY=$VITE_OPENROUTER_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

# Build the application
RUN npm run build && ls -la /app/dist

# Production stage
FROM nginx:stable-alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Set broad permissions for web files
RUN chmod -R 777 /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
