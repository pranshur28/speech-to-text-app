import log from 'electron-log';
import { app } from 'electron';
import path from 'path';

// Configure log file location
log.transports.file.resolvePathFn = () => {
  return path.join(app.getPath('userData'), 'logs', 'main.log');
};

// Set log levels based on environment
if (app.isPackaged) {
  // Production: only info and above
  log.transports.console.level = 'info';
  log.transports.file.level = 'info';
} else {
  // Development: show everything
  log.transports.console.level = 'debug';
  log.transports.file.level = 'debug';
}

// Configure file rotation
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// Export logger
export default log;
