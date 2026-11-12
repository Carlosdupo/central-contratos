import { z } from "zod";

// O Zod 4 testa se o ambiente aceita `new Function()` para compilar validadores mais rápidos.
// Sob a nossa CSP (sem 'unsafe-eval') esse teste falha, é capturado e funciona, mas gera um relatório
// de violação a cada página. No navegador usamos o modo sem compilação e nada é reportado.
if (typeof window !== "undefined") z.config({ jitless: true });
