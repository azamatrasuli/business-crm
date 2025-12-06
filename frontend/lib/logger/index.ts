/**
 * Frontend logging service for tracking user actions and errors
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

interface LogEntry {
  level: LogLevel
  timestamp: string
  correlationId: string
  sessionId: string
  userId?: string
  companyId?: string
  message: string
  context?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
  page?: string
  userAgent?: string
}

// Session ID for correlating logs within a session
const sessionId = typeof window !== 'undefined' 
  ? `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  : 'server'

// In-memory buffer for batch sending (in production)
const logBuffer: LogEntry[] = []
const BUFFER_SIZE = 50
const FLUSH_INTERVAL = 30000 // 30 seconds

class Logger {
  private userId?: string
  private companyId?: string
  private isProduction = process.env.NODE_ENV === 'production'

  /**
   * Set user context for all subsequent logs
   */
  setUserContext(userId?: string, companyId?: string) {
    this.userId = userId
    this.companyId = companyId
  }

  /**
   * Clear user context (e.g., on logout)
   */
  clearUserContext() {
    this.userId = undefined
    this.companyId = undefined
  }

  /**
   * Get correlation ID from window or generate new one
   */
  private getCorrelationId(): string {
    if (typeof window !== 'undefined') {
      return (window as Window & { __lastCorrelationId?: string }).__lastCorrelationId 
        ?? `log_${Date.now()}`
    }
    return `log_${Date.now()}`
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    return {
      level,
      timestamp: new Date().toISOString(),
      correlationId: this.getCorrelationId(),
      sessionId,
      userId: this.userId,
      companyId: this.companyId,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      page: typeof window !== 'undefined' ? window.location.pathname : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
    }
  }

  /**
   * Log to console with appropriate styling
   */
  private logToConsole(entry: LogEntry) {
    const styles = {
      DEBUG: 'color: gray',
      INFO: 'color: blue',
      WARN: 'color: orange',
      ERROR: 'color: red',
      FATAL: 'color: red; font-weight: bold',
    }

    const prefix = `[${entry.timestamp.split('T')[1].split('.')[0]}] [${entry.level}]`
    
    if (entry.error) {
      console.group(`%c${prefix} ${entry.message}`, styles[entry.level])
      console.log('Context:', entry.context)
      console.error('Error:', entry.error)
      console.groupEnd()
    } else {
      console.log(`%c${prefix} ${entry.message}`, styles[entry.level], entry.context || '')
    }
  }

  /**
   * Add entry to buffer for remote logging
   */
  private addToBuffer(entry: LogEntry) {
    logBuffer.push(entry)
    
    if (logBuffer.length >= BUFFER_SIZE) {
      this.flush()
    }
  }

  /**
   * Flush log buffer to remote endpoint (in production)
   */
  async flush() {
    if (logBuffer.length === 0 || !this.isProduction) return

    const entries = [...logBuffer]
    logBuffer.length = 0

    try {
      // In production, send to logging endpoint
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ logs: entries }),
      // })
      
      // For now, just log that we would send
      console.log(`[Logger] Would send ${entries.length} log entries to server`)
    } catch (error) {
      // Re-add entries to buffer on failure
      logBuffer.push(...entries)
      console.error('[Logger] Failed to flush logs:', error)
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>) {
    if (this.isProduction) return // Skip debug in production
    
    const entry = this.createEntry('DEBUG', message, context)
    this.logToConsole(entry)
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>) {
    const entry = this.createEntry('INFO', message, context)
    
    if (!this.isProduction) {
      this.logToConsole(entry)
    }
    
    this.addToBuffer(entry)
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>) {
    const entry = this.createEntry('WARN', message, context)
    
    this.logToConsole(entry)
    this.addToBuffer(entry)
  }

  /**
   * Log an error
   */
  error(message: string, error?: Error, context?: Record<string, unknown>) {
    const entry = this.createEntry('ERROR', message, context, error)
    
    this.logToConsole(entry)
    this.addToBuffer(entry)
  }

  /**
   * Log a fatal error
   */
  fatal(message: string, error?: Error, context?: Record<string, unknown>) {
    const entry = this.createEntry('FATAL', message, context, error)
    
    this.logToConsole(entry)
    this.addToBuffer(entry)
    
    // Immediately flush on fatal errors
    this.flush()
  }

  /**
   * Log a user action
   */
  action(actionName: string, context?: Record<string, unknown>) {
    this.info(`User action: ${actionName}`, { ...context, actionType: 'user_action' })
  }

  /**
   * Log page navigation
   */
  pageView(pageName: string, context?: Record<string, unknown>) {
    this.info(`Page view: ${pageName}`, { ...context, actionType: 'page_view' })
  }

  /**
   * Log API call
   */
  apiCall(method: string, url: string, context?: Record<string, unknown>) {
    this.debug(`API ${method} ${url}`, { ...context, actionType: 'api_call' })
  }

  /**
   * Log API response
   */
  apiResponse(method: string, url: string, status: number, duration: number, context?: Record<string, unknown>) {
    const level = status >= 400 ? 'WARN' : 'DEBUG'
    const entry = this.createEntry(level, `API ${method} ${url} -> ${status} (${duration}ms)`, {
      ...context,
      actionType: 'api_response',
      status,
      duration,
    })
    
    if (level === 'WARN' || !this.isProduction) {
      this.logToConsole(entry)
    }
    
    if (status >= 400) {
      this.addToBuffer(entry)
    }
  }
}

// Singleton instance
export const logger = new Logger()

// Set up periodic flushing
if (typeof window !== 'undefined') {
  setInterval(() => logger.flush(), FLUSH_INTERVAL)
  
  // Flush on page unload
  window.addEventListener('beforeunload', () => logger.flush())
  
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    logger.error('Unhandled error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })
  
  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', event.reason instanceof Error ? event.reason : new Error(String(event.reason)))
  })
}

export default logger

