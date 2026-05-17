import type { ConsensusData } from "@shared/cryptoTypes";

interface Props {
  consensus: ConsensusData | undefined;
  isLoading: boolean;
}

export function ConsensusPanel({ consensus, isLoading }: Props) {
  if (isLoading && !consensus) {
    return (
      <div className="crypto-panel border-accent/20">
        <div className="crypto-panel-header flex justify-between items-center">
          <span>Manus-Enhanced 共識評分</span>
          <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        </div>
        <div className="p-3 space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-secondary/50 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!consensus) return null;

  const score = consensus.score;
  const deviation = score - 50;
  const isStrong = Math.abs(deviation) >= 30;
  
  const color = score >= 60 ? "text-bull" : score <= 40 ? "text-bear" : "text-foreground";
  const bgColor = score >= 60 ? "bg-bull" : score <= 40 ? "bg-bear" : "bg-muted-foreground/50";
  const glowClass = isStrong ? (score >= 60 ? "shadow-[0_0_15px_rgba(0,255,127,0.3)]" : "shadow-[0_0_15px_rgba(255,69,0,0.3)]") : "";

  return (
    <div className={`crypto-panel transition-all duration-500 ${glowClass} ${isStrong ? 'border-accent/50' : ''}`}>
      <div className="crypto-panel-header flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-accent">⚡</span>
          <span>Manus-Enhanced 綜合共識</span>
        </div>
        {isStrong && (
          <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded animate-bounce">
            強共振
          </span>
        )}
      </div>
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-3xl font-mono font-bold tracking-tighter ${color}`}>
              {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}
            </div>
            <div className={`text-xs font-bold uppercase tracking-wider mt-1 opacity-80 ${color}`}>
              {consensus.label}
            </div>
          </div>
          <div className="text-right bg-secondary/30 p-2 rounded-lg border border-white/5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Confidence</div>
            <div className="text-xl font-mono text-foreground leading-none mt-1">
              {score.toFixed(0)}<span className="text-xs opacity-50">%</span>
            </div>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="h-3 bg-secondary/50 rounded-full overflow-hidden border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${bgColor}`}
              style={{ width: `${score}%` }}
            />
            {/* 中性線標記 */}
            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/20 -translate-x-1/2" />
          </div>
          
          <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-mono uppercase tracking-tighter">
            <span className={score <= 20 ? "text-bear font-bold" : ""}>Extreme Bear</span>
            <span className="opacity-50">Neutral</span>
            <span className={score >= 80 ? "text-bull font-bold" : ""}>Extreme Bull</span>
          </div>
        </div>

        {/* Manus-AI 額外提示 */}
        <div className="mt-2 pt-2 border-t border-white/5 flex items-start gap-2">
          <div className="text-accent text-xs mt-0.5">💡</div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {score >= 70 ? "當前多頭共振極強，建議配合 15M OB 回踩進場。" : 
             score <= 30 ? "空頭動能佔優，注意 1H 級別的流動性清算。" : 
             "市場處於震盪區間，建議減少交易頻率，等待共振分突破 60/40。"}
          </p>
        </div>
      </div>
    </div>
  );
}
