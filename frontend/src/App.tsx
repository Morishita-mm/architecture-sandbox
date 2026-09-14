import { useState, useEffect, lazy, Suspense } from "react";
const ArchitectureCanvas = lazy(() => import("./components/ArchitectureCanvas").then(module => ({ default: module.ArchitectureCanvas })));
import { ScenarioSetup } from "./components/ScenarioSetup";
import type { Scenario, ProjectSaveData } from "./types";
import { ScenarioSelectionScreen } from "./components/ScenarioSelectionScreen";

// アプリのフェーズを管理するための型
type AppPhase = "SCENARIO_SELECTION" | "CUSTOM_DEFINITION" | "CANVAS";

function App() {
  const [phase, setPhase] = useState<AppPhase>("SCENARIO_SELECTION");
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [phase]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    null
  );

  // ロードされたプロジェクトデータを保持するState
  const [loadedProjectData, setLoadedProjectData] =
    useState<ProjectSaveData | null>(null);

  const handleScenarioSelect = (scenario: Scenario) => {
    // 新規作成時はロードデータをクリア
    setLoadedProjectData(null);

    if (scenario.isCustom) {
      // カスタムシナリオの場合、定義画面へ遷移
      setSelectedScenario(scenario);
      setPhase("CUSTOM_DEFINITION");
    } else {
      // デフォルトシナリオの場合、キャンバスへ遷移
      setSelectedScenario(scenario);
      setPhase("CANVAS");
    }
  };

  // ロード完了ハンドラ
  const handleProjectLoadComplete = (loadedData: ProjectSaveData) => {
    // 読み込まれたシナリオとデータをセットし、即座にキャンバスへ遷移
    setSelectedScenario(loadedData.scenario);
    setLoadedProjectData(loadedData);
    setPhase("CANVAS");
  };

  const handleCustomDefinitionComplete = (scenario: Scenario) => {
    // カスタム定義が完了したら、キャンバスへ遷移
    setSelectedScenario(scenario);
    setLoadedProjectData(null); // クリア
    setPhase("CANVAS");
  };

  // シナリオ選択画面へ戻るハンドラ
  const handleGoToSelection = () => {
    setSelectedScenario(null);
    setLoadedProjectData(null); // クリア
    setPhase("SCENARIO_SELECTION");
  };

  if (phase === "SCENARIO_SELECTION") {
    return (
      <ScenarioSelectionScreen
        onSelectScenario={handleScenarioSelect}
        onProjectLoad={handleProjectLoadComplete}
      />
    );
  }

  if (phase === "CUSTOM_DEFINITION" && selectedScenario) {
    return (
      <ScenarioSetup
        initialScenario={selectedScenario}
        onConfirm={handleCustomDefinitionComplete}
        onCancel={handleGoToSelection}
      />
    );
  }

  if (phase === "CANVAS" && selectedScenario) {
    return (
      <Suspense fallback={<div role="status">設計画面を読み込み中...</div>}>
      <ArchitectureCanvas
        selectedScenario={selectedScenario}
        onBackToSelection={handleGoToSelection}
        loadedProjectData={loadedProjectData}
      />
      </Suspense>
    );
  }

  return <div style={{ padding: 20 }}>アプリケーションのロード中...</div>;
}

export default App;
