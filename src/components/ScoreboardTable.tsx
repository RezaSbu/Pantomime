import React from 'react';
import { TeamScoreSummary } from '../types/game';
import { formatNum, formatSignedNum } from '../utils/format';
import { DynamicIcon } from './DynamicIcon';

interface ScoreboardTableProps {
  standings: TeamScoreSummary[];
  persianDigits: boolean;
  goldenEnabled: boolean;
  goldenMaxPerTeam: number;
  activeTeamId?: string;
  compact?: boolean;
}

export const ScoreboardTable: React.FC<ScoreboardTableProps> = ({
  standings,
  persianDigits,
  goldenEnabled,
  goldenMaxPerTeam,
  activeTeamId,
  compact = false,
}) => {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <th className="py-3.5 px-4 whitespace-nowrap">رتبه و تیم</th>
            <th className="py-3.5 px-3 whitespace-nowrap">امتیاز کل</th>
            <th className="py-3.5 px-3 whitespace-nowrap">امتیاز پایه</th>
            <th className="py-3.5 px-3 whitespace-nowrap">امتیاز تایم</th>
            <th className="py-3.5 px-3 whitespace-nowrap">جریمه تعویض</th>
            <th className="py-3.5 px-3 whitespace-nowrap">جریمه خطا</th>
            {!compact && (
              <>
                <th className="py-3.5 px-3 whitespace-nowrap">درست</th>
                <th className="py-3.5 px-3 whitespace-nowrap">تعداد خطا</th>
                <th className="py-3.5 px-3 whitespace-nowrap">تعویض‌ها</th>
                {goldenEnabled && (
                  <th className="py-3.5 px-4 whitespace-nowrap">فرصت طلایی</th>
                )}
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm tabular-nums">
          {standings.map((row, idx) => {
            const isCurrent = activeTeamId === row.teamId;
            return (
              <tr
                key={row.teamId}
                className={`transition-colors ${
                  isCurrent
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <span className="w-6 text-xs font-bold text-slate-400 dark:text-slate-500">
                      {formatNum(idx + 1, persianDigits)}.
                    </span>
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: row.color }}
                    >
                      <DynamicIcon name={row.icon} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {row.teamName}
                      </div>
                      {isCurrent && (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          نوبت فعال
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-3 font-extrabold text-base text-slate-900 dark:text-white whitespace-nowrap">
                  {formatNum(row.totalScore, persianDigits)}
                </td>
                <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {formatNum(row.basePointsTotal, persianDigits)}
                </td>
                <td className="py-3.5 px-3 text-emerald-700 dark:text-emerald-400 font-medium whitespace-nowrap">
                  {row.speedBonusTotal > 0
                    ? formatSignedNum(row.speedBonusTotal, persianDigits)
                    : formatNum(0, persianDigits)}
                </td>
                <td className="py-3.5 px-3 text-rose-600 dark:text-rose-400 whitespace-nowrap">
                  {row.swapPenaltyTotal > 0
                    ? `−${formatNum(row.swapPenaltyTotal, persianDigits)}`
                    : formatNum(0, persianDigits)}
                </td>
                <td className="py-3.5 px-3 text-rose-600 dark:text-rose-400 whitespace-nowrap">
                  {(row.foulPenaltyTotal ?? 0) > 0
                    ? `−${formatNum(row.foulPenaltyTotal ?? 0, persianDigits)}`
                    : formatNum(0, persianDigits)}
                </td>
                {!compact && (
                  <>
                    <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatNum(row.correctCount, persianDigits)}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatNum(row.wrongGuessesCount, persianDigits)}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatNum(row.swapsCount, persianDigits)}
                    </td>
                    {goldenEnabled && (
                      <td className="py-3.5 px-4 text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        {formatNum(row.goldenUsedCount, persianDigits)} از{' '}
                        {formatNum(goldenMaxPerTeam, persianDigits)}
                      </td>
                    )}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
