import type { FarmPlot } from "@yinjie/contracts";
import { FarmPlotCell } from "./farm-plot-cell";

interface FarmGridProps {
  plots: FarmPlot[];
  selectedIndex: number | null;
  onSelect: (plotIndex: number) => void;
}

export function FarmGrid({ plots, selectedIndex, onSelect }: FarmGridProps) {
  const cols = plots.length <= 6 ? 3 : plots.length <= 9 ? 3 : 4;
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {plots.map((plot, index) => (
        <FarmPlotCell
          key={plot.index ?? index}
          plot={plot}
          selected={selectedIndex === index}
          onClick={() => onSelect(index)}
        />
      ))}
    </div>
  );
}
