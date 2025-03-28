// libraries/logger/index.js
const logger = {
    error: (message, error) => console.error(message, error),
    info: (message) => console.log(message)
};

module.exports = logger;