import { Platform } from 'obsidian';

export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4
}

export class Logger {
    private static instance: Logger;
    private logLevel: LogLevel = LogLevel.ERROR;
    private readonly prefix: string = '[Save Images Offline]';

    private constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    public debug(message: string): void {
        if (this.logLevel >= LogLevel.DEBUG) {
            console.debug(`${this.prefix} ${message}`);
        }
    }

    public info(message: string): void {
        if (this.logLevel >= LogLevel.INFO) {
            console.info(`${this.prefix} ${message}`);
        }
    }

    public warn(message: string): void {
        if (this.logLevel >= LogLevel.WARN) {
            console.warn(`${this.prefix} ${message}`);
        }
    }

    public error(message: string): void {
        if (this.logLevel >= LogLevel.ERROR) {
            console.error(`${this.prefix} ${message}`);
        }
    }
}

export const log = Logger.getInstance();
