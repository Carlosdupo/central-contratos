// Roda os testes pgTAP no projeto Supabase ligado, sem Docker.
// Cada arquivo roda dentro de begin/rollback (nada fica gravado). O `supabase db query`
// devolve só o último resultado, então as asserções são gravadas numa tabela temporária
// e listadas no final.
// Uso: node scripts/testes-banco-remoto.mjs [arquivo.test.sql ...]
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pasta = "supabase/tests/database";
const arquivos = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(pasta).filter((f) => f.endsWith(".test.sql")).map((f) => join(pasta, f));
const temp = mkdtempSync(join(tmpdir(), "pgtap-"));
let falhou = false;

for (const arquivo of arquivos) {
  const sql = readFileSync(arquivo, "utf8")
    .replace(/^select plan\(/m, "create temp table _r (n serial, t text);\ngrant all on _r to authenticated;\ngrant all on sequence _r_n_seq to authenticated;\nselect plan(")
    .replace(/^select (?!set_config)/gm, "insert into _r (t) select ")
    .replace(/^insert into _r \(t\) select \* from finish\(\);/m, "insert into _r (t) select * from finish();\nreset role;\nselect string_agg(t, E'\\n' order by n) as resultado from _r;");
  const destino = join(temp, "teste.sql");
  writeFileSync(destino, sql);
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const saida = execFileSync(npx, ["supabase", "db", "query", "--remote", "--yes", "-f", destino], { encoding: "utf8", shell: process.platform === "win32" });
  const json = JSON.parse(saida.slice(saida.indexOf("{")));
  const resultado = json.rows?.[0]?.resultado ?? JSON.stringify(json);
  console.log(`\n== ${arquivo}\n${resultado}`);
  if (/^not ok|failed/m.test(resultado)) falhou = true;
}
process.exit(falhou ? 1 : 0);
