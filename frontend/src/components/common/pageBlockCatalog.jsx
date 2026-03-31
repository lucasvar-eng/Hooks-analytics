import AIAnalysisPanel from './AIAnalysisPanel';
import ClaudeActionBar from './ClaudeActionBar';
import TopInsightBar from '../insights/TopInsightBar';
import { createUtilityBlocks } from './pageBlockLibrary';

export function createInsightBlock({
  id = 'top-insight',
  label = 'Insight principal',
  category = 'Contexto',
  storeId,
}) {
  return {
    id,
    label,
    category,
    content: <TopInsightBar storeId={storeId} />,
  };
}

export function createAnalysisBlock({
  id = 'analysis-tools',
  label = 'Análisis asistido',
  category = 'IA',
  storeId,
  storeName,
  from,
  to,
  mode = 'dashboard',
  section = 'dashboard',
  description = 'Prompts y análisis largos quedan abajo para no competir con la lectura principal.',
}) {
  return {
    id,
    label,
    category,
    content: (
      <div className="space-y-4">
        <div>
          <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Análisis asistido</p>
          <p className="text-app-secondary text-[12px] mt-1">{description}</p>
        </div>

        <ClaudeActionBar
          storeId={storeId}
          storeName={storeName}
          from={from}
          to={to}
          mode={mode}
        />

        <AIAnalysisPanel storeId={storeId} section={section} from={from} to={to} />
      </div>
    ),
  };
}

export function createSharedPageBlocks(prefix, config) {
  return [
    createInsightBlock({
      id: `${prefix}-insight`,
      storeId: config.storeId,
    }),
    createAnalysisBlock({
      id: `${prefix}-analysis`,
      storeId: config.storeId,
      storeName: config.storeName,
      from: config.from,
      to: config.to,
      mode: config.mode,
      section: config.section,
      description: config.analysisDescription,
    }),
    ...createUtilityBlocks(prefix),
  ];
}

export default createSharedPageBlocks;
