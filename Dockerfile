# Use the official Node.js 14 image as a parent image
FROM node:14

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json (if available) to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# If you are building your code for production
# RUN npm ci --only=production

# Bundle your app source inside the Docker image
COPY . .

# Make port 3002 available to the world outside this container
EXPOSE 3002

# Run the app when the container launches
CMD [ "node", "main.js" ]