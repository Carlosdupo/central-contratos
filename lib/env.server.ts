import "server-only";
import { esquemaServidor } from "./env";

export const envServidor = esquemaServidor.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
});
