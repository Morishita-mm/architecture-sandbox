import { useState, useEffect, lazy, Suspense } from "react";
const ArchitectureCanvas = lazy(() => import("./components/ArchitectureCanvas").then(module => ({ default: module.ArchitectureCanvas })));
const LearningCourse = lazy(() => import("./components/LearningCourse").then(module => ({ default: module.LearningCourse })));
import { ScenarioSetup } from "./components/ScenarioSetup";
import type { Scenario, ProjectSaveData } from "./types";
import { ScenarioSelectionScreen } from "./components/ScenarioSelectionScreen";
import { startFixedScenario } from "./scenarios";

// アプリのフェーズを管理するための型
type AppPhase = "SCENARIO_SELECTION" | "THEME_SELECTION" | "CUSTOM_DEFINITION" | "CANVAS" | "LEARNING";

function App() {
  const [phase, setPhase] = useState<AppPhase>("SCENARIO_SELECTION");
  const [startInDesign, setStartInDesign] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [phase]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    null
  );

  // ロードされたプロジェクトデータを保持するState
  const [loadedProjectData, setLoadedProjectData] =
    useState<ProjectSaveData | null>(null);
  const [loadedEvaluationKey, setLoadedEvaluationKey] = useState<string | null>(null);

  const handleScenarioSelect = (scenario: Scenario) => {
    setLoadedEvaluationKey(null);
    // 新規作成時はロードデータをクリア
    setLoadedProjectData(null);

    if (scenario.isCustom) {
      // カスタムシナリオの場合、定義画面へ遷移
      setSelectedScenario(scenario);
      setPhase("CUSTOM_DEFINITION");
    } else {
      // デフォルトシナリオの場合、キャンバスへ遷移
      setSelectedScenario(startFixedScenario(scenario));
      setPhase("CANVAS");
    }
  };

  // ロード完了ハンドラ
  const handleProjectLoadComplete = (loadedData: ProjectSaveData, key: string | null = null) => {
    setLoadedEvaluationKey(key);
    // 読み込まれたシナリオとデータをセットし、即座にキャンバスへ遷移
    setSelectedScenario(loadedData.scenario);
    setLoadedProjectData(loadedData);
    setPhase("CANVAS");
  };

  const handleCustomDefinitionComplete = (scenario: Scenario) => {
    setLoadedEvaluationKey(null);
    // カスタム定義が完了したら、キャンバスへ遷移
    setSelectedScenario(scenario);
    setLoadedProjectData(null); // クリア
    setPhase("CANVAS");
  };

  // シナリオ選択画面へ戻るハンドラ
  const handleGoToSelection = () => {
    setStartInDesign(false);
    setLoadedEvaluationKey(null);
    setSelectedScenario(null);
    setLoadedProjectData(null); // クリア
    setPhase("SCENARIO_SELECTION");
  };

  if (phase === "SCENARIO_SELECTION" || phase === "THEME_SELECTION") {
    return (
      <ScenarioSelectionScreen
        onSelectScenario={handleScenarioSelect}
        onProjectLoad={handleProjectLoadComplete}
        onStartLearning={() => setPhase('LEARNING')}
        choosingTheme={phase === 'THEME_SELECTION'}
        onChooseTheme={() => setPhase('THEME_SELECTION')}
        onHome={handleGoToSelection}
      />
    );
  }

  if (phase === 'LEARNING') {
    return <Suspense fallback={<div role="status">学習コースを読み込み中...</div>}>
      <LearningCourse onPractice={project => { setStartInDesign(true); handleProjectLoadComplete(project); }} onHome={handleGoToSelection} onDesign={() => { handleGoToSelection(); setPhase('THEME_SELECTION'); }} />
    </Suspense>;
  }

  if (phase === "CUSTOM_DEFINITION" && selectedScenario) {
    return (
      <ScenarioSetup
        initialScenario={selectedScenario}
        onConfirm={handleCustomDefinitionComplete}
        onCancel={() => { handleGoToSelection(); setPhase('THEME_SELECTION'); }}
      />
    );
  }

  if (phase === "CANVAS" && selectedScenario) {
    return (
      <Suspense fallback={<div role="status">設計画面を読み込み中...</div>}>
      <ArchitectureCanvas
        selectedScenario={selectedScenario}
        initialTab={startInDesign ? "design" : undefined}
        onBackToSelection={handleGoToSelection}
        loadedProjectData={loadedProjectData}
        loadedEvaluationKey={loadedEvaluationKey}
      />
      </Suspense>
    );
  }

  return <div style={{ padding: 20 }}>アプリケーションのロード中...</div>;
}

export default App;
