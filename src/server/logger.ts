import { Request } from 'express';
import winston, { Logger } from 'winston';

interface LogRequest extends Request {
  logger: Logger
};

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: 'user-service' },
  transports: [
    
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),

    new winston.transports.Console({
      format: winston.format.combine(winston.format.prettyPrint(), winston.format.colorize({ all: true })),
    })

  ],
});

export { logger, LogRequest };