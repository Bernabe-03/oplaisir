import { 
    ExceptionFilter, 
    Catch, 
    ArgumentsHost, 
    HttpException, 
    HttpStatus 
  } from '@nestjs/common'
  
  @Catch()
  export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp()
      const response = ctx.getResponse()
      const request = ctx.getRequest()
  
      let status = HttpStatus.INTERNAL_SERVER_ERROR
      let message = 'Erreur interne du serveur'
      let errors: any = null
  
      if (exception instanceof HttpException) {
        status = exception.getStatus()
        const exceptionResponse = exception.getResponse()
        
        if (typeof exceptionResponse === 'string') {
          message = exceptionResponse
        } else if (typeof exceptionResponse === 'object') {
          const responseObj = exceptionResponse as any
          message = responseObj.message || message
          errors = responseObj.errors
        }
      } else if (exception instanceof Error) {
        message = exception.message
      }
  
      response.status(status).json({
        success: false,
        message,
        errors,
        timestamp: new Date().toISOString(),
        path: request.url
      })
    }
  }