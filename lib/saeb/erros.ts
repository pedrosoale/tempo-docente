// Texto de erro em linguagem corrente para cada tipo de falha do lib/saeb/client.ts. Mantido fora
// do componente React para ficar testável sem jsdom, e para que a UI nunca precise decidir sozinha
// (inline, sem revisão) o que dizer quando algo falha.
import { SaebFetchError, SaebSchemaError, SaebVersionMismatchError } from "./validacao.ts";

export function mensagemDeErro(error: unknown): string {
  if (error instanceof SaebVersionMismatchError) {
    return "Os dados foram atualizados enquanto esta página estava aberta. Tente novamente.";
  }
  if (error instanceof SaebSchemaError) {
    return "Os dados recebidos vieram num formato inesperado. Tente novamente em instantes.";
  }
  if (error instanceof SaebFetchError) {
    return "Não foi possível carregar os dados agora. Verifique sua conexão e tente novamente.";
  }
  if (error instanceof Error) {
    return `Ocorreu um erro inesperado: ${error.message}`;
  }
  return "Ocorreu um erro inesperado.";
}
