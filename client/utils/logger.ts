/**
 * Logger utility that only logs when running on localhost
 * Prevents console noise in production environments
 */
class Logger {
  private isDev(): boolean {
    return (
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "" ||
        window.location.hostname === "::1")
    );
  }

  log(...args: any[]): void {
    if (this.isDev()) {
      console.log(...args);
    }
  }

  warn(...args: any[]): void {
    if (this.isDev()) {
      console.warn(...args);
    }
  }

  error(...args: any[]): void {
    if (this.isDev()) {
      console.error(...args);
    }
  }

  info(...args: any[]): void {
    if (this.isDev()) {
      console.info(...args);
    }
  }

  debug(...args: any[]): void {
    if (this.isDev()) {
      console.debug(...args);
    }
  }
}

export const logger = new Logger();
