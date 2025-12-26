// Worker-specific types for Hono context
export interface HonoVariables {
  user?: any;
  currentUser?: any;
  recruiterUser?: any;
  amUser?: any;
  rmUser?: any;
  appUser?: any;
}

export interface Env {
  [key: string]: any;
}

export type HonoContext = {
  Bindings: Env;
  Variables: HonoVariables;
};
