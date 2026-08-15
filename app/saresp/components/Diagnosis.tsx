import { AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";
import { POSITION_BADGE_CLASS } from "@/lib/saresp/analysis";
import type { DiagnosisResult, PriorityRow } from "@/lib/saresp/types";

function ProseList({ icon: Icon, items, tone }: { icon: LucideIcon; items: string[]; tone: string }) {
  return (
    <div className={`diagnostic-list ${tone}`}>
      {items.map((text) => (
        <p key={text}>
          <Icon size={16} /> {text}
        </p>
      ))}
    </div>
  );
}

function PriorityTable({ rows }: { rows: PriorityRow[] }) {
  if (!rows.length) {
    return (
      <p className="ranking-empty">
        Nenhuma prioridade pôde ser calculada com os dados e filtros atuais (referência estadual ou evolução ano a ano indisponível).
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Prioridade</th>
            <th>Série</th>
            <th>Componente</th>
            <th>Situação</th>
            <th>Evidência</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.componente}-${row.serieAno}`}>
              <td>
                <span className={`status ${POSITION_BADGE_CLASS[row.key]}`}>{row.priority}</span>
              </td>
              <td>{row.serieAno}</td>
              <td>{row.componente}</td>
              <td>{row.situacao}</td>
              <td>{row.evidencia}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Diagnosis({ diagnosis, priorities }: { diagnosis: DiagnosisResult; priorities: PriorityRow[] }) {
  const { destaques, pontosDeAtencao } = diagnosis;
  const isEmpty = !destaques.length && !pontosDeAtencao.length;

  return (
    <section className="panel narrative-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Diagnóstico automático</p>
          <h2>Diagnóstico dos resultados</h2>
        </div>
      </div>

      {isEmpty ? (
        <p className="table-note">Não há dados suficientes de evolução (2024→2025) para gerar diagnóstico neste recorte.</p>
      ) : (
        <>
          {destaques.length > 0 && (
            <>
              <p className="diagnosis-heading">Destaques</p>
              <ProseList icon={CheckCircle2} items={destaques} tone="positive" />
            </>
          )}
          {pontosDeAtencao.length > 0 && (
            <>
              <p className="diagnosis-heading">Pontos de atenção</p>
              <ProseList icon={AlertTriangle} items={pontosDeAtencao} tone="attention" />
            </>
          )}
        </>
      )}

      <p className="diagnosis-heading">Prioridades para análise</p>
      <PriorityTable rows={priorities} />
    </section>
  );
}
