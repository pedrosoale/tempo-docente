// REFERÊNCIA DE APROVAÇÃO do catálogo da BNCC Computação (Computação na Educação Básica — Complemento
// à BNCC). Valores LITERAIS, congelados uma única vez DEPOIS da conferência visual de todas as páginas
// com tabela do Anexo ao Parecer CNE/CEB nº 2/2022 (ver data/bncc/README.md e a Rodada 26 do relatório).
//
// Nunca é recalculada a partir do arquivo-fonte durante a validação: é justamente isso que a torna
// independente da entrada que valida. Uma contagem agregada (por etapa, ano ou eixo) não distingue uma
// TROCA SIMÉTRICA entre duas habilidades; a tabela canônica de códigos e os hashes por registro, sim.
//
// Atualizar este arquivo é uma ação DELIBERADA, feita só depois de reconferir visualmente contra o PDF
// qualquer registro cujo texto, código, eixo, objeto, página, explicação, exemplo ou relação tenha mudado —
// nunca para "destravar" uma validação que está falhando por engano de transcrição.
//
// Definição do hash de um registro: SHA-256 (hex) de JSON.stringify(<registro do arquivo-fonte, com as
// chaves de todos os objetos ordenadas recursivamente em ordem alfabética>); os registros são os itens de
// "premissas", "competencias" e "registros" do arquivo-fonte, antes de qualquer campo derivado pelo
// gerador. O hash dos metadados cobre todas as outras chaves do arquivo-fonte (fundamento normativo,
// fontes, URLs, correções, divergências, junções, introdução das premissas…).

export const ANEXO_SHA256 = "b0f021db3c7c2c042b821cec5fab7d77ed1888dbb61590461ce2afef404865b7";
export const ANEXO_TAMANHO_BYTES = 1426596;
export const ANEXO_TOTAL_PAGINAS = 75;

export const TOTAIS_POR_ESCOPO = {
  "educacao-infantil": {
    "premissas": 4,
    "competencias": 0,
    "registros": 11
  },
  "anos-iniciais": {
    "premissas": 0,
    "competencias": 7,
    "registros": 50
  },
  "anos-finais": {
    "premissas": 0,
    "competencias": 7,
    "registros": 54
  },
  "ensino-medio": {
    "premissas": 0,
    "competencias": 7,
    "registros": 26
  }
};

export const TOTAL_HABILIDADES_E_OBJETIVOS = 141;

/** Contagem exata por (escopo, ano | bloco de anos | competência) com o detalhamento por eixo. */
export const TOTAIS_POR_GRUPO = {
  "educacao-infantil/objetivos": {
    "total": 11,
    "eixos": {
      "PC": 6,
      "MD": 3,
      "CD": 2
    }
  },
  "anos-iniciais/1º ano": {
    "total": 7,
    "eixos": {
      "PC": 3,
      "MD": 2,
      "CD": 2
    }
  },
  "anos-iniciais/2º ano": {
    "total": 6,
    "eixos": {
      "PC": 2,
      "MD": 2,
      "CD": 2
    }
  },
  "anos-iniciais/3º ano": {
    "total": 9,
    "eixos": {
      "PC": 3,
      "MD": 3,
      "CD": 3
    }
  },
  "anos-iniciais/4º ano": {
    "total": 8,
    "eixos": {
      "PC": 3,
      "MD": 2,
      "CD": 3
    }
  },
  "anos-iniciais/5º ano": {
    "total": 11,
    "eixos": {
      "PC": 4,
      "MD": 3,
      "CD": 4
    }
  },
  "anos-iniciais/1º ao 5º ano": {
    "total": 9,
    "eixos": {
      "PC": 4,
      "MD": 3,
      "CD": 2
    }
  },
  "anos-finais/6º ano": {
    "total": 10,
    "eixos": {
      "PC": 6,
      "MD": 2,
      "CD": 2
    }
  },
  "anos-finais/7º ano": {
    "total": 11,
    "eixos": {
      "PC": 5,
      "MD": 2,
      "CD": 4
    }
  },
  "anos-finais/8º ano": {
    "total": 11,
    "eixos": {
      "PC": 4,
      "MD": 2,
      "CD": 5
    }
  },
  "anos-finais/9º ano": {
    "total": 10,
    "eixos": {
      "PC": 3,
      "MD": 2,
      "CD": 5
    }
  },
  "anos-finais/6º ao 9º ano": {
    "total": 12,
    "eixos": {
      "PC": 6,
      "MD": 4,
      "CD": 2
    }
  },
  "ensino-medio/competencia 1": {
    "total": 6,
    "eixos": {}
  },
  "ensino-medio/competencia 2": {
    "total": 2,
    "eixos": {}
  },
  "ensino-medio/competencia 3": {
    "total": 3,
    "eixos": {}
  },
  "ensino-medio/competencia 4": {
    "total": 5,
    "eixos": {}
  },
  "ensino-medio/competencia 5": {
    "total": 2,
    "eixos": {}
  },
  "ensino-medio/competencia 6": {
    "total": 4,
    "eixos": {}
  },
  "ensino-medio/competencia 7": {
    "total": 4,
    "eixos": {}
  }
};

/** Tabela canônica: código oficial → onde ele vive. Eixo: PC = Pensamento Computacional, MD = Mundo
 * Digital, CD = Cultura Digital. */
export const CODIGOS_CANONICOS = {
  "EF01CO01": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"1º ano","bloco":null,"competencia":null,"objeto":"Organização de objetos","pagina":16},
  "EF01CO02": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"1º ano","bloco":null,"competencia":null,"objeto":"Conceituação de Algoritmos","pagina":16},
  "EF01CO03": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"1º ano","bloco":null,"competencia":null,"objeto":"Conceituação de Algoritmos","pagina":16},
  "EF01CO04": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"1º ano","bloco":null,"competencia":null,"objeto":"Codificação da informação","pagina":16},
  "EF01CO05": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"1º ano","bloco":null,"competencia":null,"objeto":"Codificação da informação","pagina":16},
  "EF01CO06": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"1º ano","bloco":null,"competencia":null,"objeto":"Uso de artefatos computacionais","pagina":18},
  "EF01CO07": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"1º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso de tecnologia computacional","pagina":18},
  "EF02CO01": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"2º ano","bloco":null,"competencia":null,"objeto":"Modelagem de objetos","pagina":20},
  "EF02CO02": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"2º ano","bloco":null,"competencia":null,"objeto":"Algoritmos com repetições simples","pagina":20},
  "EF02CO03": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"2º ano","bloco":null,"competencia":null,"objeto":"Instrução de máquina","pagina":20},
  "EF02CO04": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"2º ano","bloco":null,"competencia":null,"objeto":"Hardware e software","pagina":20},
  "EF02CO05": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"2º ano","bloco":null,"competencia":null,"objeto":"Uso de artefatos computacionais","pagina":20},
  "EF02CO06": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"2º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso de tecnologia computacional","pagina":20},
  "EF03CO01": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"3º ano","bloco":null,"competencia":null,"objeto":"Lógica computacional","pagina":22},
  "EF03CO02": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"3º ano","bloco":null,"competencia":null,"objeto":"Algoritmos com repetições condicionais simples","pagina":22},
  "EF03CO03": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"3º ano","bloco":null,"competencia":null,"objeto":"Decomposição","pagina":22},
  "EF03CO04": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"3º ano","bloco":null,"competencia":null,"objeto":"Codificação da informação","pagina":24},
  "EF03CO05": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"3º ano","bloco":null,"competencia":null,"objeto":"Codificação da informação","pagina":24},
  "EF03CO06": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"3º ano","bloco":null,"competencia":null,"objeto":"Interface física","pagina":24},
  "EF03CO07": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"3º ano","bloco":null,"competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":26},
  "EF03CO08": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"3º ano","bloco":null,"competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":26},
  "EF03CO09": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"3º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":26},
  "EF04CO01": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"4º ano","bloco":null,"competencia":null,"objeto":"Matrizes e registros","pagina":28},
  "EF04CO02": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"4º ano","bloco":null,"competencia":null,"objeto":"Matrizes e registros","pagina":28},
  "EF04CO03": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"4º ano","bloco":null,"competencia":null,"objeto":"Algoritmos com repetições simples e aninhadas","pagina":30},
  "EF04CO04": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"4º ano","bloco":null,"competencia":null,"objeto":"Codificação da informação","pagina":30},
  "EF04CO05": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"4º ano","bloco":null,"competencia":null,"objeto":"Codificação da informação","pagina":30},
  "EF04CO06": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"4º ano","bloco":null,"competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":30},
  "EF04CO07": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"4º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":30},
  "EF04CO08": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"4º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":30},
  "EF05CO01": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Listas e grafos","pagina":32},
  "EF05CO02": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Listas e grafos","pagina":32},
  "EF05CO03": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Lógica computacional","pagina":32},
  "EF05CO04": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Algoritmos com seleção condicional","pagina":34},
  "EF05CO05": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Arquitetura de computadores","pagina":34},
  "EF05CO06": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Armazenamento de dados","pagina":34},
  "EF05CO07": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Sistema operacional","pagina":34},
  "EF05CO08": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":36},
  "EF05CO09": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":36},
  "EF05CO10": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":36},
  "EF05CO11": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":"5º ano","bloco":null,"competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":36},
  "EF06CO01": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"6º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":42},
  "EF06CO02": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"6º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":42},
  "EF06CO03": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"6º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":42},
  "EF06CO04": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"6º ano","bloco":null,"competencia":null,"objeto":"Estratégias de solução de problemas","pagina":42},
  "EF06CO05": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"6º ano","bloco":null,"competencia":null,"objeto":"Estratégias de solução de problemas","pagina":42},
  "EF06CO06": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"6º ano","bloco":null,"competencia":null,"objeto":"Estratégias de solução de problemas","pagina":42},
  "EF06CO07": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":"6º ano","bloco":null,"competencia":null,"objeto":"Armazenamento e Transmissão de dados","pagina":44},
  "EF06CO08": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":"6º ano","bloco":null,"competencia":null,"objeto":"Armazenamento e Transmissão de dados","pagina":44},
  "EF06CO09": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"6º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":44},
  "EF06CO10": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"6º ano","bloco":null,"competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":44},
  "EF07CO01": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":46},
  "EF07CO02": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":46},
  "EF07CO03": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":46},
  "EF07CO04": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":46},
  "EF07CO05": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Estratégias de solução de problemas","pagina":48},
  "EF07CO06": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Armazenamento e Transmissão de dados","pagina":48},
  "EF07CO07": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Armazenamento e Transmissão de dados","pagina":48},
  "EF07CO08": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":50},
  "EF07CO09": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":50},
  "EF07CO10": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":50},
  "EF07CO11": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"7º ano","bloco":null,"competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":50},
  "EF08CO01": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":52},
  "EF08CO02": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":52},
  "EF08CO03": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":52},
  "EF08CO04": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":52},
  "EF08CO05": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Sistemas distribuídos e internet","pagina":52},
  "EF08CO06": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Sistemas distribuídos e internet","pagina":52},
  "EF08CO07": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":54},
  "EF08CO08": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":54},
  "EF08CO09": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":54},
  "EF08CO10": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":54},
  "EF08CO11": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"8º ano","bloco":null,"competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":54},
  "EF09CO01": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"9º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":56},
  "EF09CO02": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"9º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":56},
  "EF09CO03": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":"9º ano","bloco":null,"competencia":null,"objeto":"Programação","pagina":56},
  "EF09CO04": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":"9º ano","bloco":null,"competencia":null,"objeto":"Sistemas distribuídos e internet","pagina":56},
  "EF09CO05": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":"9º ano","bloco":null,"competencia":null,"objeto":"Sistemas distribuídos e internet","pagina":58},
  "EF09CO06": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"9º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":58},
  "EF09CO07": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"9º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":58},
  "EF09CO08": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"9º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":58},
  "EF09CO09": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"9º ano","bloco":null,"competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":58},
  "EF09CO10": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":"9º ano","bloco":null,"competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":58},
  "EF15CO01": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":null,"bloco":"1º ao 5º ano","competencia":null,"objeto":"Organização e representação da informação","pagina":38},
  "EF15CO02": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":null,"bloco":"1º ao 5º ano","competencia":null,"objeto":"Algoritmos","pagina":38},
  "EF15CO03": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":null,"bloco":"1º ao 5º ano","competencia":null,"objeto":"Lógica computacional","pagina":38},
  "EF15CO04": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"PC","ano":null,"bloco":"1º ao 5º ano","competencia":null,"objeto":"Decomposição","pagina":38},
  "EF15CO05": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":null,"bloco":"1º ao 5º ano","competencia":null,"objeto":"Codificação da informação","pagina":40},
  "EF15CO06": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":null,"bloco":"1º ao 5º ano","competencia":null,"objeto":"Funcionamento de dispositivos computacionais","pagina":40},
  "EF15CO07": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"MD","ano":null,"bloco":"1º ao 5º ano","competencia":null,"objeto":"Sistema Operacional","pagina":40},
  "EF15CO08": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":null,"bloco":"1º ao 5º ano","competencia":null,"objeto":"Uso de artefatos computacionais","pagina":40},
  "EF15CO09": {"escopo":"anos-iniciais","tipo":"habilidade","eixo":"CD","ano":null,"bloco":"1º ao 5º ano","competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia computacional","pagina":40},
  "EF69CO01": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Programação","pagina":60},
  "EF69CO02": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Programação","pagina":60},
  "EF69CO03": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Programação","pagina":60},
  "EF69CO04": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Estratégias de solução de problemas","pagina":60},
  "EF69CO05": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Estratégias de solução de problemas","pagina":60},
  "EF69CO06": {"escopo":"anos-finais","tipo":"habilidade","eixo":"PC","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Estratégias de solução de problemas","pagina":60},
  "EF69CO07": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Armazenamento e Transmissão de dados","pagina":62},
  "EF69CO08": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Armazenamento e Transmissão de dados","pagina":62},
  "EF69CO09": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Sistemas distribuídos e internet","pagina":62},
  "EF69CO10": {"escopo":"anos-finais","tipo":"habilidade","eixo":"MD","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Sistemas distribuídos e internet","pagina":62},
  "EF69CO11": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Segurança e responsabilidade no uso da tecnologia","pagina":62},
  "EF69CO12": {"escopo":"anos-finais","tipo":"habilidade","eixo":"CD","ano":null,"bloco":"6º ao 9º ano","competencia":null,"objeto":"Uso de tecnologias computacionais","pagina":62},
  "EI03CO01": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"PC","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":6},
  "EI03CO02": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"PC","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":6},
  "EI03CO03": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"PC","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":6},
  "EI03CO04": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"PC","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":8},
  "EI03CO05": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"PC","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":8},
  "EI03CO06": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"PC","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":8},
  "EI03CO07": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"MD","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":10},
  "EI03CO08": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"MD","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":10},
  "EI03CO09": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"MD","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":10},
  "EI03CO10": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"CD","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":12},
  "EI03CO11": {"escopo":"educacao-infantil","tipo":"objetivo_aprendizagem","eixo":"CD","ano":null,"bloco":null,"competencia":null,"objeto":null,"pagina":12},
  "EM13CO01": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":1,"objeto":null,"pagina":66},
  "EM13CO02": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":1,"objeto":null,"pagina":66},
  "EM13CO03": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":1,"objeto":null,"pagina":66},
  "EM13CO04": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":1,"objeto":null,"pagina":66},
  "EM13CO05": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":1,"objeto":null,"pagina":66},
  "EM13CO06": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":1,"objeto":null,"pagina":66},
  "EM13CO07": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":2,"objeto":null,"pagina":68},
  "EM13CO08": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":2,"objeto":null,"pagina":68},
  "EM13CO09": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":3,"objeto":null,"pagina":68},
  "EM13CO10": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":3,"objeto":null,"pagina":68},
  "EM13CO11": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":3,"objeto":null,"pagina":68},
  "EM13CO12": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":4,"objeto":null,"pagina":70},
  "EM13CO13": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":4,"objeto":null,"pagina":70},
  "EM13CO14": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":4,"objeto":null,"pagina":70},
  "EM13CO15": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":4,"objeto":null,"pagina":70},
  "EM13CO16": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":4,"objeto":null,"pagina":70},
  "EM13CO17": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":5,"objeto":null,"pagina":70},
  "EM13CO18": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":5,"objeto":null,"pagina":70},
  "EM13CO19": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":6,"objeto":null,"pagina":72},
  "EM13CO20": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":6,"objeto":null,"pagina":72},
  "EM13CO21": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":6,"objeto":null,"pagina":72},
  "EM13CO22": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":6,"objeto":null,"pagina":72},
  "EM13CO23": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":7,"objeto":null,"pagina":74},
  "EM13CO24": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":7,"objeto":null,"pagina":74},
  "EM13CO25": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":7,"objeto":null,"pagina":74},
  "EM13CO26": {"escopo":"ensino-medio","tipo":"habilidade","eixo":null,"ano":null,"bloco":null,"competencia":7,"objeto":null,"pagina":74},
};

export const HASH_METADADOS = {
  "educacao-infantil": "f5cda5d9d97c66581f631fb107473a294a24b058dfe6d1000628fef5ae4e31fa",
  "anos-iniciais": "e0473f0f083cec2f81c6840d8298033723f5251c0359326adc1aebaa1e39bb01",
  "anos-finais": "df43917c5baeaa401b388e2fb0b4e34a8f714b8ac0b8728eb62fd1ebcb5594c0",
  "ensino-medio": "f8a097da401f8910ad34885234cfc77a2e7438f1e7b62533597fd51fee49c29d"
};

export const HASHES_APROVADOS = {
  "educacao-infantil": [
    "03cafe86de0e1c71642820e3ad3afe81e8313d78fbccaa28752530b415856d80",
    "13ded2203bfb3d45fa4ed8c1eb8b2450e0d6f7a7c733f96704970b19f9976a58",
    "2d13b971c8857f6a5f8eaa8192c9d05596a6677b17b6320ee6bc9fa871f48619",
    "47611f0b2182fe41a0ee8591e0d026b2cb07e920d11278b5d35dd21905f756f2",
    "4dd1ffc8974a23db61e5bc91abf2b1c3eff82c77bfdd5a127e8d63713c9ed709",
    "5c8040af6ce733edad0c8003ff728e180a3788eaa1667919a6d3679e10f74f81",
    "5e69ceff2885966915b58b0be84d9276c393a44b45c8a6a7b296761c62080cea",
    "9349772e71f467dcb6768d95d531ef0126d88a624d4eeec33433ee455a46ecb9",
    "93ba5fc1ba047e45d514957626930e1d2be3960294b4d9938b754c540076ac38",
    "979e22ecd4c8b5ead863f2f2b18593ff1747b4bd033b8b38b782385b24258896",
    "a413b4f7449929fa324a5c5500593dd7c3bc1ee19500ae9ed87a6481e90ed65d",
    "ca498fb8d6f8a733465ac8e1ce9fc01b6ed8196eea4ffd13113fd7fd9242c922",
    "e095f02e4b48caf888aa7f2c8239fdff729579facc09b5b60b263e29721ed245",
    "f3598fecc868622287dfa30e4df7be0b4db93bb64899e4551dac8c2038d1e307",
    "ff28ff781c92284561544532e5715dc3c45debcfba85fea083bfcadd9914b68e",
  ],
  "anos-iniciais": [
    "02cd01d5f491977e31b23ea5f78da937766a43c282ea688ef072483d68853b2d",
    "0b88be36d3796e22db6539b930b01dd6171519cd25b4b5828df9a2b769db2bf5",
    "0d0e2609b5245de0bab8472ab3de1297b82a3df4f7ab205d768cceec1ffeed7d",
    "0ee70396603a6407a1a4fe3b82e1f558560136269251f61c2ae0365639582c4f",
    "0eed3bc1d15132e6a982fe1f93268fe0b6017f2745bd76ac860f1f545ae67e90",
    "11596b559aa0800900b71cd4101bd01270475cc268733083e09eb925bcd717be",
    "149e0b8720040e3f63ee0c1110d55e35d18592ff7e95221366189574209f4a64",
    "14e0d52383e44b0e690c362935069804d532c20a57a9d4ece4d0fa62ecfe5b17",
    "18b4c937763d2aabda28b0fbefbf4a8318d553b9f8467a3c49bd6ef287f8d94f",
    "1a790d4617842ddfa2edfd5b50fef859f76bbd294e232a0d5ebc358766ace2d8",
    "25592b851d1aa4d75b05491e707f14ca1539413b63f874601ae50288170a84a2",
    "29088e2cf522c9a7ea0b218c9d7700fa6a3ad7d45e5136268bc609181fa416d3",
    "297a2e329ff274552f2ee093d9bc4d12f577e18bd33514a2f5b62dd378c85a6f",
    "29d8548f357d9f653b4eb37c22b6ac2149783e729834f88bd462da87d22ea6f5",
    "2c6f3297949ef76a21f621267ac6cec66f7ea31ef1d5cef7df3b8b6a6d13f6ca",
    "2dd873fe963bb5a4b87cfe5b706184c314938b6d65f33cd94476ef5259e91fcf",
    "354060c3bdb5992b474cca99ca6482abc710c2a56e368f658db8f3fffeda06b8",
    "38e57c70f5390d23d4e1742edeb1fc2fa58d8551946fb94da7b222be0144519d",
    "3ae679343c951f1e50456c470b0c44155963f93fd87a580518ea273324697e20",
    "4109226bb630d1ea3b7052d4b09c6034a2f215159e0da374e8a4c7b11fc5c689",
    "44a2f7fc573c5f87b6784f3a963e62d4c2109e56ce98862714239e18128a02bb",
    "470db884ada3933e04f96fbff7822a569addad3765c1b71bd1df10d56e8d40f0",
    "5303387be8e4d2168b212a15a03156f94723f1d17b6c0d5022bcee5bd2fb6a42",
    "55ed0dea32f3064146a29fd4538339240a9ef2964a6c025a992a13421be3086a",
    "572cca9297e25eb2ba5aeb92eab862f10a3937e95284ef2cfd560889506c7808",
    "6c75412a8c9484f388b8711b3b8cbb2c78d57e76058b4db173a15fd55f94b948",
    "72d69e56bef68d617a37a828e0270ab45544e315e14f7fa41ef01642afd4951a",
    "73940dcaa018dc13ac27f643555b6d9dafea3b8764f818d43ad622fcd257e4c2",
    "7d8c03c59eb523ee599719109eeee6e7b5e30bd5d82068ebdbed69cb5efc8e66",
    "7f1980e3474995f4bb6acab0e7518158c41bca5b0dc16ea3719bccafe06b2244",
    "87a73450178cd00eae8927dca18c40ce663adc2a9a8e444bb3fab2359333d6d3",
    "887dcdf4ae8dd24aec6ce55cf031d285e40f1b466656e940bb736be534eefe32",
    "8a5edb9a4fc02c697b80af5481f95653fb4ff4ac4d3fe34c12ea3ab412a17437",
    "8b1885ca66b8f2d2bff3ff5cf801ab626d538836d3bcb635b7af1ffd8598395e",
    "8eef18f962a4aea48754c647dd9765773c9ac59925f806fe410432cd3c224664",
    "8ffb01af5eca386973ec00cdfe5e9e72533e97176c107c08c14f822955a683b7",
    "9ef99802b696f7d273f2b27f0db5383ae49dde825995de0eb76f4056223be70b",
    "9f628b13e2c552befc00eb1737a853810ce815238c45f0e2c7bab658493aaedc",
    "a5bed3018af22508f85e2dcea6f62daebce8a6e0b56c997f40eb37b541b5196a",
    "a7d90882d432bc86478712588ed6a6a6610548d806cc87912e83420bb959a3cb",
    "afa555551a6b2e0cc63c72f3349efbf0b59d85b6a850648d37c2d227698419ff",
    "b490df96c7deb7205ad3abb4b30c3d051066d2b61476192e62987f8cb7b364ab",
    "bca2af74c5633f71ce338b068bcabe0a5899f974ddf38178df211f40a623eb8c",
    "bd66d483e4db9a0f9c973fed3dbfe4cefd46701e7c589d9c98e892d1e092227d",
    "bddea7da1fc1ece703e628d0279cdc094ae73578f386d16f6ad328bb4a69eeae",
    "bea70cda416b419f0f7a57f7baaf702c7c32e2828a6cc7f5ff3074e38377a948",
    "c25e50d4f94a6e093e87cf1afce1baa54f5625990a6fa2bd3ca45e83c1f086d9",
    "c86ab633beded1426a219d6ef7560f47ea2bb3cd813a24b392ecfafd4e11ca7e",
    "c86c7c4e3fa77f46ea340e64e113379f7d7b66a3c7d31e1a1a15d834ee912ade",
    "ca742e6c478484a5a99d6d4975ccdc7e61f751e285a7718933d4c7ee64327237",
    "cee8964105f373c74d9cd85ad4efb09d83eb0bf414f0d1f4773ad789bb3b5626",
    "d045c00dbc70def584c4c09453a7bef806af77f323c37bdb44d5dc24e4a7f907",
    "d31ae253063557430f165a46122277649046823548e231ef4359c4e0c86fa362",
    "df963a6fc24cceba2ed221839dc6359b44f56c41d710849ee1e72ce87cc1dff3",
    "e40e1bd2952670ed0e64c1038a392bdafbd2884234a65bbcf5a6c03cbf778e56",
    "fa7e7b9892157ce37671cf5e66907c706deaa242b1544531d581f0c97d0227ce",
    "fc2aa16bac966107f015f9ae3f957badfb7babb1946259fbae9b65efd55d9668",
  ],
  "anos-finais": [
    "00e1fd13fdb21d247be3824ce209bfe446af7b74fcda4fa082e411744d2986c6",
    "01b7f37fc8331330e52e95592cbc4d3fa2573af77666837c6a18b9d64ca73df9",
    "04a19041416370404d6cebfdf039d789dcc2cfc52d6ba0709b6bc7824a1b764a",
    "0879d8d808bab502134ca85c83a484824b30b004d13ad2fbadcf092902ef5c3d",
    "09d901f1cc5d4f00974f386b886a8234918d84df47c1211d2f6e71c9dd200e3e",
    "0b88be36d3796e22db6539b930b01dd6171519cd25b4b5828df9a2b769db2bf5",
    "0ffe20549f5faebb37980e1c198a32e1f7f4d3638eb72000512337930a38a574",
    "15288d539f14a2329c69f7f12396eaff6d80ec3b4a21d50305db2f95f4c6d240",
    "16ab2d1dfa2963a42c6746e002efcc8d0f2ebe6dcc6f4b25221c9a5b5c7e24f6",
    "18b4c937763d2aabda28b0fbefbf4a8318d553b9f8467a3c49bd6ef287f8d94f",
    "19b8e8a397b42b5a83d5af3d3879a853bb5ca69a4a1c63a39a4d2dcf3588b4d7",
    "1eea4dd41899b562e52e5cb46485d97c0b69b159368969f212089dbfb8251533",
    "201886f73a37f0e8c45a140511df70f52265d3cfe72a5e121c1eee7d82699fc4",
    "28d37e31cc16ddba9a4e7e6c40770f44b40e3cff80f8eeac435ff979e8d91e9b",
    "2c6f3297949ef76a21f621267ac6cec66f7ea31ef1d5cef7df3b8b6a6d13f6ca",
    "2f42d340fa9141e6d61671b4dafa2cc25ecbace8e7dac3340905e764ba2a3762",
    "319ce6c3127bab1a4e13416789cde9ac3b663d83b3dae6b696ed1658a34bc51d",
    "34b2972d72ceaec6fc25470fdb8676d1a0c7d1740dcc5db8efef798059be6d57",
    "35c3fa30bab997e1a211bf60c7894c1c72ba71acca22c0017bb3c2edbbb64070",
    "3ae679343c951f1e50456c470b0c44155963f93fd87a580518ea273324697e20",
    "434735bcb2963bd9abb1765b5a458824958022de7a0473e8f5c2bb13c09092fd",
    "436ecdf9c80e16284ac586cdbf0ee8ca47364c50d719da422b724d25c69575ca",
    "43dd0d9211215679c9e1fde2ee8e798368774e323d304431e5154f6d7540ef8f",
    "46894ae60f471909e3b6db99dcdf23181c15e05894b532739ab8e6b0af652319",
    "488de62fb42a494a0ac836f97ddbff93b141a23d7c30974b798489c5a6b9b437",
    "4e384cedaa04c9dda096fe14c5415244f88a24356357dab074137ba2011da245",
    "527b7cce65dc6964fba852d2e4063ee98b911297bc7e69dce04930377530b4ab",
    "567ed6fef7a908a96ba7e3f70bfe839b22a46f61c0dc69c43ccd2b7102d9a2d9",
    "5d225c782479cde23a3ddea9e30eac7c58f4db2fb9d639bbfddb50a50c68e381",
    "694799e6a0a8ba33cecdd949ccf4174131a551c3c7439519162789c12a7975a9",
    "6c40c67cdf314406edc76ea58ac26603adc7cc50cdd07ca85127a2bd2fb74a7b",
    "73940dcaa018dc13ac27f643555b6d9dafea3b8764f818d43ad622fcd257e4c2",
    "74ca8e6bded968b5c20467dda11df30fa76f615150e2914b96a644c837e90254",
    "7c90725042feb178332a54c3f51861308b8a4fe375416e36b27622ab5d8ea481",
    "7f732baf1cdbd21dc93565ad47ba17054e7ab844092332b273bd2ddeb659317f",
    "8455e75a517b194225da1015ee022e5633cc290dc9da768e881eed4063e8a602",
    "8c140ba4ca58dc3ea4c94f1eea1361278f1911929db7e473ca92d84fc8dbad86",
    "8e6cadcdedbf3d74c4992e1ad6c587fd084f0ccde917d5c1e63a4583b2ba61d7",
    "8f93217c4139a9c526222a7e8ff2f6e524422287d089276ca6ae202879b6e4dd",
    "9bd0524512a9eca49906998de10e57371449874352c55738a7fc8f98e7de0163",
    "ac8313164df88d1cff0c1999ba7a3bc73868d38f3a718ab483d579b9d86cc0ac",
    "acfc26dce81b602df01e2b594db93023f4bd92a2acd1a9e61c0ea07929775c7a",
    "b1e16236e7464f9a5ee8fe87f331fa8b44559ba4408192878ca6f7c385b30186",
    "b28a0e17219e48cd72dabee42b34e469b7775ee87edd5136b5541d8490c546ad",
    "b490df96c7deb7205ad3abb4b30c3d051066d2b61476192e62987f8cb7b364ab",
    "bbcbb290abad4c8d2383c6cc77423f4ef8842b62ff1d54f63efd9d64533d52d6",
    "bea70cda416b419f0f7a57f7baaf702c7c32e2828a6cc7f5ff3074e38377a948",
    "beaf2cb7a29d06a380a4b0a9f34231d59b64d3a7f82b4301084bdc29755cc245",
    "c3d4ab567dd29ca1309c5a03c75a70c14b1b020d8416b1a0fab7727833493a4a",
    "c47683a69a9a08304e4339f00a5b0498c5ffba08f13522fe01b2c9a144574fa6",
    "cb8552898ccbb2b0857d834d6bd2dba6147b3911078ec2e819a1dbc547217c73",
    "dc62ae4be47c9090edbd32942db83042490a02a5c8d2faaa2a6abc7b639e45ef",
    "dc7ad834ebc472476a8e6654d17659a9c34b2986a36f094cc26382514d373916",
    "de486d4014dea5334a236051851cc731726dea387baea7f39b480f20e3a50b15",
    "df12c076ecb99de2deba427d2ec4cfc269b33f556cdc4b41000111ac27890de9",
    "e7bcf4206f13e5a44a30a3f3e31ae96b3479234c1b947dd5d0c9160e368a461f",
    "f2f299b8af8d186b0aa98fc35193de068a96d88c3817a3d8c764d59e259fa338",
    "f3707978e5387281a7a9e5ec227919113cd870eb69939735227342c06bdac6e3",
    "f875590456376418650e5c38d9b54a683ed9068b26e72d56d7183bac2281cca7",
    "fe99c400d5cf9bae2f7a7fc877acf69fe323eb9de00fe59b4e06bf5de549bc06",
    "ff72a38b6c6251045fa1a54ab7c8f819751555c35f911336f5e187655241b105",
  ],
  "ensino-medio": [
    "0c4082f2f43a3c48e4bf7291bc1b44cd2147d292a683a8439bc40427235648b3",
    "125818c310588c85754688ba0225cdf3df13c5aa50020165ad05dd832c4539d0",
    "16b2a46716c4d2c469fd5da7e89f1d29d1287a35644936df5a18e6e45c3ad83c",
    "185fad670fe6d7eaa7e7a3157c593a92d211bee620e13324facdcc7453de6f75",
    "1b1d50e4b580d42cd82b3cfef5956df8ce7e62d1404eb0d13f44c74ea765aea8",
    "2438285663057e0d9cb73bd7c3c7d309be0dbcd4892720a937788e27327379e5",
    "3745e07aa850b49d0dfbe095d3b6e223a2d2b49b01b38a06942be677eb5b0193",
    "3aa444fcea566f6e253baf8755c389187477f69dfd1bd732cb8acbf1d661d3c8",
    "3f76576c50f3a3a18e149719bba6e8dd3f6e072c484c87545bafbab67dd23385",
    "4e644c0a36fba07c0fc05a2246c18ae596b9d19fefdda306101377525301a77a",
    "50a8dc63a378221720ab9702775617b86d7cf8e69da8b34acd599a6fbd394c8b",
    "602b8686552b862c78fd66497b996721d4b787c1603492dde7c53d64e10e912c",
    "603051aa37c8ffb228e6f1bb5430ebefcdcd41cbfb9a8064dd89bcfcdfe47967",
    "61101254f8ab017514bf903e2365774d11488aa63f368d3444b3de2fd087fb49",
    "617a10ee59607d01b2d3c1ed895391a76df0dda57a4399814a0f12e6db158871",
    "6fdc49833aa3093d883ac3e5c0634d022709033896ace495297484df6b7ecfef",
    "782b7062156912f01073ed9cdcc7837d8ae40dcfb10d8d415d37248b717b64e7",
    "7e80649e46815774d6359d153a06f753111e8df1145d6f6d1d2737c4510b4f3d",
    "85bfc016b3e9ffa397147354ebcd68e03316f9930ca593ffe52e54072b979831",
    "8a7c06f233ecc80445890c0c8d9822e27fd09c0e9868b57a17e86a865d697f5f",
    "a09f132a8f122f7f0adb889d08416807e98b3937fd01689cea33ee5e63768499",
    "a18ac12f968e9a64ec7f4bc94d80fe427f6fca573e9cc3ea834e1a1fccecb82a",
    "ab134a75e130895c7b438eca8e8e29a3376f5db25cbec1414da64342a27e5b65",
    "ab84ee7c8ad752bbb6493aba4c7a99bd757e32941bcd143dfb7abfb342f1f469",
    "b81a562e7bd46df5240afe6fd1e079b7ffe9dcb4de97e1ee92f6a65b508553d3",
    "ca98a49e3963b6f01e04437a8e3a9dc8a484abb5185c091500666188333b0f52",
    "cb8029cb5f2db020885a0b361fc2e596fec134d8f13782efd6070716b2e52b5c",
    "d2444cc6cad1733eee91e435e46cb0dea3d4c675dfbfdbd2e3ea58c2cb05a489",
    "d55cc03d52b4f09d42efcb89ea4d4029dae8a2523919b215dd68637b01ce1603",
    "ddc06907068cddc4f3df0258a001d44bb47da3f2e5c46d498c6de5adf950c907",
    "deda1c027a6a5f837a33adf3c33af414fd1390c00045ece19e31e07739383926",
    "e602d68860707697af64cf18bc2bebf2e8385827968665ae0d3f9900a4ee15a0",
    "f7f89e020ecc371f2e78c66fe83d4eae6074e3b767700d9aacf2c0a277d22c2d",
  ],
};
