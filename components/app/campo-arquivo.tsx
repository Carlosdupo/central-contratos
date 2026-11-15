import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";

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
