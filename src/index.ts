import { criarApp } from "./app";
import { inicializarEsquema } from "./db";

const PORT = Number(process.env.PORT) || 3000;

/**
 * Sobe o servidor DEPOIS de garantir o esquema do banco.
 * Se o banco não responder no boot, falhamos alto (log claro) em vez de
 * aceitar requests e quebrar na primeira consulta.
 */
async function iniciar() {
  try {
    await inicializarEsquema();
  } catch (erro) {
    console.error("❌ Não consegui preparar o banco:", erro);
    process.exit(1);
  }

  criarApp().listen(PORT, () => {
    console.log(`🚐 RotaKids rodando na porta ${PORT}`);
  });
}

iniciar();
