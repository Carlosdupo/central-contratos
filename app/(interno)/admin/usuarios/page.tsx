import type { Metadata } from "next";
import Link from "next/link";
import { exigirPapel } from "@/modules/acesso/sessao";
import { PAPEIS, ROTULO_PAPEL, ehPapel } from "@/modules/acesso/papeis";
import { convidarUsuario } from "@/modules/admin/acoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { CampoTexto, Formulario, Marcador } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Usuários" };

export default async function PaginaUsuarios() {
  await exigirPapel("admin");
  const supabase = await criarClienteServidor();
  const [{ data: usuarios }, { data: papeis }, { data: auth }] = await Promise.all([
    supabase.from("usuarios").select("id, nome, email, ativo").eq("tipo", "interno").order("nome"),
    supabase.from("usuario_papeis").select("usuario_id, papel"),
    // Situação do convite vem do Auth (só leitura, depois de conferir o papel admin).
    criarClienteAdmin().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const aceitou = new Map((auth?.users ?? []).map((u) => [u.id, !!u.last_sign_in_at]));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="painel">
        <h2 className="subtitulo">Equipe interna</h2>
        <div className="-mx-1.5 overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr><th>Nome</th><th>Perfis</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {(usuarios ?? []).map((u) => {
                const perfis = (papeis ?? []).filter((p) => p.usuario_id === u.id).map((p) => p.papel).filter(ehPapel);
                const situacao = !u.ativo ? ["selo-neutro", "Desativado"] : aceitou.get(u.id) ? ["selo-ok", "Ativo"] : ["selo-alerta", "Convite pendente"];
                return (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/usuarios/${u.id}`} className="font-medium text-primary">{u.nome}</Link>
                      <div className="text-[12.5px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="text-[13px]">{perfis.map((p) => ROTULO_PAPEL[p]).join(", ") || <span className="text-faint">Sem perfil</span>}</td>
                    <td><span className={`selo ${situacao[0]}`}>{situacao[1]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="painel">
        <div>
          <h2 className="subtitulo">Convidar pessoa</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">A pessoa recebe um e-mail para criar a senha. RH, segurança do trabalho e administradores também cadastram a verificação em duas etapas.</p>
        </div>
        <Formulario acao={convidarUsuario} textoBotao="Enviar convite">
          <CampoTexto nome="nome" rotulo="Nome completo" />
          <CampoTexto nome="email" rotulo="E-mail" tipo="email" />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">Perfis</legend>
            <div className="lista-agrupada">
              {PAPEIS.map((p) => <Marcador key={p} nome="papeis" valor={p} rotulo={ROTULO_PAPEL[p]} />)}
            </div>
          </fieldset>
        </Formulario>
      </section>
    </div>
  );
}
