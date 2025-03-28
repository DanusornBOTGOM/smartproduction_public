// utils/errorHandler.js
class Bar1Error extends Error {
    constructor(message, statusCode = 500, type = 'GENERAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.type = type;
    }
}

const errorTypes = {
    DATABASE_ERROR: 'DATABASE_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND'
};

module.exports = { Bar1Error, errorTypes };