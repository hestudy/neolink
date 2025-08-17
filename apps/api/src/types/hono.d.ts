import { User } from '../middleware/auth';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    requestId: string;
    validatedBody: any;
    validatedQuery: any;
    validatedParams: any;
  }
}
