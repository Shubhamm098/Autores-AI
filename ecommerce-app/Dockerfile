# 1. Base Image: This is the starting point. It's like installing a barebones Linux OS with Node.js 18 pre-installed.
# 'alpine' means we are using a super lightweight version of Linux to keep the image size small.
FROM node:18-alpine

# 2. Working Directory: We tell Docker to create a folder called /app inside the container,
# and all subsequent commands will be run from inside this folder.
WORKDIR /app

# 3. Copy Package Files First: We copy only package.json (and package-lock.json if it exists).
# Why? Docker caches layers. If we copy package.json first and run npm install, 
# Docker remembers the result. If we change our source code later but not our dependencies, 
# Docker skips the 'npm install' step and just uses the cache!
COPY package*.json ./

# 4. Install Dependencies: Run npm install inside the container.
RUN npm install --production

# 5. Copy Source Code: Now we copy the rest of our application code from our computer 
# into the /app directory inside the container.
COPY . .

# 6. Expose Port: We document that this container will listen on port 3002.
# (This doesn't actually publish the port to the outside world, it's just documentation for the person running it).
EXPOSE 3002

# 7. Start Command: The command that runs when the container starts.
CMD ["npm", "start"]
