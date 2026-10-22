export type ApiContext = {
  headers: Headers;
  env: Env;
  executionCtx: ExecutionContext<unknown>;
  db: DB;
  auth: Auth;
};

export type AuthedApiContext = ApiContext & {
  session: Session;
};
