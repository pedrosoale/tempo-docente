// Descarte de respostas atrasadas quando o usuário troca de seleção rapidamente (ver
// tests/saeb-consulta-selection.test.mjs). Framework-agnóstico de propósito — sem isto, o projeto
// não teria como testar automaticamente a condição de corrida (não há jsdom/testing-library aqui;
// ver package.json), então a lógica de descarte vive fora do componente React, num módulo puro.
//
// Cada `run()` cancela (aborta) a tarefa anterior ainda em voo e devolve um resultado só se
// nenhuma chamada mais nova a `run()` aconteceu enquanto a tarefa rodava — inclusive quando a
// tarefa antiga IGNORA o abort e resolve de qualquer jeito, e mesmo que resolva DEPOIS da mais
// nova (fora de ordem). O token cobre os dois casos; o AbortSignal é só uma otimização (cancela a
// requisição de verdade quando a tarefa cooperar).
export interface ResultadoDescartado {
  descartado: true;
}

export type ResultadoSelecao<T> = T | ResultadoDescartado;

export function eDescartado<T>(resultado: ResultadoSelecao<T>): resultado is ResultadoDescartado {
  return typeof resultado === "object" && resultado !== null && "descartado" in resultado && (resultado as ResultadoDescartado).descartado === true;
}

export interface SelectionController<T> {
  run(tarefa: (signal: AbortSignal) => Promise<T>): Promise<ResultadoSelecao<T>>;
  /** Cancela a tarefa em voo sem iniciar uma nova — usado ao limpar uma seleção dependente. */
  cancelar(): void;
}

export function createSelectionController<T>(): SelectionController<T> {
  let controladorAtual: AbortController | null = null;
  let token = 0;

  function cancelar(): void {
    controladorAtual?.abort();
    controladorAtual = null;
    token += 1;
  }

  async function run(tarefa: (signal: AbortSignal) => Promise<T>): Promise<ResultadoSelecao<T>> {
    controladorAtual?.abort();
    const controlador = new AbortController();
    controladorAtual = controlador;
    const meuToken = ++token;

    try {
      const resultado = await tarefa(controlador.signal);
      if (meuToken !== token) return { descartado: true };
      return resultado;
    } catch (error) {
      if (meuToken !== token) return { descartado: true };
      throw error;
    }
  }

  return { run, cancelar };
}
