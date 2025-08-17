import { User } from '../middleware/auth';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    requestId: string;
    validatedBody: unknown;
    validatedQuery: unknown;
    validatedParams: unknown;
  }
}
