// Usuários de teste do Nexo: um administrador e uma conta por fase, todos com a mesma senha.
// Cada conta recebe só o perfil da sua fase. Os e-mails usam o domínio reservado example.com:
// não recebem e-mail (as contas já nascem confirmadas, sem convite).
//
// Uso (na pasta central-contratos):
//   node --env-file=.env.local scripts/usuarios-teste.mjs --senha=SUA_SENHA   -> cria (ou atualiza) as contas
//   node --env-file=.env.local scripts/usuarios-teste.mjs --apagar            -> apaga as contas de teste
//   node --env-file=.env.local scripts/usuarios-teste.mjs --simular           -> só mostra o que faria
//
// Administrador, RH e Segurança do trabalho pedem o código do autenticador no 1º login (regra do sistema):
// quem entrar primeiro cadastra o próprio celular.

import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
// A senha nunca fica gravada no código: vem do comando (--senha=...).
const SENHA = typeof args.senha === "string" ? args.senha : "";
const SIMULAR = !!args.simular;

const CONTAS = [
  { email: "admin.teste@example.com", nome: "Admin Teste", papel: "admin" },
  { email: "coordenador.teste@example.com", nome: "Coordenador Teste", papel: "coordenador_obra" },
  { email: "suprimentos.teste@example.com", nome: "Suprimentos Teste", papel: "suprimentos" },
  { email: "gerente.teste@example.com", nome: "Gerente de Suprimentos Teste", papel: "gerente_suprimentos" },
  { email: "contratos.teste@example.com", nome: "Contratos Teste", papel: "contratos" },
  { email: "direcao.teste@example.com", nome: "Direção Teste", papel: "direcao" },
  { email: "rh.teste@example.com", nome: "RH Teste", papel: "rh" },
  { email: "seguranca.teste@example.com", nome: "Segurança do Trabalho Teste", papel: "sst" },
  { email: "empresa.teste@example.com", nome: "Empresa Teste", externo: true },
];
const EMPRESA = { cnpj: "45723174000110", razao_social: "Empresa Teste Ltda (exemplo)", email: "empresa.teste@example.com" };

if (!args.apagar && !SIMULAR && !SENHA) {
  console.error("Informe a senha das contas: --senha=SUA_SENHA (10 ou mais caracteres, com maiúscula, minúscula e número).");
  process.exit(1);
}
if (!args.apagar && !SIMULAR && (SENHA.length < 10 || !/[a-z]/.test(SENHA) || !/[A-Z]/.test(SENHA) || !/\d/.test(SENHA))) {
  console.error("A senha precisa ter 10 ou mais caracteres, com letra maiúscula, minúscula e número.");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SECRET_KEY;
if (!url || !chave) {
  console.error("Rode com: node --env-file=.env.local scripts/usuarios-teste.mjs");
  process.exit(1);
}
const db = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
const falhar = (msg, e) => {
  console.error(`${msg}: ${e?.message ?? e}`);
  process.exit(1);
};

async function usuarioPorEmail(email) {
  const { data, error } = await db.from("usuarios").select("id").eq("email", email).maybeSingle();
  if (error) falhar("Erro ao procurar usuário", error);
  return data?.id ?? null;
}

async function apagar() {
  for (const c of CONTAS) {
    const id = await usuarioPorEmail(c.email);
    if (!id) continue;
    if (SIMULAR) { console.log(`apagaria ${c.email}`); continue; }
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) falhar(`Erro ao apagar ${c.email}`, error);
    console.log(`apagado ${c.email}`);
  }
  if (!SIMULAR) {
    const { error } = await db.from("empresas_terceiras").delete().eq("cnpj", EMPRESA.cnpj);
    if (error) console.warn(`A empresa de teste não foi apagada (pode ter documentos ou contratações ligadas): ${error.message}`);
    else console.log("empresa de teste apagada");
  }
}

async function criar() {
  const { data: obras, error: erroObras } = await db.from("obras").select("id, nome").eq("ativa", true);
  if (erroObras) falhar("Erro ao ler as obras", erroObras);
  if (!obras.length) console.warn("Nenhuma obra ativa: cadastre uma obra para o coordenador e a empresa de teste terem onde trabalhar.");

  for (const c of CONTAS) {
    let id = await usuarioPorEmail(c.email);
    if (SIMULAR) { console.log(`${id ? "atualizaria" : "criaria"} ${c.email} (${c.papel ?? "empresa terceirizada"})`); continue; }
    if (id) {
      const { error } = await db.auth.admin.updateUserById(id, { password: SENHA, ban_duration: "none" });
      if (error) falhar(`Erro ao atualizar a senha de ${c.email}`, error);
      await db.from("usuarios").update({ ativo: true }).eq("id", id);
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email: c.email,
        password: SENHA,
        email_confirm: true,
        user_metadata: { nome: c.nome, ...(c.externo ? { tipo: "externo" } : {}) },
      });
      if (error) falhar(`Erro ao criar ${c.email}`, error);
      id = data.user.id;
    }
    if (c.papel) {
      // Só o perfil da fase: tira outros perfis que a conta tenha ganhado.
      await db.from("usuario_papeis").delete().eq("usuario_id", id).neq("papel", c.papel);
      const { error } = await db.from("usuario_papeis").upsert({ usuario_id: id, papel: c.papel }, { onConflict: "usuario_id,papel", ignoreDuplicates: true });
      if (error) falhar(`Erro ao dar o perfil a ${c.email}`, error);
    }
    if (c.papel === "coordenador_obra" && obras.length) {
      const { error } = await db.from("usuario_obras").upsert(obras.map((o) => ({ usuario_id: id, obra_id: o.id })), { onConflict: "usuario_id,obra_id", ignoreDuplicates: true });
      if (error) falhar("Erro ao ligar o coordenador às obras", error);
    }
    if (c.externo) {
      let { data: empresa } = await db.from("empresas_terceiras").select("id").eq("cnpj", EMPRESA.cnpj).maybeSingle();
      if (!empresa) {
        const r = await db.from("empresas_terceiras").insert(EMPRESA).select("id").single();
        if (r.error) falhar("Erro ao criar a empresa de teste", r.error);
        empresa = r.data;
      }
      if (obras.length) {
        const r = await db.from("empresa_obras").upsert(obras.map((o) => ({ empresa_id: empresa.id, obra_id: o.id })), { onConflict: "empresa_id,obra_id", ignoreDuplicates: true });
        if (r.error) falhar("Erro ao ligar a empresa às obras", r.error);
      }
      const r = await db.from("empresa_usuarios").upsert({ usuario_id: id, empresa_id: empresa.id }, { onConflict: "usuario_id,empresa_id", ignoreDuplicates: true });
      if (r.error) falhar("Erro ao dar acesso à empresa de teste", r.error);
    }
    console.log(`ok ${c.email}`);
  }

  if (!SIMULAR) {
    console.log(`\nContas prontas. Senha de todas: ${SENHA}`);
    console.log("Site: https://nexo-terceiros.vercel.app/login\n");
    for (const c of CONTAS) console.log(`  ${c.email.padEnd(32)} ${c.papel ?? "empresa terceirizada (portal)"}${["admin", "rh", "sst"].includes(c.papel) ? " · pede autenticador no 1º login" : ""}`);
    if (obras.length) console.log(`\nCoordenador e empresa de teste ligados às obras: ${obras.map((o) => o.nome).join(", ")}`);
  }
}

await (args.apagar ? apagar() : criar());
