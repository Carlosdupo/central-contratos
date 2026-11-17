import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Textarea } from "@ui-sdk/react/textarea";

// Caixa para colar linhas copiadas do Excel (Ctrl+C vira texto separado por tabulação); o servidor lê como o CSV.
export function CampoColar({ nome = "colado", rotulo, dica, className }: { nome?: string; rotulo: string; dica?: string; className?: string }) {
  return (
    <Field className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <FieldLabel className="text-[13px] font-semibold">{rotulo}</FieldLabel>
      <Textarea name={nome} rows={4} wrap="off" spellCheck={false} placeholder="Selecione as linhas no Excel (com o cabeçalho), copie com Ctrl+C e cole aqui com Ctrl+V" className="campo max-h-60 font-mono text-[12px]" />
      {dica && <FieldDescription className="text-xs text-muted-foreground">{dica}</FieldDescription>}
    </Field>
  );
}

// Escolha de arquivo para enviar com o formulário (a conferência de tipo e tamanho é feita de novo no servidor).
export function CampoArquivo({ nome = "arquivo", rotulo, aceita, dica, className }: { nome?: string; rotulo: string; aceita: string; dica?: string; className?: string }) {
  return (
    <Field className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <FieldLabel className="text-[13px] font-semibold">{rotulo}</FieldLabel>
      <Input type="file" name={nome} accept={aceita} className="campo text-[13px]" />
      {dica && <FieldDescription className="text-xs text-muted-foreground">{dica}</FieldDescription>}
    </Field>
  );
}
