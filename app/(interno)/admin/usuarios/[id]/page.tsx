import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { PAPEIS, ROTULO_PAPEL } from "@/modules/acesso/papeis";
import { alterarSituacaoUsuario, salvarObrasDoUsuario, salvarPerfis } from "@/modules/admin/acoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Formulario, Marcador } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Usuário" };

export default async function PaginaUsuario({ params }: PageProps<"/admin/usuarios/[id]">) {
  const admin = await exigirPapel("admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await criarClienteServidor();
  const [{ data: usuario }, { data: papeis }, { data: obras }, { data: obrasDoUsuario }] = await Promise.all([
    supabase.from("usuarios").select("id, nome, email, ativo, tipo").eq("id", id).maybeSingle(),
    supabase.from("usuario_papeis").select("papel").eq("usuario_id", id),
    supabase.from("obras").select("id, codigo, nome, ativa").order("nome"),
    supabase.from("usuario_obras").select("obra_id").eq("usuario_id", id),
  ]);
  if (!usuario || usuario.tipo !== "interno") notFound();

  const perfis = new Set((papeis ?? []).map((p) => p.papel));
  const ligadas = new Set((obrasDoUsuario ?? []).map((o) => o.obra_id));
  const proprio = usuario.id === admin.id;

  return (
    <>
      <div>
        <Link href="/admin/usuarios" className="text-[14px] text-primary">← Usuários</Link>
        <h2 className="titulo mt-2 text-[28px]">{usuario.nome}</h2>
        <p className="text-[15px] text-muted-foreground">{usuario.email}</p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="painel">
          <h3 className="subtitulo">Perfis</h3>
          <Formulario acao={salvarPerfis.bind(null, usuario.id)} textoBotao="Salvar perfis">
            <div className="lista-agrupada">
              {PAPEIS.map((p) => <Marcador key={p} nome="papeis" valor={p} rotulo={ROTULO_PAPEL[p]} marcado={perfis.has(p)} />)}
            </div>
          </Formulario>
        </section>

        <section className="painel">
          <div>
            <h3 className="subtitulo">Obras do coordenador</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">O coordenador de obra só vê as contratações das obras marcadas aqui.</p>
          </div>
          {(obras ?? []).length === 0 ? (
            <p className="text-[14px] text-muted-foreground">Nenhuma obra cadastrada. <Link href="/admin/obras" className="text-primary">Cadastrar obras</Link></p>
          ) : (
            <Formulario acao={salvarObrasDoUsuario.bind(null, usuario.id)} textoBotao="Salvar obras">
              <div className="lista-agrupada">
                {(obras ?? []).map((o) => (
                  <Marcador key={o.id} nome="obras" valor={o.id} marcado={ligadas.has(o.id)} rotulo={<>{o.nome} <span className="text-faint">· {o.codigo}{o.ativa ? "" : " · desativada"}</span></>} />
                ))}
              </div>
            </Formulario>
          )}
        </section>

        <section className="painel">
          <div>
            <h3 className="subtitulo">Situação</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {usuario.ativo ? "Ativo. Ao desativar, a pessoa deixa de conseguir entrar; o histórico dela continua guardado." : "Desativado. A pessoa não consegue entrar."}
            </p>
          </div>
          {proprio ? (
            <p className="text-[13px] text-faint">Você não pode desativar o próprio usuário.</p>
          ) : usuario.ativo ? (
            <Formulario acao={alterarSituacaoUsuario.bind(null, usuario.id, false)} textoBotao="Desativar usuário" variante="perigo" confirmar={`Desativar ${usuario.nome}? A pessoa não vai conseguir mais entrar.`} />
          ) : (
            <Formulario acao={alterarSituacaoUsuario.bind(null, usuario.id, true)} textoBotao="Reativar usuário" />
          )}
        </section>
      </div>
    </>
  );
}
