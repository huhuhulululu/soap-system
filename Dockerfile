FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Default command - run core tests only
CMD ["npx", "jest", "--testPathPattern", "(tx-sequence-engine|correction-generator|text-rules)"]
